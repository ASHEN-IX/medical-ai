import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

interface DiseasePreventionPlan {
  dietGuidance: string[];
  exercisePlan: string[];
  sleepAdvice: string[];
  stressManagement: string[];
  followUpTests: string[];
  additionalNotes: string;
}

/**
 * Disease-specific prevention plans as fallback
 * Used when AI service is unavailable or doesn't support disease
 */
const DISEASE_PREVENTION_PLANS: Record<string, DiseasePreventionPlan> = {
  diabetes: {
    dietGuidance: [
      'Limit simple carbohydrates and sugary foods',
      'Include high-fiber foods (whole grains, vegetables)',
      'Control portion sizes and eat regular meals',
      'Limit saturated fats and include healthy fats (omega-3s)',
      'Drink water instead of sugary beverages',
    ],
    exercisePlan: [
      '150 minutes of moderate aerobic exercise per week',
      'Resistance training 2-3 times per week',
      'Avoid prolonged sitting (move every hour)',
    ],
    sleepAdvice: [
      'Maintain consistent sleep schedule (7-9 hours daily)',
      'Go to bed and wake up at the same time',
      'Avoid screens 1 hour before bed',
    ],
    stressManagement: [
      'Practice deep breathing or meditation (10-15 min daily)',
      'Regular physical activity to reduce stress',
      'Consider cognitive behavioral therapy if needed',
    ],
    followUpTests: [
      'HbA1c test every 3 months',
      'Blood glucose monitoring as prescribed',
      'Annual eye exam and foot check',
    ],
    additionalNotes: 'Diabetes requires lifestyle changes and medication adherence for optimal control.',
  },

  heart: {
    dietGuidance: [
      'Follow DASH diet (low sodium, high potassium)',
      'Limit sodium intake to <2,300mg per day',
      'Include heart-healthy fats (olive oil, nuts, fatty fish)',
      'Reduce saturated fat and trans fats',
      'Eat plenty of fruits, vegetables, and whole grains',
    ],
    exercisePlan: [
      '150 minutes of moderate aerobic activity weekly',
      'Brisk walking, cycling, or swimming recommended',
      'Strength training 2-3 days per week',
    ],
    sleepAdvice: [
      '7-9 hours of quality sleep per night',
      'Sleep on left side if possible',
      'Avoid caffeine and alcohol before bed',
    ],
    stressManagement: [
      'Manage stress through relaxation techniques',
      'Join support groups for cardiac patients',
      'Consider counseling for anxiety or depression',
    ],
    followUpTests: [
      'Cholesterol panel every 4-6 weeks',
      'Blood pressure monitoring daily or weekly',
      'ECG annually or as recommended by cardiologist',
    ],
    additionalNotes: 'Heart disease management requires strict medication adherence and lifestyle modifications.',
  },

  kidney: {
    dietGuidance: [
      'Limit sodium intake to <2,300mg daily',
      'Control protein intake per nephrologist recommendation',
      'Limit phosphorus-rich foods',
      'Reduce potassium if advised',
      'Limit fluid intake based on kidney function',
    ],
    exercisePlan: [
      '150 minutes of moderate activity weekly',
      'Walking, swimming, or cycling recommended',
      'Avoid strenuous exercise without clearance',
    ],
    sleepAdvice: [
      'Sleep 7-8 hours consistently',
      'Manage sleep apnea if present',
      'Elevate legs while resting to reduce fluid retention',
    ],
    stressManagement: [
      'Meditation or yoga for stress relief',
      'Support groups for kidney disease patients',
      'Regular counseling or therapy',
    ],
    followUpTests: [
      'Serum creatinine every 3-6 months',
      'Urinalysis every 6 months',
      'Kidney ultrasound annually as needed',
    ],
    additionalNotes: 'Kidney disease requires close monitoring and dietary compliance to slow progression.',
  },

  stroke: {
    dietGuidance: [
      'Follow DASH diet to manage blood pressure',
      'Limit sodium to <2,300mg daily',
      'Include omega-3 rich fish 2-3 times weekly',
      'Reduce saturated fat intake',
      'Eat colorful vegetables and fruits daily',
    ],
    exercisePlan: [
      'Physical therapy as prescribed',
      'Gradual increase in activity (30 min daily)',
      'Balance and coordination exercises',
    ],
    sleepAdvice: [
      '7-9 hours of consistent sleep',
      'Sleep on side to prevent aspiration',
      'Manage sleep disturbances with specialist',
    ],
    stressManagement: [
      'Cognitive rehabilitation if needed',
      'Psychological support and counseling',
      'Relaxation techniques and meditation',
    ],
    followUpTests: [
      'Blood pressure monitoring daily',
      'Carotid ultrasound as recommended',
      'Regular neurological assessment',
    ],
    additionalNotes: 'Stroke prevention requires aggressive management of risk factors and rehabilitation.',
  },

  liver: {
    dietGuidance: [
      'Avoid alcohol completely',
      'Limit fat intake to 30% of daily calories',
      'Ensure adequate protein (per liver specialist)',
      'Reduce sodium if ascites present',
      'Include antioxidant-rich foods (berries, leafy greens)',
    ],
    exercisePlan: [
      'Moderate exercise as tolerated',
      'Avoid strenuous activity if cirrhosis present',
      'Yoga or stretching recommended',
    ],
    sleepAdvice: [
      '8-10 hours of sleep if fatigued',
      'Rest periods during the day as needed',
      'Maintain regular sleep schedule',
    ],
    stressManagement: [
      'Counseling for alcohol cessation if applicable',
      'Support groups for liver disease',
      'Stress-reduction techniques',
    ],
    followUpTests: [
      'Liver function tests monthly',
      'Ultrasound every 6-12 months',
      'AFP levels if cirrhosis present',
    ],
    additionalNotes: 'Liver disease management focuses on preventing progression and treating complications.',
  },

  thyroid: {
    dietGuidance: [
      'Ensure adequate iodine intake',
      'Eat selenium-rich foods (brazil nuts, seafood)',
      'Include zinc sources (oysters, beef, pumpkin seeds)',
      'Maintain consistent dietary habits',
      'Space medication 4 hours from calcium/iron supplements',
    ],
    exercisePlan: [
      '150 minutes of moderate activity weekly',
      'Regular walking or cycling',
      'Avoid overexertion if hyperthyroid',
    ],
    sleepAdvice: [
      '7-9 hours of consistent sleep',
      'Sleep schedule affects hormone levels',
      'Avoid caffeine after 2 PM',
    ],
    stressManagement: [
      'Stress affects thyroid function significantly',
      'Meditation or yoga daily',
      'Counseling for anxiety management',
    ],
    followUpTests: [
      'TSH level every 6-8 weeks after medication change',
      'Annual TSH monitoring once stable',
      'Free T4 if symptoms persist',
    ],
    additionalNotes: 'Thyroid disease requires consistent medication adherence and regular monitoring.',
  },

  autism: {
    dietGuidance: [
      'Ensure balanced nutrition with all food groups',
      'Consider dietary restrictions if sensory issues present',
      'Adequate vitamins and minerals especially B12 and D',
      'Support specialized diet preferences if not harmful',
      'Consult nutritionist for specific needs',
    ],
    exercisePlan: [
      'Physical activity suited to sensory sensitivities',
      'Sports or structured activities of interest',
      '60 minutes daily physical activity recommended',
      'Occupational therapy for motor skill development',
    ],
    sleepAdvice: [
      '8-10 hours of sleep for developmental support',
      'Consistent bedtime routine critical',
      'Sensory-friendly sleep environment',
    ],
    stressManagement: [
      'Behavioral therapy (ABA, CBT)',
      'Social skills training',
      'Sensory integration therapy',
    ],
    followUpTests: [
      'Developmental assessment every 6-12 months',
      'Speech/language evaluation as needed',
      'Mental health screening regularly',
    ],
    additionalNotes: 'Autism support focuses on developmental progress, early intervention, and family support.',
  },

  'autism-dl': {
    dietGuidance: [
      'Balanced nutrition for neurological development',
      'Focus on gut health (probiotics, fiber)',
      'Ensure adequate omega-3 intake',
      'Avoid ultra-processed foods',
      'Hydration and electrolyte balance important',
    ],
    exercisePlan: [
      '60+ minutes daily physical activity',
      'Structured movement therapy',
      'Sports tailored to ability level',
    ],
    sleepAdvice: [
      '8-10 hours of consistent sleep',
      'Sleep critical for brain development',
      'Melatonin if prescribed by doctor',
    ],
    stressManagement: [
      'Occupational and behavioral therapy',
      'Sensory diet customized to needs',
      'Mindfulness adapted for child',
    ],
    followUpTests: [
      'Developmental pediatrician visits quarterly',
      'Speech-language pathology evaluation every 6 months',
      'Imaging studies as recommended',
    ],
    additionalNotes: 'Developmental tracking and early intervention are key for optimal outcomes in child development.',
  },
};

