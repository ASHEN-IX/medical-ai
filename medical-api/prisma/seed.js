const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear in reverse dependency order
  await prisma.message.deleteMany({});
  await prisma.doctorReview.deleteMany({});
  await prisma.doctorRequest.deleteMany({});
  await prisma.healthMetric.deleteMany({});
  await prisma.log.deleteMany({});
  await prisma.prediction.deleteMany({});
  await prisma.analysis.deleteMany({});
  await prisma.medicalReport.deleteMany({});
  await prisma.doctorProfile.deleteMany({});
  await prisma.user.deleteMany({});

  const adminPassword = await bcrypt.hash('admin123', 10);
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  const patientPassword = await bcrypt.hash('patient123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@medai.local',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const doctor = await prisma.user.create({
    data: {
      name: 'Dr. Sarah Chen (Internal Medicine)',
      email: 'doctor@medai.local',
      password: doctorPassword,
      role: 'DOCTOR',
      age: 38,
      gender: 'FEMALE',
    },
  });

  await prisma.doctorProfile.create({
    data: {
      userId: doctor.id,
      specialty: 'Internal Medicine',
      licenseNo: 'MD-2024-001',
      verified: true,
      bio: 'Board-certified internist with 12 years of experience in diagnostic medicine.',
      availableFrom: '09:00',
      availableTo: '17:00',
      maxCaseload: 20,
      currentCaseload: 0,
    },
  });

  const doctor2 = await prisma.user.create({
    data: {
      name: 'Dr. Michael Park (Cardiology)',
      email: 'doctor2@medai.local',
      password: doctorPassword,
      role: 'DOCTOR',
      age: 45,
      gender: 'MALE',
    },
  });

  await prisma.doctorProfile.create({
    data: {
      userId: doctor2.id,
      specialty: 'Cardiology',
      licenseNo: 'MD-2024-002',
      verified: true,
      bio: 'Cardiologist specializing in preventive heart disease management.',
      availableFrom: '08:00',
      availableTo: '16:00',
      maxCaseload: 15,
      currentCaseload: 0,
    },
  });

  // Additional specialists for auto-assignment
  const specialistData = [
    { name: 'Dr. Lisa Wong', email: 'nephrologist@medai.local', specialty: 'Nephrology', license: 'MD-2024-003', bio: 'Nephrologist specializing in chronic kidney disease.' },
    { name: 'Dr. James Rivera', email: 'endocrinologist@medai.local', specialty: 'Endocrinology', license: 'MD-2024-004', bio: 'Endocrinologist expert in diabetes and thyroid disorders.' },
    { name: 'Dr. Aisha Patel', email: 'neurologist@medai.local', specialty: 'Neurology', license: 'MD-2024-005', bio: 'Neurologist focused on stroke prevention and treatment.' },
    { name: 'Dr. Omar Hassan', email: 'hepatologist@medai.local', specialty: 'Hepatology', license: 'MD-2024-006', bio: 'Hepatologist specializing in liver disease management.' },
    { name: 'Dr. Emily Chen', email: 'psychiatrist@medai.local', specialty: 'Developmental Pediatrics', license: 'MD-2024-007', bio: 'Developmental pediatrician specializing in autism spectrum disorders.' },
  ];

  for (const spec of specialistData) {
    const specUser = await prisma.user.create({
      data: { name: `${spec.name} (${spec.specialty})`, email: spec.email, password: doctorPassword, role: 'DOCTOR' },
    });
    await prisma.doctorProfile.create({
      data: {
        userId: specUser.id,
        specialty: spec.specialty,
        licenseNo: spec.license,
        verified: true,
        bio: spec.bio,
        availableFrom: '09:00',
        availableTo: '17:00',
        maxCaseload: 15,
        currentCaseload: 0,
      },
    });
  }

  const patient = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'patient@medai.local',
      password: patientPassword,
      role: 'PATIENT',
      age: 34,
      gender: 'FEMALE',
      medicalBackground: 'Family history of diabetes. No known allergies.',
    },
  });

  const patient2 = await prisma.user.create({
    data: {
      name: 'Alex Johnson',
      email: 'patient2@medai.local',
      password: patientPassword,
      role: 'PATIENT',
      age: 52,
      gender: 'MALE',
      medicalBackground: 'Hypertension, managed with medication since 2019.',
    },
  });

  // Create sample analyses
  const analysis1 = await prisma.analysis.create({
    data: {
      userId: patient.id,
      testName: 'diabetes',
      selectedModels: ['diabetes', 'heart'],
      features: { glucose: 180, blood_pressure: 140, cholesterol: 220, age: 34 },
      symptoms: ['fatigue', 'blurred vision'],
      results: {
        diabetes: { risk: 'HIGH', confidence: 0.87 },
        heart: { risk: 'MEDIUM', confidence: 0.62 },
      },
      healthScore: 55,
      riskLevel: 'HIGH',
      keyFindings: [
        'High risk detected by diabetes model (87% confidence)',
        'Elevated glucose levels at 180 mg/dL',
        'Blood pressure above normal range',
      ],
      aiInsights: 'Based on your glucose level of 180 mg/dL and reported symptoms of fatigue and blurred vision, there is an elevated risk of diabetes. Your blood pressure of 140 mmHg also suggests cardiovascular monitoring is advisable.',
      status: 'COMPLETED',
    },
  });

  const analysis2 = await prisma.analysis.create({
    data: {
      userId: patient2.id,
      testName: 'heart',
      selectedModels: ['heart', 'stroke', 'kidney'],
      features: { blood_pressure: 165, cholesterol: 280, age: 52 },
      symptoms: ['chest pain', 'shortness of breath'],
      results: {
        heart: { risk: 'HIGH', confidence: 0.91 },
        stroke: { risk: 'MEDIUM', confidence: 0.58 },
        kidney: { risk: 'LOW', confidence: 0.22 },
      },
      healthScore: 38,
      riskLevel: 'HIGH',
      keyFindings: [
        'High cardiovascular risk detected (91% confidence)',
        'Severely elevated cholesterol at 280 mg/dL',
        'Hypertensive blood pressure at 165 mmHg',
      ],
      aiInsights: 'Critical cardiovascular indicators detected. Cholesterol at 280 mg/dL and blood pressure at 165 mmHg significantly increase risk of heart disease. Immediate medical consultation recommended.',
      status: 'COMPLETED',
    },
  });

  // Create health metrics for timeline
  const metricData = [
    { userId: patient.id, metricKey: 'glucose', value: 160, source: 'analysis' },
    { userId: patient.id, metricKey: 'glucose', value: 175, source: 'analysis' },
    { userId: patient.id, metricKey: 'glucose', value: 180, source: 'analysis' },
    { userId: patient.id, metricKey: 'cholesterol', value: 200, source: 'analysis' },
    { userId: patient.id, metricKey: 'cholesterol', value: 220, source: 'analysis' },
    { userId: patient.id, metricKey: 'blood_pressure', value: 130, source: 'analysis' },
    { userId: patient.id, metricKey: 'blood_pressure', value: 140, source: 'analysis' },
  ];

  for (const m of metricData) {
    await prisma.healthMetric.create({ data: m });
  }

  // Create a doctor request (auto-generated due to HIGH risk)
  await prisma.doctorRequest.create({
    data: {
      patientId: patient2.id,
      doctorId: doctor.id,
      analysisId: analysis2.id,
      urgency: 'URGENT',
      status: 'ASSIGNED',
      notes: 'Auto-generated: HIGH risk detected by AI system',
    },
  });

  // Create a sample doctor review
  await prisma.doctorReview.create({
    data: {
      doctorId: doctor.id,
      analysisId: analysis1.id,
      diagnosis: 'Pre-diabetic condition with insulin resistance indicators',
      notes: 'Patient shows classic pre-diabetic markers. Recommend lifestyle intervention before medication.',
      recommendations: [
        'Reduce refined sugar intake',
        'Exercise 30 min daily',
        'Follow-up fasting glucose test in 3 months',
        'Consider HbA1c test',
      ],
      aiApproved: true,
    },
  });

  // Update analysis status to REVIEWED
  await prisma.analysis.update({
    where: { id: analysis1.id },
    data: { status: 'REVIEWED' },
  });

  // Create sample messages
  await prisma.message.create({
    data: {
      senderId: doctor.id,
      receiverId: patient.id,
      content: 'Hello Jane, I reviewed your recent analysis. Your glucose levels are concerning but manageable with lifestyle changes. Let me know if you have questions.',
      read: false,
    },
  });

  // Logs
  await prisma.log.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_INIT',
      metadata: { event: 'Database seeding completed' },
    },
  });

  console.log('Seeding completed successfully!');
  console.log('Test Users:');
  console.log('  Admin: admin@medai.local / admin123');
  console.log('  Doctor: doctor@medai.local / doctor123');
  console.log('  Doctor 2: doctor2@medai.local / doctor123');
  console.log('  Patient: patient@medai.local / patient123');
  console.log('  Patient 2: patient2@medai.local / patient123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
