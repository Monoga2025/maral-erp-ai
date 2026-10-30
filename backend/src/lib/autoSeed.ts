import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { syncCatalog } from './sync_catalog';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

export async function ensureSeedData() {
  try {
    console.log('🔄 Verificando y sincronizando equipo oficial de MARAL OS...');
    // Sync official product catalog
    await syncCatalog();
    const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'change-me', SALT_ROUNDS);

    // 1. John Mónoga (Gerente General)
    const gerente = await prisma.user.upsert({
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

    // 2. Wilson (Ventas & Mercadeo)
    const ventas = await prisma.user.upsert({
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

    // 3. Iván (Producción & Logística)
    const logistica = await prisma.user.upsert({
      where: { email: 'user13@example.com' },
      update: {
        name: 'Iván',
        role: 'LOGISTICA',
        title: 'Encargado de Producción & Logística',
        phone: '3000000024',
        whatsapp: '573000000024',
        cedula: '90000001',
        active: true,
      },
      create: {
        name: 'Iván',
        email: 'user13@example.com',
        password: passwordHash,
        role: 'LOGISTICA',
        title: 'Encargado de Producción & Logística',
        phone: '3000000024',
        whatsapp: '573000000024',
        cedula: '90000001',
        active: true,
      },
    });

    // 4. Janet (Contabilidad)
    const contabilidad = await prisma.user.upsert({
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

    // Desactivar Lady y Angelo (y cualquier cuenta obsoleta)
    const ladyUser = await prisma.user.findFirst({ where: { email: 'user21@example.com' } });
    if (ladyUser) {
      await prisma.task.updateMany({
        where: { assignedToId: ladyUser.id },
        data: { assignedToId: ventas.id },
      });
      await prisma.user.update({
        where: { id: ladyUser.id },
        data: { active: false },
      });
    }

    const angeloUser = await prisma.user.findFirst({ where: { email: 'user02@example.com' } });
    if (angeloUser) {
      await prisma.task.updateMany({
        where: { assignedToId: angeloUser.id },
        data: { assignedToId: logistica.id },
      });
      await prisma.user.update({
        where: { id: angeloUser.id },
        data: { active: false },
      });
    }

    // Desactivar cualquier otro usuario antiguo
    await prisma.user.updateMany({
      where: {
        email: {
          in: ['user15@example.com', 'user28@example.com', 'user29@example.com'],
        },
      },
      data: { active: false },
    });

    console.log('✅ Equipo oficial sincronizado en BD: John Mónoga, Wilson, Iván y Janet.');

    // Seed de clientes/productos si la BD está completamente vacía de clientes
    const clientCount = await prisma.client.count();
    if (clientCount === 0) {
      console.log('🌱 Creando clientes iniciales...');
      const meltec = await prisma.client.create({
        data: {
          name: 'Carlos Méndez',
          company: 'Meltec S.A.S.',
          rut: '900123456-1',
          city: 'Bogotá',
          department: 'Cundinamarca',
          phone: '3000000005',
          whatsapp: '573000000005',
          email: 'user04@example.com',
          address: 'Calle 72 #15-30 Of. 401',
          category: 'FUNDADOR_HISTORICO',
          howFound: 'Referido',
          allowWhiteLabel: true,
          creditLimit: 15000000,
          paymentDays: 30,
        },
      });

      const radioenlaces = await prisma.client.create({
        data: {
          name: 'Mauricio Gómez',
          company: 'Radioenlaces de Colombia Ltda.',
          rut: '900987654-3',
          city: 'Medellín',
          department: 'Antioquia',
          phone: '3000000021',
          whatsapp: '573000000021',
          email: 'user24@example.com',
          address: 'Cra 43A #1-50',
          category: 'A_MAYORISTA',
          howFound: 'Web',
          allowWhiteLabel: false,
          creditLimit: 8000000,
          paymentDays: 15,
        },
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 12);
      await prisma.invoice.create({
        data: {
          clientId: meltec.id,
          amount: 4500000,
          dueDate: pastDate,
          status: 'VENCIDA',
          merlinRef: 'FAC-2026-089',
        },
      });

      const pastDate2 = new Date();
      pastDate2.setDate(pastDate2.getDate() - 5);
      await prisma.invoice.create({
        data: {
          clientId: radioenlaces.id,
          amount: 3200000,
          dueDate: pastDate2,
          status: 'VENCIDA',
          merlinRef: 'FAC-2026-094',
        },
      });

      const dipolo = await prisma.product.create({
        data: {
          reference: 'MAR-DIP-VHF-2B',
          name: 'Arreglo 2 Dipolos Enfasados VHF 136-174 MHz',
          category: 'ESTACION_BASE',
          priceList: 490000,
          priceDistributor: 420000,
          cost: 210000,
          stock: 8,
          minStock: 3,
          unit: 'und',
        },
      });

      await prisma.productionOrder.create({
        data: {
          productId: dipolo.id,
          qty: 4,
          phase: 'PREENSAMBLE',
          status: 'EN_PROCESO',
          assignedTo: logistica.id,
          notes: 'Corte de tubo y conectorizado de arnés para Meltec S.A.S.',
        },
      });
    }

    // Crear tareas base si no hay tareas
    const taskCount = await prisma.task.count();
    if (taskCount === 0) {
      await prisma.task.createMany({
        data: [
          {
            title: 'Llamar a cliente Ferretería López',
            priority: 'URGENTE',
            status: 'PENDIENTE',
            createdById: gerente.id,
            assignedToId: gerente.id,
            dueDate: new Date(Date.now() + 86400000),
          },
          {
            title: 'Seguimiento a cotizaciones abiertas y prospectos de telecomunicaciones',
            priority: 'NORMAL',
            status: 'PENDIENTE',
            createdById: gerente.id,
            assignedToId: ventas.id,
            dueDate: new Date(Date.now() + 86400000 * 2),
          },
          {
            title: 'Control de calidad en ensamble de antenas y verificación de stock',
            priority: 'NORMAL',
            status: 'PENDIENTE',
            createdById: gerente.id,
            assignedToId: logistica.id,
            dueDate: new Date(Date.now() + 86400000),
          },
          {
            title: 'Conciliación bancaria y revisión de cartera semanal',
            priority: 'URGENTE',
            status: 'PENDIENTE',
            createdById: gerente.id,
            assignedToId: contabilidad.id,
            dueDate: new Date(Date.now() + 86400000 * 2),
          },
        ],
      });
      console.log('✅ Tareas iniciales creadas para el equipo.');
    }
  } catch (error) {
    console.error('⚠️ Error al verificar/crear datos iniciales:', error);
  }
}