@Injectable()
export class PreventionPlansService {
  private readonly logger = new Logger(PreventionPlansService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL') || 'http://ai-service:8001';
  }

  async generate(userId: string, forceDisease?: string) {
    // Gather patient context
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Patient not found');
    }

    const analyses = await this.prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const metrics = await this.prisma.healthMetric.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const diagnoses = [...new Set(analyses.map((a) => a.testName))];
    const primaryDisease = forceDisease || diagnoses[0];

    if (!primaryDisease) {
      throw new BadRequestException('No diagnoses found for patient');
    }

    const riskFactors = analyses
      .filter((a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL')
      .map((a) => `${a.testName}: ${a.riskLevel}`);

    // Call AI service for plan generation
    let aiPlan: any = null;
    let useAiFallback = false;

    try {
      this.logger.log(`Requesting AI prevention plan for ${primaryDisease}...`);

      const resp = await axios.post(
        `${this.aiServiceUrl}/api/v1/prevention-plan/generate`,
        {
          patient: { age: user.age, gender: user.gender, medicalBackground: user.medicalBackground },
          diagnoses,
          riskFactors,
          labValues: Object.fromEntries(metrics.map((m) => [m.metricKey, m.value])),
        },
        { timeout: 30000 },
      );

      aiPlan = resp.data;
      this.logger.log(`AI prevention plan generated for ${primaryDisease}`);
    } catch (err: any) {
      this.logger.warn(
        `AI prevention plan generation failed for ${primaryDisease}: ${err.message}. Using fallback.`,
      );
      useAiFallback = true;
    }

    // Use fallback plan if AI failed or for diseases not yet supported by AI
    if (!aiPlan || useAiFallback) {
      const normalizedDisease = primaryDisease.toLowerCase().replace(/\s+/g, '');
      aiPlan = DISEASE_PREVENTION_PLANS[normalizedDisease] ||
        DISEASE_PREVENTION_PLANS[primaryDisease.toLowerCase()] || {
          dietGuidance: ['Maintain a balanced diet with all food groups'],
          exercisePlan: ['150 minutes of moderate exercise weekly'],
          sleepAdvice: ['Maintain 7-9 hours of quality sleep'],
          stressManagement: ['Practice stress-reduction techniques'],
          followUpTests: ['Schedule regular check-ups every 6 months'],
          additionalNotes: 'Consult with your healthcare provider for personalized recommendations.',
        };
    }

    // Create prevention plan
    const plan = await this.prisma.preventionPlan.create({
      data: {
        userId,
        diagnoses,
        riskFactors,
        labValues: metrics.length > 0
          ? Object.fromEntries(metrics.map((m) => [m.metricKey, m.value]))
          : undefined,
        dietGuidance: aiPlan.dietGuidance || [],
        exercisePlan: aiPlan.exercisePlan || [],
        sleepAdvice: aiPlan.sleepAdvice || [],
        stressManagement: aiPlan.stressManagement || [],
        followUpTests: aiPlan.followUpTests || [],
        additionalNotes: aiPlan.additionalNotes,
        generatedBy: useAiFallback ? 'fallback' : 'ai',
      },
    });

    // Create history event
    await this.notifications.recordHistoryEvent(
      userId,
      'PREVENTION_PLAN',
      'Prevention Plan Created',
      `Personalized prevention plan generated for ${diagnoses.join(', ')}`,
      plan.id,
    );

    // Notify patient about new plan
    await this.notifications.notify({
      userId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Your Prevention Plan is Ready',
      message: `A personalized prevention plan has been created based on your health data. Review it to understand your care strategy.`,
      channels: ['in_app', 'email'],
      data: { planId: plan.id, diseases: diagnoses },
      relatedId: plan.id,
    });

    this.logger.log(`Prevention plan created: ${plan.id} for user ${userId}`);

    return plan;
  }

  async getActivePlan(userId: string) {
    return this.prisma.preventionPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllPlans(userId: string) {
    return this.prisma.preventionPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivatePlan(planId: string) {
    return this.prisma.preventionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });
  }

  async updatePlan(planId: string, updates: Partial<any>) {
    return this.prisma.preventionPlan.update({
      where: { id: planId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get default prevention plan template for a disease
   */
  getDefaultPlan(disease: string): DiseasePreventionPlan | null {
    const normalized = disease.toLowerCase().replace(/\s+/g, '');
    return DISEASE_PREVENTION_PLANS[normalized] || DISEASE_PREVENTION_PLANS[disease.toLowerCase()] || null;
  }

  /**
   * Get all available disease prevention templates
   */
  getAllTemplates(): Record<string, DiseasePreventionPlan> {
    return DISEASE_PREVENTION_PLANS;
  }
}
