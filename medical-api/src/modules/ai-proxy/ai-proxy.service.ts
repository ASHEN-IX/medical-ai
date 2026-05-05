import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

export interface AiAnalyzePayload {
  report_type: string;
  features: Record<string, number>;
  raw_text?: string;
  include_explanation?: boolean;
  symptoms?: string[];
  image?: string;
}

export interface AiAnalyzeResponse {
  success: boolean;
  request_id: string;
  extracted_features: Record<string, unknown>;
  model_outputs: Record<
    string,
    {
      risk: string;
      confidence: number;
      source?: string;
      autism_detected?: boolean;
      raw_response?: Record<string, unknown>;
    }
  >;
  rag_context: string[];
  kg_insights: {
    diseases: string[];
    symptoms: string[];
    risk_factors: string[];
    complications: string[];
    treatments: string[];
    connections: string[];
  };
  risk_assessment: {
    overall_risk: string;
    priority: string;
    final_decision: string;
    rationale: string[];
  };
  llm_explanation_text: string;
  final_decision: string;
  selected_models: string[];
  results: Record<string, { risk: string; confidence: number; autism_detected?: boolean }>;
  final_assessment: { overall_risk: string; priority: string };
  reasoning: string[];
  llm_explanation?: {
    summary: string;
    explanation: string[];
    risk_interpretation: { level: string; meaning: string };
    recommendations: string[];
    safety_note: string;
  } | null;
  metadata: { processing_time_ms: number; timestamp: string };
}

export interface AiChatPayload {
  message: string;
  analysis_context?: Record<string, unknown>;
  history?: Array<{ role: string; content: string }>;
}

export interface StagedAnalyzePayload {
  report_type: string;
  features: Record<string, number | string | null | undefined>;
  raw_text?: string;
  include_explanation?: boolean;
  symptoms?: string[];
  image?: string;
}

export interface FollowUpQuestion {
  id: string;
  text: string;
  disease: string;
  category: string;
  reason: string;
  answer_type: string;
  options: string[];
  priority: number;
  kg_source?: string;
  rag_source?: string;
}

