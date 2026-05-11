import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AnalysesService } from '../analyses/analyses.service';
import { CaseAssignmentsService } from '../case-assignments/case-assignments.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Disease form schemas — defines which fields each disease test requires */
export const DISEASE_FORM_SCHEMAS: Record<string, { label: string; fields: Array<{ key: string; label: string; type: string; unit?: string; min?: number; max?: number; options?: string[] }> }> = {
  diabetes: {
    label: 'Diabetes Risk Assessment',
    fields: [
      { key: 'glucose', label: 'Glucose', type: 'number', unit: 'mg/dL', min: 0, max: 500 },
      { key: 'bmi', label: 'BMI', type: 'number', min: 10, max: 60 },
      { key: 'insulin', label: 'Insulin', type: 'number', unit: 'μU/mL', min: 0, max: 900 },
      { key: 'blood_pressure', label: 'Blood Pressure (systolic)', type: 'number', unit: 'mmHg', min: 60, max: 250 },
      { key: 'skin_thickness', label: 'Skin Thickness', type: 'number', unit: 'mm', min: 0, max: 100 },
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120 },
      { key: 'pregnancies', label: 'Pregnancies', type: 'number', min: 0, max: 20 },
      { key: 'dpf', label: 'Diabetes Pedigree Function', type: 'number', min: 0, max: 3 },
    ],
  },
  kidney: {
    label: 'Kidney Disease Screening',
    fields: [
      { key: 'blood_pressure', label: 'Blood Pressure', type: 'number', unit: 'mmHg', min: 40, max: 250 },
      { key: 'specific_gravity', label: 'Specific Gravity', type: 'number', min: 1.0, max: 1.05 },
      { key: 'albumin', label: 'Albumin', type: 'number', min: 0, max: 5 },
      { key: 'sugar', label: 'Sugar', type: 'number', min: 0, max: 5 },
      { key: 'blood_glucose_random', label: 'Blood Glucose Random', type: 'number', unit: 'mg/dL', min: 20, max: 500 },
      { key: 'blood_urea', label: 'Blood Urea', type: 'number', unit: 'mg/dL', min: 1, max: 400 },
      { key: 'serum_creatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL', min: 0, max: 20 },
      { key: 'hemoglobin', label: 'Hemoglobin', type: 'number', unit: 'g/dL', min: 3, max: 20 },
    ],
  },
  heart: {
    label: 'Heart Disease Risk',
    fields: [
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120 },
      { key: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female'] },
      { key: 'cp', label: 'Chest Pain Type', type: 'select', options: ['Typical Angina', 'Atypical Angina', 'Non-anginal', 'Asymptomatic'] },
      { key: 'trestbps', label: 'Resting Blood Pressure', type: 'number', unit: 'mmHg', min: 60, max: 250 },
      { key: 'chol', label: 'Cholesterol', type: 'number', unit: 'mg/dL', min: 100, max: 600 },
      { key: 'thalach', label: 'Max Heart Rate', type: 'number', min: 50, max: 250 },
    ],
  },
  stroke: {
    label: 'Stroke Risk Assessment',
    fields: [
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120 },
      { key: 'hypertension', label: 'Hypertension', type: 'select', options: ['Yes', 'No'] },
      { key: 'heart_disease', label: 'Heart Disease', type: 'select', options: ['Yes', 'No'] },
      { key: 'avg_glucose_level', label: 'Avg Glucose Level', type: 'number', unit: 'mg/dL', min: 40, max: 500 },
      { key: 'bmi', label: 'BMI', type: 'number', min: 10, max: 60 },
      { key: 'smoking_status', label: 'Smoking Status', type: 'select', options: ['Never', 'Former', 'Current', 'Unknown'] },
    ],
  },
  liver: {
    label: 'Liver Disease Screening',
    fields: [
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120 },
      { key: 'total_bilirubin', label: 'Total Bilirubin', type: 'number', unit: 'mg/dL', min: 0, max: 80 },
      { key: 'alkaline_phosphotase', label: 'Alkaline Phosphatase', type: 'number', unit: 'IU/L', min: 10, max: 2200 },
      { key: 'alamine_aminotransferase', label: 'ALT', type: 'number', unit: 'IU/L', min: 5, max: 2000 },
      { key: 'aspartate_aminotransferase', label: 'AST', type: 'number', unit: 'IU/L', min: 5, max: 5000 },
      { key: 'total_proteins', label: 'Total Proteins', type: 'number', unit: 'g/dL', min: 2, max: 10 },
      { key: 'albumin_globulin_ratio', label: 'A/G Ratio', type: 'number', min: 0, max: 3 },
    ],
  },
  thyroid: {
    label: 'Thyroid Function Test',
    fields: [
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120 },
      { key: 'tsh', label: 'TSH', type: 'number', unit: 'mIU/L', min: 0, max: 60 },
      { key: 't3', label: 'T3', type: 'number', unit: 'ng/dL', min: 0, max: 10 },
      { key: 'tt4', label: 'Total T4', type: 'number', unit: 'μg/dL', min: 0, max: 30 },
      { key: 'fti', label: 'FTI', type: 'number', min: 0, max: 400 },
    ],
  },
  autism: {
    label: 'Autism Screening Survey',
    fields: [
      { key: 'A1_Score', label: 'Social Responsiveness', type: 'select', options: ['0', '1'] },
      { key: 'A2_Score', label: 'Eye Contact', type: 'select', options: ['0', '1'] },
      { key: 'A3_Score', label: 'Pointing', type: 'select', options: ['0', '1'] },
      { key: 'A4_Score', label: 'Pretend Play', type: 'select', options: ['0', '1'] },
      { key: 'A5_Score', label: 'Joint Attention', type: 'select', options: ['0', '1'] },
      { key: 'A6_Score', label: 'Unusual Interests', type: 'select', options: ['0', '1'] },
      { key: 'A7_Score', label: 'Repetitive Behavior', type: 'select', options: ['0', '1'] },
      { key: 'A8_Score', label: 'Sensory Issues', type: 'select', options: ['0', '1'] },
      { key: 'A9_Score', label: 'Communication', type: 'select', options: ['0', '1'] },
      { key: 'A10_Score', label: 'Social Interaction', type: 'select', options: ['0', '1'] },
    ],
  },
};

