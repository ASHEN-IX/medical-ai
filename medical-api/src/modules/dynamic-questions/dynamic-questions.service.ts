import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * DynamicQuestionsService
 * Generates disease-specific follow-up questions based on patient analysis
 * 
 * Workflow:
 * 1. When ManualTest is completed, generate questions via AI or defaults
 * 2. Store questions in database with case reference
 * 3. Track patient responses
 * 4. Use responses to refine analysis and risk assessment
 */
@Injectable()
export class DynamicQuestionsService {
  private readonly logger = new Logger(DynamicQuestionsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL') || 'http://ai-service:8001';
  }

  /**
   * Generate follow-up questions for a case
   */
  async generateQuestions(caseAssignmentId: string): Promise<any[]> {
    const caseAssignment = await this.prisma.caseAssignment.findUnique({
      where: { id: caseAssignmentId },
      include: {
        patient: true,
        analysis: true,
      },
    });

    if (!caseAssignment) {
      throw new NotFoundException('Case not found');
    }

    const disease = caseAssignment.disease;
    const patientAge = caseAssignment.patient.age || 0;
    const riskLevel = caseAssignment.analysis?.riskLevel || 'NORMAL';

    // Try AI service first
    let questions: any[] = [];

    try {
      this.logger.log(`Generating dynamic questions for ${disease} case...`);

      const resp = await axios.post(
        `${this.aiServiceUrl}/api/v1/dynamic-questions/generate`,
        {
          disease,
          riskLevel,
          age: patientAge,
          analysisData: caseAssignment.analysis,
        },
        { timeout: 30000 },
      );

      questions = resp.data.questions || [];
    } catch (err: any) {
      this.logger.warn(`AI dynamic questions failed: ${err.message}. Using defaults.`);
      questions = this.getDefaultQuestions(disease, riskLevel);
    }

    // Save questions to database
    const savedQuestions: any[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      const saved = await (this.prisma as any).dynamicQuestion.create({
        data: {
          caseAssignmentId,
          questionText: question.text || question.questionText,
          questionType: question.type || 'TEXT',
          options: question.options || null,
          severity: question.severity || 'INFO',
          category: question.category || 'SYMPTOMS',
          orderIndex: i + 1,
          answered: false,
          responses: [],
        },
      });

      savedQuestions.push(saved);
    }

    // Notify patient about new questions
    await this.notifications.notify({
      userId: caseAssignment.patientId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Follow-up Questions Available',
      message: `Please answer ${savedQuestions.length} follow-up questions to help us better understand your condition.`,
      channels: ['in_app'],
      data: {
        caseId: caseAssignmentId,
        questionCount: savedQuestions.length,
      },
      relatedId: caseAssignmentId,
    });

    this.logger.log(
      `Generated ${savedQuestions.length} dynamic questions for case ${caseAssignmentId}`,
    );

    return savedQuestions;
  }

