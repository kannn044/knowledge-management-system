import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Seed Roles ─────────────────────────────────────────────────
  const roles = [
    { id: 1, name: 'admin', description: 'Full system access' },
    { id: 2, name: 'staff', description: 'Can upload and manage documents' },
    { id: 3, name: 'viewer', description: 'Read-only access to documents and search' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles seeded');

  // ─── Seed Admin User ─────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  await prisma.user.upsert({
    where: { email: 'admin@kms.local' },
    update: {},
    create: {
      email: 'admin@kms.local',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      roleId: 1,
      status: 'active',
      emailVerified: true,
    },
  });
  console.log('✅ Admin user seeded: admin@kms.local / Admin@123456');
  console.log('⚠️  Change admin password immediately after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