@Injectable()
export class ManualTestsService {
  private readonly logger = new Logger(ManualTestsService.name);
  private readonly aiServiceUrl: string;
  private readonly aiTimeout = 60000; // 60 seconds timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly analyses: AnalysesService,
    private readonly caseAssignments: CaseAssignmentsService,
    private readonly notifications: NotificationsService,
  ) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL') || 'http://ai-service:8001';
  }

  getFormSchemas() {
    return DISEASE_FORM_SCHEMAS;
  }

  getFormSchema(disease: string) {
    return DISEASE_FORM_SCHEMAS[disease.toLowerCase()] || null;
  }

  async runTest(userId: string, data: { disease: string; inputData: Record<string, any> }) {
    const startTime = Date.now();

    // Validate disease exists
    if (!DISEASE_FORM_SCHEMAS[data.disease.toLowerCase()]) {
      throw new BadRequestException(`Disease '${data.disease}' is not supported`);
    }

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('Patient not found');
    }

    // Send to AI Gateway for prediction
    let results: any = null;
    let riskLevel: string | null = null;
    let confidence: number | null = null;
    let aiError: string | null = null;

    try {
      this.logger.log(`Calling AI service for ${data.disease} manual test...`);

      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/api/v1/ai/run-model`,
        {
          selected_models: [data.disease],
          report_type: data.disease,
          features: data.inputData,
        },
        { timeout: this.aiTimeout },
      );

      results = aiResponse.data?.results || {};
      const diseaseResult = results[data.disease];
      riskLevel = diseaseResult?.risk || null;
      confidence = diseaseResult?.confidence || null;

      const elapsed = Date.now() - startTime;
      const confidenceStr = confidence !== null ? `(${(confidence * 100).toFixed(1)}%)` : '(N/A%)';
      this.logger.log(
        `AI service returned ${data.disease} result (${riskLevel}, ${confidenceStr}) in ${elapsed}ms`,
      );
    } catch (err: any) {
      aiError = err.message;
      this.logger.error(`AI service call failed for manual test: ${err.message}`, err);

      // Check if it's a timeout
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        results = { error: 'AI service request timed out. Please try again.' };
      } else if (err.response?.status === 503) {
        results = { error: 'AI service is currently unavailable. Please try again later.' };
      } else {
        results = { error: 'Failed to reach AI service. Please check your connection.' };
      }
    }

    // Create a full Analysis record if we have valid results
    let analysisId = null;
    let caseAssignmentId = null;

    if (riskLevel && confidence !== null) {
      try {
        const analysis = await this.analyses.createAnalysis(userId, {
          testName: data.disease,
          selectedModels: [data.disease],
          features: data.inputData,
          symptoms: [],
          results: results,
          healthScore: Math.round(confidence * 100),
          riskLevel: riskLevel as any,
          keyFindings: [`Manual test for ${data.disease} indicated ${riskLevel} risk level.`],
          aiInsights: `Clinical parameters provided indicate ${(confidence * 100).toFixed(1)}% confidence of ${data.disease}.`,
        });
        analysisId = analysis.id;

        this.logger.log(`Analysis created: ${analysisId}`);

        // Auto-assign specialist based on disease
        const assignment = await this.caseAssignments.autoAssign({
          patientId: userId,
          analysisId: analysis.id,
          disease: data.disease,
          priority: riskLevel === 'CRITICAL' ? 'EMERGENCY' : riskLevel === 'HIGH' ? 'URGENT' : 'NORMAL',
          notes: `Automated manual test case: ${data.disease}`,
        });
        caseAssignmentId = assignment.id;

        this.logger.log(
          `Case assigned: ${caseAssignmentId} to ${assignment.doctor?.name || 'PENDING'}`,
        );

        // Create history event for manual test
        await this.notifications.recordHistoryEvent(
          userId,
          'MANUAL_TEST',
          `${data.disease} Manual Test`,
          `Manual test completed with ${riskLevel} risk level (${(confidence * 100).toFixed(1)}% confidence)`,
          analysisId,
        );

        // Trigger critical risk alert if needed
        if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
          await this.notifications.notifyCriticalRisk(userId, data.disease, riskLevel, confidence);
        }

        // Notify patient about specialist assignment
        if (assignment.doctor) {
          await this.notifications.notifyCaseAssignment(
            userId,
            assignment.doctor.name,
            data.disease,
            assignment.specialty,
          );
        } else {
          // Notify admin if no doctor available
          await this.notifications.notify({
            userId: userId,
            type: 'CASE_UPDATE',
            severity: 'WARNING',
            title: 'Case Pending Specialist',
            message: `Your ${data.disease} case is pending specialist assignment. You will be notified when a doctor is available.`,
            channels: ['in_app', 'email'],
            data: { disease: data.disease, riskLevel },
          });
        }

        // Audit log
        await this.notifications.auditLog(
          userId,
          analysisId,
          'manual_test',
          'run_test',
          {
            disease: data.disease,
            riskLevel,
            confidence,
            caseAssignmentId,
          },
        );
      } catch (err) {
        this.logger.error('Failed to create analysis or assign case from manual test', err);
      }
    } else {
      // No valid results from AI
      this.logger.warn(`Manual test produced invalid results: riskLevel=${riskLevel}, confidence=${confidence}`);

      // Create history event for failed test
      await this.notifications.recordHistoryEvent(
        userId,
        'MANUAL_TEST',
        `${data.disease} Manual Test - Failed`,
        `Manual test failed: ${aiError || 'Invalid results from AI service'}`,
      );
    }

    // Persist manual test record
    const manualTest = await this.prisma.manualTest.create({
      data: {
        userId,
        disease: data.disease,
        inputData: data.inputData,
        results: results || null,
        riskLevel: riskLevel as any,
        confidence: confidence || null,
        analysisId: analysisId || null,
      },
    });

    return {
      id: manualTest.id,
      analysisId,
      caseAssignmentId,
      disease: data.disease,
      inputData: data.inputData,
      results,
      riskLevel,
      confidence,
      error: aiError || null,
      createdAt: manualTest.createdAt,
    };
  }

  async getUserTests(userId: string) {
    return this.prisma.manualTest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