  /**
   * Get unanswered questions for a case
   */
  async getUnansweredQuestions(caseAssignmentId: string): Promise<any[]> {
    return (this.prisma as any).dynamicQuestion.findMany({
      where: {
        caseAssignmentId,
        answered: false,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Record answer to a question
   */
  async answerQuestion(questionId: string, response: any): Promise<any> {
    const question = await (this.prisma as any).dynamicQuestion.findUnique({
      where: { id: questionId },
      include: { caseAssignment: true },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const updated = await (this.prisma as any).dynamicQuestion.update({
      where: { id: questionId },
      data: {
        answered: true,
        responses: response ? [response] : [],
        answeredAt: new Date(),
      },
      include: { caseAssignment: true },
    });

    this.logger.debug(`Question answered: ${questionId}`);

    // Check if all questions are answered
    const unanswered = await (this.prisma as any).dynamicQuestion.findMany({
      where: {
        caseAssignmentId: question.caseAssignmentId,
        answered: false,
      },
    });

    if (unanswered.length === 0) {
      // All questions answered - trigger analysis refinement
      await this.refineAnalysis(question.caseAssignmentId);
    }

    return updated;
  }

  /**
   * Get all questions for a case with responses
   */
  async getQuestionsWithResponses(caseAssignmentId: string): Promise<any[]> {
    return (this.prisma as any).dynamicQuestion.findMany({
      where: { caseAssignmentId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Get completion status for a case
   */
  async getCompletionStatus(caseAssignmentId: string): Promise<{
    total: number;
    answered: number;
    percentComplete: number;
    completedAt?: Date;
  }> {
    const questions = await (this.prisma as any).dynamicQuestion.findMany({
      where: { caseAssignmentId },
    });

    const answered = questions.filter((q: any) => q.answered).length;
    const total = questions.length;
    const completed = questions.every((q: any) => q.answered);

    return {
      total,
      answered,
      percentComplete: total > 0 ? Math.round((answered / total) * 100) : 0,
      completedAt: completed ? new Date() : undefined,
    };
  }

  /**
   * Refine analysis based on question responses
   */
  private async refineAnalysis(caseAssignmentId: string): Promise<void> {
    try {
      const caseAssignment = await this.prisma.caseAssignment.findUnique({
        where: { id: caseAssignmentId },
        include: {
          analysis: true,
          patient: true,
        },
      });

      if (!caseAssignment?.analysis) return;

      const questions = await (this.prisma as any).dynamicQuestion.findMany({
        where: { caseAssignmentId },
      });

      const responses = questions.map((q: any) => ({
        question: q.questionText,
        response: (q.responses as any)?.[0] || null,
      }));

      // Call AI service to refine risk assessment
      try {
        const resp = await axios.post(
          `${this.aiServiceUrl}/api/v1/analysis/refine`,
          {
            disease: caseAssignment.disease,
            originalAnalysis: caseAssignment.analysis,
            additionalResponses: responses,
            patientAge: caseAssignment.patient.age,
          },
          { timeout: 30000 },
        );

        const refinedData = resp.data;

        // Update analysis with refined risk level if changed
        if (refinedData.riskLevel && refinedData.riskLevel !== caseAssignment.analysis.riskLevel) {
          await this.prisma.analysis.update({
            where: { id: caseAssignment.analysis.id },
            data: {
              riskLevel: refinedData.riskLevel,
              aiInsights: (caseAssignment.analysis.aiInsights || '') + `\n\nRefined based on follow-up questions. Original: ${caseAssignment.analysis.riskLevel}`,
            },
          });

          // Notify doctor about refined assessment
          if (caseAssignment.doctorId) {
            await this.notifications.notify({
              userId: caseAssignment.doctorId,
              type: 'CASE_UPDATE',
              severity: refinedData.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
              title: 'Updated Case Assessment',
              message: `Patient responses have updated the risk level to ${refinedData.riskLevel} for ${caseAssignment.disease}`,
              channels: ['in_app', 'email'],
              data: { caseId: caseAssignmentId },
            });
          }

          this.logger.log(
            `Analysis refined for case ${caseAssignmentId}: ${caseAssignment.analysis.riskLevel} → ${refinedData.riskLevel}`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`Analysis refinement failed: ${err.message}`);
      }

      // Create history event
      await this.notifications.recordHistoryEvent(
        caseAssignment.patientId,
        'REPORT_UPLOAD',
        'Follow-up Questions Completed',
        'Patient completed all follow-up questions for case assessment.',
        caseAssignmentId,
      );
    } catch (err: any) {
      this.logger.error(`Error refining analysis for case ${caseAssignmentId}:`, err);
    }
  }

  /**
   * Get default questions for a disease
   */
  private getDefaultQuestions(disease: string, riskLevel: string): any[] {
    const diseaseKey = disease.toLowerCase().replace(/\s+/g, '');

    // Minimal default questions (simplified to keep implementation small)
    const defaults = [
      { text: 'Have you noticed any changes in your symptoms?', type: 'YES_NO', category: 'SYMPTOMS', severity: 'MEDIUM' },
      { text: 'Any new medications or changes to dosage?', type: 'TEXT', category: 'MEDICATION', severity: 'LOW' },
    ];

    return defaults;
  }

  /**
   * Mark question as important (clinical priority)
   */
  async markAsImportant(questionId: string, isImportant: boolean): Promise<any> {
    return (this.prisma as any).dynamicQuestion.update({
      where: { id: questionId },
      data: { isImportant },
    });
  }

  /**
   * Delete old questions (older than 180 days)
   */
  async cleanupOldQuestions(daysOld: number = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await (this.prisma as any).dynamicQuestion.deleteMany({
      where: {
        answered: true,
        answeredAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old dynamic questions`);

    return result.count;
  }
}
