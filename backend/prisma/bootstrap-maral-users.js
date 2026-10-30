const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function upsertUser({ name, email, password, cedula, role }) {
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, password: hash, cedula, role, active: true },
    create: { name, email, password: hash, cedula, role, active: true },
  });
  console.log(`ok ${email} ${role}`);
}

async function main() {
  await upsertUser({
    name: 'Janet',
    email: 'user14@example.com',
    password: 'CHANGE_ME',
    cedula: '90000004',
    role: 'CONTADORA',
  });

  await upsertUser({
    name: 'John Monoga',
    email: 'user18@example.com',
    password: 'CHANGE_ME',
    cedula: '90000005',
    role: 'GERENTE',
  });

  await upsertUser({
    name: 'Wilson',
    email: 'user39@example.com',
    password: 'CHANGE_ME',
    cedula: '90000003',
    role: 'VENTAS',
  });

  await upsertUser({
    name: 'Iván',
    email: 'user13@example.com',
    password: 'CHANGE_ME',
    cedula: '90000002',
    role: 'LOGISTICA',
  });

  await prisma.user.updateMany({
    where: { email: { in: ['user21@example.com', 'user02@example.com', 'user29@example.com', 'user28@example.com', 'user15@example.com'] } },
    data: { active: false },
  });
  console.log('Old users disabled');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