export interface StagedAnalyzeResponse {
  success: boolean;
  session_id: string;
  stage: string;
  report_type: string;
  selected_disease?: string;
  overall_risk: string;
  confidence: number;
  model_outputs: Record<string, unknown>;
  needs_follow_up: boolean;
  follow_up_questions: FollowUpQuestion[];
  reasoning: string[];
  rag_context: string[];
  kg_insights: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface FetchQuestionsPayload {
  session_id: string;
}

export interface FetchQuestionsResponse {
  success: boolean;
  session_id: string;
  stage: string;
  selected_disease?: string;
  questions: FollowUpQuestion[];
  question_count: number;
}

export interface SubmitAnswersPayload {
  session_id: string;
  answers: Array<{ question_id: string; answer: string }>;
}

export interface SubmitAnswersResponse {
  success: boolean;
  session_id: string;
  stage: string;
  enriched_features: Record<string, unknown>;
  feature_count: number;
}

export interface FinalReportPayload {
  session_id: string;
}

export interface FinalReportResponse {
  success: boolean;
  session_id: string;
  stage: string;
  report_type: string;
  selected_disease?: string;
  updated_risk: string;
  updated_confidence: number;
  model_outputs: Record<string, unknown>;
  rag_context: string[];
  kg_insights: Record<string, unknown>;
  evidence_summary: string[];
  missing_caveats: string[];
  recommendations: string[];
  llm_narrative: string;
  initial_vs_final: Record<string, unknown>;
  safety_note: string;
  metadata: Record<string, unknown>;
}

export interface AiChatResponse {
  response: string;
  sources?: string[];
}

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiClient: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const baseURL =
      this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:8001';
    this.aiClient = axios.create({ baseURL, timeout: 60_000 });
  }

  async analyze(
    userId: string,
    payload: AiAnalyzePayload,
  ): Promise<AiAnalyzeResponse> {
    try {
      const { data } = await this.aiClient.post<AiAnalyzeResponse>(
        '/api/v1/ai/analyze',
        payload,
      );

      const riskLevel = this.mapRiskLevel(
        data.risk_assessment?.overall_risk || data.final_assessment?.overall_risk,
      );
      const healthScore = this.calculateHealthScore(data);
      const keyFindings = this.extractKeyFindings(data);
      const storedResults = this.persistCanonicalAutismFlag(data);

      const analysis = await this.prisma.analysis.create({
        data: {
          userId,
          testName: payload.report_type || 'auto',
          selectedModels: data.selected_models || [],
          features: payload.features || {},
          symptoms: payload.symptoms || [],
          results: JSON.parse(JSON.stringify(storedResults)),
          healthScore,
          riskLevel,
          keyFindings,
          aiInsights: data.llm_explanation_text || null,
          status: 'COMPLETED',
        },
      });

      if (payload.features && Object.keys(payload.features).length > 0) {
        const metricOps = Object.entries(payload.features).map(([key, value]) =>
          this.prisma.healthMetric.create({
            data: { userId, metricKey: key, value, source: 'analysis' },
          }),
        );
        await Promise.allSettled(metricOps);
      }

      await this.prisma.log.create({
        data: {
          userId,
          action: 'AI_ANALYSIS',
          metadata: {
            analysisId: analysis.id,
            riskLevel,
            healthScore,
            processingTime: data.metadata?.processing_time_ms,
          },
        },
      });

      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        await this.triggerEmergencyAlert(userId, analysis.id, riskLevel);
      }

      return data;
    } catch (error) {
      this.logger.error('AI analysis failed', error);
      throw new InternalServerErrorException(
        'AI service is temporarily unavailable. Please try again.',
      );
    }
  }

  async chat(payload: AiChatPayload): Promise<AiChatResponse> {
    try {
      const { data } = await this.aiClient.post<AiChatResponse>(
        '/api/v1/rag/retrieve',
        {
          query: payload.message,
          context: payload.analysis_context,
          chat_history: payload.history,
        },
      );
      return { response: data.response || String(data), sources: data.sources };
    } catch (error) {
      this.logger.error('AI chat failed', error);
      throw new InternalServerErrorException('AI chat service unavailable.');
    }
  }

  async getHealthTimeline(userId: string) {
    const metrics = await this.prisma.healthMetric.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, Array<{ value: number; date: string }>> = {};
    for (const m of metrics) {
      if (!grouped[m.metricKey]) grouped[m.metricKey] = [];
      grouped[m.metricKey].push({
        value: m.value,
        date: m.createdAt.toISOString(),
      });
    }

    const analyses = await this.prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        healthScore: true,
        riskLevel: true,
        createdAt: true,
        testName: true,
      },
    });

    const insights = this.generatePersonalizedInsights(grouped, analyses);

    return { metrics: grouped, analyses, insights };
  }

  async stagedAnalyze(
    userId: string,
    payload: StagedAnalyzePayload,
  ): Promise<StagedAnalyzeResponse> {
    try {
      const { data } = await this.aiClient.post<StagedAnalyzeResponse>(
        '/api/v1/diagnosis/analyze',
        payload,
      );

      await this.prisma.log.create({
        data: {
          userId,
          action: 'STAGED_DIAGNOSIS_STARTED',
          metadata: {
            sessionId: data.session_id,
            disease: data.selected_disease,
            risk: data.overall_risk,
            needsFollowUp: data.needs_follow_up,
            questionCount: data.follow_up_questions?.length ?? 0,
          },
        },
      });

      return data;
    } catch (error) {
      this.logger.error('Staged analysis failed', error);
      throw new InternalServerErrorException(
        'AI staged analysis is temporarily unavailable. Please try again.',
      );
    }
  }

  async fetchQuestions(
    payload: FetchQuestionsPayload,
  ): Promise<FetchQuestionsResponse> {
    try {
      const { data } = await this.aiClient.post<FetchQuestionsResponse>(
        '/api/v1/diagnosis/questions',
        payload,
      );
      return data;
    } catch (error) {
      this.logger.error('Fetch questions failed', error);
      throw new InternalServerErrorException(
        'Could not fetch follow-up questions.',
      );
    }
  }

  async submitAnswers(
    payload: SubmitAnswersPayload,
  ): Promise<SubmitAnswersResponse> {
    try {
      const { data } = await this.aiClient.post<SubmitAnswersResponse>(
        '/api/v1/diagnosis/answers',
        payload,
      );
      return data;
    } catch (error) {
      this.logger.error('Submit answers failed', error);
      throw new InternalServerErrorException(
        'Could not submit answers.',
      );
    }
  }

  async generateFinalReport(
    userId: string,
    payload: FinalReportPayload,
  ): Promise<FinalReportResponse> {
    try {
      const { data } = await this.aiClient.post<FinalReportResponse>(
        '/api/v1/diagnosis/final-report',
        payload,
      );

      await this.prisma.log.create({
        data: {
          userId,
          action: 'STAGED_DIAGNOSIS_COMPLETED',
          metadata: {
            sessionId: data.session_id,
            disease: data.selected_disease,
            updatedRisk: data.updated_risk,
            updatedConfidence: data.updated_confidence,
            initialVsFinal: data.initial_vs_final || {},
          } as any,
        },
      });

      return data;
    } catch (error) {
      this.logger.error('Final report generation failed', error);
      throw new InternalServerErrorException(
        'Could not generate final report.',
      );
    }
  }

  private calculateHealthScore(response: AiAnalyzeResponse): number {
    const results = response.results || {};
    const confidences = Object.values(results);
    if (confidences.length === 0) return 75;

    let score = 100;
    for (const result of confidences) {
      if (result.risk === 'HIGH') score -= 30;
      else if (result.risk === 'MEDIUM') score -= 15;
      else score -= 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private persistCanonicalAutismFlag(response: AiAnalyzeResponse): Record<string, unknown> {
    const results = { ...(response.results || {}) } as Record<string, any>;
    const autismModel = response.model_outputs?.autism_pred || response.model_outputs?.autism_dl;
    const autismDetected = (autismModel as any)?.raw_response?.prediction?.autism_detected;

    if (typeof autismDetected === 'boolean') {
      const autismKey = response.model_outputs?.autism_pred ? 'autism_pred' : 'autism_dl';
      const existing = { ...(results[autismKey] || {}) };
      results[autismKey] = {
        ...existing,
        autism_detected: autismDetected,
      };
    }

    return results;
  }

  private extractKeyFindings(response: AiAnalyzeResponse): string[] {
    const findings: string[] = [];
    const results = response.results || {};

    for (const [model, result] of Object.entries(results)) {
      if (result.risk === 'HIGH') {
        findings.push(
          `High risk detected by ${model} model (${(result.confidence * 100).toFixed(0)}% confidence)`,
        );
      }
    }

    if (response.kg_insights?.diseases?.length) {
      findings.push(`Related conditions: ${response.kg_insights.diseases.join(', ')}`);
    }

    if (response.reasoning?.length) {
      findings.push(...response.reasoning.slice(0, 3));
    }

    return findings;
  }

  private mapRiskLevel(risk?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (risk?.toUpperCase()) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'HIGH':
        return 'HIGH';
      case 'MEDIUM':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  private async triggerEmergencyAlert(
    userId: string,
    analysisId: string,
    riskLevel: string,
  ) {
    this.logger.warn(
      `EMERGENCY ALERT: User ${userId}, Analysis ${analysisId}, Risk ${riskLevel}`,
    );

    const doctors = await this.prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: { id: true },
      take: 5,
    });

    if (doctors.length > 0) {
      await this.prisma.doctorRequest.create({
        data: {
          patientId: userId,
          doctorId: doctors[0].id,
          analysisId,
          urgency: riskLevel === 'CRITICAL' ? 'EMERGENCY' : 'URGENT',
          status: 'PENDING',
          notes: `Auto-generated: ${riskLevel} risk detected by AI system`,
        },
      });
    }

    await this.prisma.log.create({
      data: {
        userId,
        action: 'EMERGENCY_ALERT',
        metadata: { analysisId, riskLevel, autoAssigned: doctors.length > 0 },
      },
    });
  }

  private generatePersonalizedInsights(
    metrics: Record<string, Array<{ value: number; date: string }>>,
    analyses: Array<{ healthScore: number | null; riskLevel: string; createdAt: Date }>,
  ): string[] {
    const insights: string[] = [];

    for (const [key, values] of Object.entries(metrics)) {
      if (values.length >= 2) {
        const latest = values[values.length - 1].value;
        const previous = values[values.length - 2].value;
        if (previous > 0) {
          const change = ((latest - previous) / previous) * 100;
          if (Math.abs(change) >= 5) {
            const direction = change > 0 ? 'increased' : 'decreased';
            insights.push(
              `Your ${key.replace(/_/g, ' ')} ${direction} by ${Math.abs(change).toFixed(0)}% since your last report`,
            );
          }
        }
      }
    }

    if (analyses.length >= 2) {
      const [latest, previous] = analyses;
      if (latest.healthScore != null && previous.healthScore != null) {
        const diff = latest.healthScore - previous.healthScore;
        if (diff > 0) {
          insights.push(`Your health score improved by ${diff} points`);
        } else if (diff < 0) {
          insights.push(`Your health score decreased by ${Math.abs(diff)} points`);
        }
      }
    }

    return insights;
  }
}
