const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (use with caution in development only)
  await prisma.log.deleteMany({});
  await prisma.prediction.deleteMany({});
  await prisma.medicalReport.deleteMany({});
  await prisma.user.deleteMany({});

  // Create test users
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
      name: 'Dr. John Smith',
      email: 'doctor@medai.local',
      password: doctorPassword,
      role: 'DOCTOR',
    },
  });

  const patient = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'patient@medai.local',
      password: patientPassword,
      role: 'PATIENT',
    },
  });

  // Create test medical report
  const report = await prisma.medicalReport.create({
    data: {
      userId: patient.id,
      fileUrl: 's3://medai-nexus-reports/patient-report-001.pdf',
      fileName: 'Chest X-Ray Report',
      extractedData: {
        reportType: 'Chest X-Ray',
        date: '2024-04-17',
        findings: 'Normal',
      },
    },
  });

  // Create test prediction
  const prediction = await prisma.prediction.create({
    data: {
      reportId: report.id,
      userId: doctor.id,
      disease: 'Normal',
      confidence: 0.98,
      explanation: 'No abnormalities detected in chest X-ray',
      metadata: {
        modelVersion: '1.0.0',
        processingTime: '2.5s',
      },
    },
  });

  // Create test logs
  await prisma.log.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_INIT',
      metadata: { event: 'Database seeding completed' },
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log('📝 Test Users:');
  console.log(`  Admin: admin@medai.local / admin123`);
  console.log(`  Doctor: doctor@medai.local / doctor123`);
  console.log(`  Patient: patient@medai.local / patient123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
