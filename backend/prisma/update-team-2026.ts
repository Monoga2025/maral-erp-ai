import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Actualizando usuarios de MARAL OS...');
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'change-me', 10);

  // 1. John Monoga (Gerente General)
  const john = await prisma.user.upsert({
    where: { email: 'user18@example.com' },
    update: {
      name: 'John Mónoga',
      role: 'GERENTE',
      title: 'Gerente General',
      phone: '3000000030',
      whatsapp: '573000000030',
      cedula: '90000005',
      active: true,
    },
    create: {
      name: 'John Mónoga',
      email: 'user18@example.com',
      password: passwordHash,
      role: 'GERENTE',
      title: 'Gerente General',
      phone: '3000000030',
      whatsapp: '573000000030',
      cedula: '90000005',
      active: true,
    },
  });
  console.log('✅ John Monoga (Gerente):', john.id);

  // 2. Iván (Producción / Logística)
  const ivan = await prisma.user.upsert({
    where: { email: 'user13@example.com' },
    update: {
      name: 'Iván',
      role: 'LOGISTICA',
      title: 'Encargado de Producción & Logística',
      phone: '3000000030',
      whatsapp: '573000000030',
      cedula: '90000002',
      active: true,
    },
    create: {
      name: 'Iván',
      email: 'user13@example.com',
      password: passwordHash,
      role: 'LOGISTICA',
      title: 'Encargado de Producción & Logística',
      phone: '3000000030',
      whatsapp: '573000000030',
      cedula: '90000002',
      active: true,
    },
  });
  console.log('✅ Iván (Producción):', ivan.id);

  // 3. Wilson (Ventas & Mercadeo)
  const wilson = await prisma.user.upsert({
    where: { email: 'user39@example.com' },
    update: {
      name: 'Wilson',
      role: 'VENTAS',
      title: 'Encargado de Ventas & Mercadeo',
      phone: '3000000024',
      whatsapp: '573000000024',
      cedula: '90000003',
      active: true,
    },
    create: {
      name: 'Wilson',
      email: 'user39@example.com',
      password: passwordHash,
      role: 'VENTAS',
      title: 'Encargado de Ventas & Mercadeo',
      phone: '3000000024',
      whatsapp: '573000000024',
      cedula: '90000003',
      active: true,
    },
  });
  console.log('✅ Wilson (Ventas/Mercadeo):', wilson.id);

  // 4. Janet (Contabilidad)
  const janet = await prisma.user.upsert({
    where: { email: 'user14@example.com' },
    update: {
      name: 'Janet',
      role: 'CONTADORA',
      title: 'Encargada de Contabilidad',
      phone: '3000000023',
      whatsapp: '573000000023',
      cedula: '90000004',
      active: true,
    },
    create: {
      name: 'Janet',
      email: 'user14@example.com',
      password: passwordHash,
      role: 'CONTADORA',
      title: 'Encargada de Contabilidad',
      phone: '3000000023',
      whatsapp: '573000000023',
      cedula: '90000004',
      active: true,
    },
  });
  console.log('✅ Janet (Contabilidad):', janet.id);

  // Reasignar tareas antiguas de Lady -> Wilson, y de Angelo -> Iván
  const ladyUser = await prisma.user.findFirst({ where: { email: 'user21@example.com' } });
  if (ladyUser) {
    const reassignedLady = await prisma.task.updateMany({
      where: { assignedToId: ladyUser.id },
      data: { assignedToId: wilson.id },
    });
    console.log(`📌 ${reassignedLady.count} tareas de Lady reasignadas a Wilson.`);
    await prisma.user.update({
      where: { id: ladyUser.id },
      data: { active: false },
    });
    console.log('🚫 Usuario Lady desactivado.');
  }

  const angeloUser = await prisma.user.findFirst({ where: { email: 'user02@example.com' } });
  if (angeloUser) {
    const reassignedAngelo = await prisma.task.updateMany({
      where: { assignedToId: angeloUser.id },
      data: { assignedToId: ivan.id },
    });
    console.log(`📌 ${reassignedAngelo.count} tareas de Angelo reasignadas a Iván.`);
    await prisma.user.update({
      where: { id: angeloUser.id },
      data: { active: false },
    });
    console.log('🚫 Usuario Angelo desactivado.');
  }

  // Desactivar cualquier otro usuario antiguo que no corresponda
  const oldUsers = await prisma.user.findMany({
    where: {
      email: {
        in: ['user15@example.com', 'user28@example.com', 'user29@example.com'],
      },
    },
  });
  for (const ou of oldUsers) {
    await prisma.user.update({
      where: { id: ou.id },
      data: { active: false },
    });
  }

  console.log('🎉 Actualización de usuarios y tareas completada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error al actualizar usuarios:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
