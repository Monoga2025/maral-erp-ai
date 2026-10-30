import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import evolutionApi from '../lib/evolutionApi';

const router = Router();
router.use(authenticate);

// Resolver `:id` — acepta cuid o número secuencial (ej. /pedidos/7)
router.param('id', async (req, res, next, raw: string) => {
  if (!/^\d+$/.test(raw)) return next();
  try {
    const found = await prisma.order.findFirst({
      where: { number: parseInt(raw, 10) },
      select: { id: true },
    });
    if (!found) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    req.params.id = found.id;
    next();
  } catch (error) {
    console.error('Resolve order id error:', error);
    res.status(500).json({ error: 'Error al resolver pedido' });
  }
});

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes[extension] === file.mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
    }
  },
});

const orderItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().min(0.01),
  unitPrice: z.number().min(0),
});

const orderSchema = z.object({
  quotationId: z.string().optional(),
  clientId: z.string().min(1, 'Cliente requerido'),
  confirmed: z.boolean().optional().default(false),
  recipientName: z.string().min(1, 'Nombre del destinatario requerido'),
  address: z.string().min(1, 'Dirección requerida'),
  city: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  carrier: z.string().optional().default(''),
  freightPayer: z.string().optional().default('Remitente'),
  freightPayment: z.string().optional().default(''),
  type: z.enum(['PEDIDO', 'GARANTIA', 'MUESTRA']).optional().default('PEDIDO'),
  notes: z.string().optional(),
  sourceCampaignId: z.string().optional(),
  forceCreditExceeded: z.boolean().optional(),
  items: z.array(orderItemSchema).min(1, 'Al menos un ítem requerido'),
});

// GET /api/orders/check-duplicate (must be before /:id)
router.get('/check-duplicate', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.query.clientId as string;
    if (!clientId) {
      res.status(400).json({ error: 'clientId requerido' });
      return;
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pendingOrder = await prisma.order.findFirst({
      where: {
        clientId,
        confirmed: false,
        status: 'CONFIRMADO',
        createdAt: { gte: threeDaysAgo },
      },
      select: { id: true, number: true, createdAt: true },
    });

    res.json({ hasDuplicate: !!pendingOrder, order: pendingOrder });
  } catch (error) {
    console.error('Check duplicate error:', error);
    res.status(500).json({ error: 'Error al verificar duplicados' });
  }
});

// GET /api/orders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt((req.query.pageSize || req.query.limit) as string) || 20;
    const status = req.query.status as string;
    const clientId = req.query.clientId as string;
    const search = req.query.search as string;
    const kanban = req.query.kanban === 'true';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.OR = [
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { guideNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (kanban) {
      // Return grouped by status for kanban view
      const statuses = ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
      const grouped: Record<string, unknown[]> = {};

      await Promise.all(
        statuses.map(async (s) => {
          const orders = await prisma.order.findMany({
            where: { ...where, status: s as never },
            orderBy: { createdAt: 'desc' },
            include: {
              client: { select: { id: true, name: true, city: true } },
              _count: { select: { items: true } },
            },
          });
          grouped[s] = orders;
        })
      );

      res.json(grouped);
      return;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, city: true } },
          _count: { select: { items: true, photos: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/orders/:id  (acepta cuid o número secuencial, ver router.param)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        quotation: { select: { id: true, number: true } },
        updatedBy: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, reference: true, name: true, unit: true, stock: true },
            },
          },
        },
        photos: { orderBy: { uploadedAt: 'asc' } },
        productionOrders: {
          include: {
            product: { select: { id: true, reference: true, name: true } },
            assignedUser: { select: { id: true, name: true } },
          },
        },
        invoices: { select: { id: true, number: true, amount: true, status: true, dueDate: true } },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// POST /api/orders
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validation = orderSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Datos inválidos', details: validation.error.flatten() });
      return;
    }

    const { items, sourceCampaignId, forceCreditExceeded, ...rest } = validation.data;
    const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

    // Credit limit validation (OBJ-012)
    const client = await prisma.client.findUnique({
      where: { id: rest.clientId },
      select: { creditLimit: true, factoringStatus: true, name: true },
    });

    if (client?.factoringStatus === 'RECHAZADO' && !forceCreditExceeded) {
      res.status(403).json({
        error: 'Cliente con factoring/crédito RECHAZADO. Requiere pago de contado o autorización.',
        code: 'CREDIT_BLOCKED',
      });
      return;
    }

    if (client && client.creditLimit > 0 && !forceCreditExceeded) {
      const unpaidAgg = await prisma.invoice.aggregate({
        where: { clientId: rest.clientId, status: { in: ['VIGENTE', 'VENCIDA'] } },
        _sum: { amount: true },
      });
      const currentCreditUsed = Number(unpaidAgg._sum.amount ?? 0);
      if (currentCreditUsed + total > client.creditLimit) {
        res.status(400).json({
          error: `Cupo de crédito excedido: Usado $${Math.round(currentCreditUsed).toLocaleString('es-CO')} + Pedido $${Math.round(total).toLocaleString('es-CO')} supera el límite de $${Math.round(client.creditLimit).toLocaleString('es-CO')}`,
          code: 'CREDIT_LIMIT_EXCEEDED',
          creditLimit: client.creditLimit,
          creditUsed: currentCreditUsed,
          orderTotal: total,
        });
        return;
      }
    }

    const order = await prisma.order.create({
      data: {
        ...rest,
        total,
        sourceCampaignId: sourceCampaignId ?? null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, reference: true, name: true } } } },
      },
    });

    // Update client's lastOrderAt (OBJ-015)
    await prisma.client.update({
      where: { id: rest.clientId },
      data: { lastOrderAt: new Date() },
    }).catch((err) => console.error('Error updating lastOrderAt:', err));

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Order',
        entityId: order.id,
        metadata: { number: order.number, total, clientId: order.clientId },
      },
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Error al crear pedido' });
  }
});

// PUT /api/orders/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      status: z.enum(['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO']).optional(),
      confirmed: z.boolean().optional(),
      guideNumber: z.string().optional(),
      dianInvoiceNumber: z.string().optional(),
      dispatchDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      recipientName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      carrier: z.string().optional(),
      freightPayer: z.string().optional(),
      freightPayment: z.string().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Datos inválidos', details: validation.error.flatten() });
      return;
    }

    const { dispatchDate, ...rest } = validation.data;

    const order = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!existing) throw new Error('ORDER_MISSING');
      if ((rest.status === 'DESPACHADO' || rest.status === 'ENTREGADO') && rest.status !== existing.status) {
        throw new Error('ORDER_DISPATCH_FLOW_REQUIRED');
      }
      if (['DESPACHO_PARCIAL', 'DESPACHADO'].includes(existing.status) && rest.status &&
          ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO'].includes(rest.status)) {
        throw new Error('ORDER_DISPATCHED_BACKWARD');
      }
      if ((existing.status === 'CANCELADO' || existing.status === 'ENTREGADO') && rest.status && rest.status !== existing.status) {
        throw new Error(`ORDER_TERMINAL:${existing.status}`);
      }

      return tx.order.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          dispatchDate: dispatchDate ? new Date(dispatchDate) : undefined,
        },
        include: {
          client: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, reference: true, name: true } } } },
        },
      });
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'Order',
        entityId: order.id,
        metadata: { status: order.status },
      },
    });

    res.json(order);
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_MISSING') {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    if (error instanceof Error && error.message === 'ORDER_DISPATCH_FLOW_REQUIRED') {
      res.status(400).json({ error: 'Use el flujo de despachos para validar cantidades y entrega' });
      return;
    }
    if (error instanceof Error && error.message === 'ORDER_DISPATCHED_BACKWARD') {
      res.status(400).json({ error: 'No se puede retroceder un pedido ya despachado' });
      return;
    }
    if (error instanceof Error && error.message.startsWith('ORDER_TERMINAL:')) {
      const status = error.message.slice('ORDER_TERMINAL:'.length);
      res.status(400).json({ error: `No se puede reabrir un pedido en estado ${status}` });
      return;
    }
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status, guideNumber, dispatchDate, creditDispatch, dianInvoiceNumber } = req.body;
    const validStatuses = ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Estado inválido' });
      return;
    }

    const { order, statusChanged } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!existing) throw new Error('ORDER_MISSING');
      if ((status === 'DESPACHADO' || status === 'ENTREGADO') && status !== existing.status) {
        throw new Error('ORDER_DISPATCH_FLOW_REQUIRED');
      }
      if (['DESPACHO_PARCIAL', 'DESPACHADO'].includes(existing.status) &&
          ['CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'EMPACADO'].includes(status)) {
        throw new Error('ORDER_DISPATCHED_BACKWARD');
      }
      if ((existing.status === 'CANCELADO' || existing.status === 'ENTREGADO') && status !== existing.status) {
        throw new Error(`ORDER_TERMINAL:${existing.status}`);
      }

      const statusChanged = status !== existing.status;
      if (!statusChanged) return { order: null, statusChanged };

      const order = await tx.order.update({
        where: { id: req.params.id },
        data: {
          status: status as never,
          updatedById: req.user!.userId,
          ...(guideNumber !== undefined ? { guideNumber } : {}),
          ...(dispatchDate ? { dispatchDate: new Date(dispatchDate) } : {}),
          ...(dianInvoiceNumber !== undefined ? { dianInvoiceNumber } : {}),
        },
      });
      return { order, statusChanged };
    });

    if (!statusChanged) {
      res.json(order);
      return;
    }

    if (status === 'DESPACHADO' && creditDispatch) {
      const client = await prisma.client.findUnique({
        where: { id: order.clientId },
        select: { paymentDays: true },
      });
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (client?.paymentDays || 30));
      const existingInvoice = await prisma.invoice.findFirst({ where: { orderId: order.id } });
      if (existingInvoice) {
        await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: { amount: order.total, dueDate, clientId: order.clientId },
        });
      } else {
        await prisma.invoice.create({
          data: { orderId: order.id, clientId: order.clientId, amount: order.total, dueDate },
        });
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'Order',
        entityId: order.id,
        metadata: { status: order.status },
      },
    });

    // Notificaciones WhatsApp (fire-and-forget)
    // Order tiene phone/recipientName propios; para datos de cliente/seller hacemos query puntual
    const recipientPhone = order.phone ?? null;
    const recipientName  = order.recipientName ?? '';

    if (status === 'DESPACHADO') {
      evolutionApi.notifyOrderDispatched(recipientPhone, recipientName, order.number, order.carrier ?? '', guideNumber);
    } else if (status === 'LISTO') {
      // Notifica al asesor comercial (via seller del pedido o del user actual)
      const sellerUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true, whatsapp: true, phone: true },
      });
      const sellerPhone = sellerUser?.whatsapp ?? sellerUser?.phone ?? null;
      const clientSnap  = await prisma.client.findUnique({
        where: { id: order.clientId },
        select: { name: true, company: true },
      });
      const clientName = clientSnap?.company ?? clientSnap?.name ?? recipientName;
      evolutionApi.notifyProductionReady(sellerPhone, sellerUser?.name ?? '', order.number, clientName);
    } else if (status === 'ENTREGADO') {
      evolutionApi.notifyOrderStatusChange(recipientPhone, recipientName, order.number, 'ENTREGADO');

      // T4.5 — update campaign metrics if this order came from a campaign
      if (order.sourceCampaignId) {
        const [recipient] = await Promise.all([
          prisma.campaignRecipient.findFirst({
            where: { clientId: order.clientId, campaignId: order.sourceCampaignId },
          }),
        ]);
        if (recipient) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              convertedAt: recipient.convertedAt ?? new Date(),
              revenueCOP: order.total,
              status: 'CONVERTED',
            },
          });
        }
        await prisma.campaignMetric.upsert({
          where: { campaignId: order.sourceCampaignId },
          update: {
            converted: { increment: 1 },
            revenueCOP: { increment: order.total },
          },
          create: {
            campaignId: order.sourceCampaignId,
            converted: 1,
            revenueCOP: order.total,
          },
        });
      }
    }

    res.json(order);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'ORDER_MISSING') {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    if (error instanceof Error && error.message === 'ORDER_DISPATCH_FLOW_REQUIRED') {
      res.status(400).json({ error: 'Use el flujo de despachos para validar cantidades y entrega' });
      return;
    }
    if (error instanceof Error && error.message === 'ORDER_DISPATCHED_BACKWARD') {
      res.status(400).json({ error: 'No se puede retroceder un pedido ya despachado' });
      return;
    }
    if (error instanceof Error && error.message.startsWith('ORDER_TERMINAL:')) {
      const terminalStatus = error.message.slice('ORDER_TERMINAL:'.length);
      res.status(400).json({ error: `No se puede reabrir un pedido en estado ${terminalStatus}` });
      return;
    }
    if ((error as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// PATCH /api/orders/:id/items/:itemId/pick
router.patch('/:id/items/:itemId/pick', async (req: AuthRequest, res: Response) => {
  try {
    const { picked } = req.body as { picked: boolean };
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const parent = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!parent) throw new Error('ITEM_ORDER_MISSING');
      if (parent.status === 'CANCELADO' || parent.status === 'ENTREGADO') throw new Error('ITEM_ORDER_TERMINAL');
      const existingItem = await tx.orderItem.findFirst({ where: { id: req.params.itemId, orderId: req.params.id } });
      if (!existingItem) throw new Error('ITEM_MISSING');
      return tx.orderItem.update({
        where: { id: existingItem.id },
        data: { picked: Boolean(picked) },
      });
    });
    res.json(item);
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_ORDER_MISSING') {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    if (error instanceof Error && error.message === 'ITEM_MISSING') {
      res.status(404).json({ error: 'Ítem no encontrado en este pedido' });
      return;
    }
    if (error instanceof Error && error.message === 'ITEM_ORDER_TERMINAL') {
      res.status(400).json({ error: 'No se pueden modificar ítems de un pedido cancelado o entregado' });
      return;
    }
    console.error('Pick item error:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// PATCH /api/orders/:id/items/:itemId/disposition
router.patch('/:id/items/:itemId/disposition', async (req: AuthRequest, res: Response) => {
  try {
    const { disposition } = req.body;
      const valid = ['PENDIENTE', 'STOCK', 'PRODUCCION'];
    if (!disposition || !valid.includes(disposition)) {
      res.status(400).json({ error: 'Disposición inválida. Valores: PENDIENTE, STOCK, PRODUCCION' });
      return;
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const parent = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!parent) throw new Error('ITEM_ORDER_MISSING');
      if (parent.status === 'CANCELADO' || parent.status === 'ENTREGADO') throw new Error('ITEM_ORDER_TERMINAL');
      const existingItem = await tx.orderItem.findFirst({ where: { id: req.params.itemId, orderId: req.params.id } });
      if (!existingItem) throw new Error('ITEM_MISSING');
      const updatedItem = await tx.orderItem.update({
        where: { id: existingItem.id },
        data: { disposition: disposition as never },
        include: { product: { select: { id: true, reference: true, name: true, unit: true, stock: true } } },
      });

      if (disposition === 'PRODUCCION') {
        const existing = await tx.productionOrder.findFirst({
          where: { orderId: req.params.id, productId: updatedItem.productId, status: { not: 'EMPACADO' } },
        });
        if (!existing) {
          await tx.productionOrder.create({
            data: {
              orderId: req.params.id,
              productId: updatedItem.productId,
              qty: updatedItem.qty,
              phase: 'BASICO',
              status: 'PENDIENTE',
            },
          });
        }
      }
      return updatedItem;
    });

    res.json(item);
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_ORDER_MISSING') {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }
    if (error instanceof Error && error.message === 'ITEM_MISSING') {
      res.status(404).json({ error: 'Ítem no encontrado en este pedido' });
      return;
    }
    if (error instanceof Error && error.message === 'ITEM_ORDER_TERMINAL') {
      res.status(400).json({ error: 'No se pueden modificar ítems de un pedido cancelado o entregado' });
      return;
    }
    console.error('Update item disposition error:', error);
    res.status(500).json({ error: 'Error al actualizar disposición del ítem' });
  }
});

// POST /api/orders/:id/photos
router.post('/:id/photos', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      res.status(404).json({ error: 'Pedido no encontrado' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No se recibió ninguna foto' });
      return;
    }

    const phase = req.body.phase as string | undefined;
    const fileUrl = `/api/uploads/${req.file.filename}`;

    const photo = await prisma.orderPhoto.create({
      data: {
        orderId: req.params.id,
        url: fileUrl,
        phase,
      },
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Error al subir foto' });
  }
});

const COMPANY = {
  name: process.env.COMPANY_NAME || 'MARAL S.A.S.',
  nit: process.env.COMPANY_NIT || '',
  address: process.env.COMPANY_ADDRESS || '',
  phone: process.env.COMPANY_PHONE || '',
  email: process.env.COMPANY_EMAIL || 'user38@example.com',
  website: process.env.COMPANY_WEBSITE || 'www.maral.com.co',
};

async function fetchOrderForPdf(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true, name: true, company: true, rut: true,
          city: true, phone: true, email: true, address: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true, reference: true, name: true, unit: true,
              warrantyYears: true, specs: true,
            },
          },
        },
      },
      photos: { where: { phase: 'EMPACADO' } },
    },
  });
}

// GET /api/orders/:id/dispatch-pdf-data  (JSON — datos para PDF en frontend)
router.get('/:id/dispatch-pdf-data', async (req: AuthRequest, res: Response) => {
  try {
    const order = await fetchOrderForPdf(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    res.json({ order, generatedAt: new Date().toISOString(), company: COMPANY });
  } catch (error) {
    console.error('Dispatch PDF data error:', error);
    res.status(500).json({ error: 'Error al obtener datos del despacho' });
  }
});

// GET /api/orders/:id/dispatch-pdf  (blob PDF descargable)
router.get('/:id/dispatch-pdf', async (req: AuthRequest, res: Response) => {
  try {
    const order = await fetchOrderForPdf(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }

    // Dynamic import of pdfkit (install: npm install pdfkit @types/pdfkit)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit') as typeof import('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="remision-${order.number}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').text(COMPANY.name, { align: 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    if (COMPANY.nit) doc.text(`NIT: ${COMPANY.nit}`);
    if (COMPANY.address) doc.text(COMPANY.address);
    if (COMPANY.phone) doc.text(`Tel: ${COMPANY.phone}`);
    doc.text(COMPANY.email);

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#CCCCCC').stroke();
    doc.moveDown(0.5);

    // ── Title ────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
      .text(`REMISIÓN DE DESPACHO #${order.number}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#555555')
      .text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, { align: 'center' });
    doc.moveDown(1);

    // ── Client Info ──────────────────────────────────────────
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('DATOS DEL CLIENTE');
    doc.fontSize(9).font('Helvetica');
    doc.text(`Cliente: ${order.client.name}${order.client.company ? ` — ${order.client.company}` : ''}`);
    if (order.client.rut) doc.text(`NIT/CC: ${order.client.rut}`);
    doc.moveDown(0.3);
    doc.text(`Destinatario: ${order.recipientName}`);
    doc.text(`Dirección: ${order.address}, ${order.city}`);
    if (order.phone) doc.text(`Teléfono: ${order.phone}`);
    doc.moveDown(0.3);
    doc.text(`Transportadora: ${order.carrier}   Flete: ${order.freightPayment} — Paga: ${order.freightPayer}`);
    if (order.guideNumber) doc.text(`Guía: ${order.guideNumber}`);
    doc.moveDown(1);

    // ── Items Table ──────────────────────────────────────────
    doc.fontSize(10).font('Helvetica-Bold').text('PRODUCTOS');
    doc.moveDown(0.3);

    const colRef = 50, colName = 120, colQty = 390, colUnit = 430, colPrice = 475;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
    doc.text('REF', colRef, doc.y, { width: 65 });
    doc.text('PRODUCTO', colName, doc.y - doc.currentLineHeight(), { width: 265 });
    doc.text('CANT', colQty, doc.y - doc.currentLineHeight(), { width: 35, align: 'right' });
    doc.text('UNID', colUnit, doc.y - doc.currentLineHeight(), { width: 40 });
    doc.text('PRECIO', colPrice, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' });
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#AAAAAA').stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fillColor('#000000');
    for (const item of order.items) {
      const y = doc.y;
      doc.fontSize(8).text(item.product.reference, colRef, y, { width: 65 });
      doc.text(item.product.name, colName, y, { width: 265 });
      doc.text(String(item.qty), colQty, y, { width: 35, align: 'right' });
      doc.text(item.product.unit, colUnit, y, { width: 40 });
      doc.text(`$${item.unitPrice.toLocaleString('es-CO')}`, colPrice, y, { width: 70, align: 'right' });
      doc.moveDown(0.8);
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#AAAAAA').stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold')
      .text(`TOTAL: $${order.total.toLocaleString('es-CO')}`, { align: 'right' });

    // ── Notes ────────────────────────────────────────────────
    if (order.notes) {
      doc.moveDown(0.8);
      doc.fontSize(9).font('Helvetica-Bold').text('Observaciones:');
      doc.font('Helvetica').text(order.notes);
    }

    // ── Signatures ───────────────────────────────────────────
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(200, doc.y).strokeColor('#000000').stroke();
    doc.moveTo(345, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica')
      .text('Entregado por', 50, doc.y, { width: 150, align: 'center' })
      .text('Recibido por', 345, doc.y - doc.currentLineHeight(), { width: 200, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Dispatch PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar PDF de despacho' });
    }
  }
});

// ── Shipments (despachos parciales) ──────────────────────────────────────────

// GET /api/orders/:id/shipments
router.get('/:id/shipments', async (req: AuthRequest, res: Response) => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: { orderId: req.params.id },
      include: {
        items: {
          include: {
            orderItem: { include: { product: { select: { id: true, name: true, reference: true } } } },
          },
        },
        invoice: { select: { id: true, number: true, amount: true, status: true, dueDate: true } },
      },
      orderBy: { number: 'asc' },
    });
    res.json(shipments);
  } catch (error) {
    console.error('GET shipments error:', error);
    res.status(500).json({ error: 'Error al obtener despachos' });
  }
});

const CreateShipmentSchema = z.object({
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  creditDispatch: z.boolean().optional().default(false),
  items: z.array(z.object({
    orderItemId: z.string(),
    quantity: z.number().positive(),
  })).min(1),
});

// POST /api/orders/:id/shipments
router.post('/:id/shipments', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = CreateShipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }
    const { carrier, trackingNumber, notes, creditDispatch } = parsed.data;
    const quantities = new Map<string, number>();
    for (const item of parsed.data.items) {
      quantities.set(item.orderItemId, (quantities.get(item.orderItemId) ?? 0) + item.quantity);
    }
    const items = [...quantities].map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        client: { select: { id: true, paymentDays: true } },
      },
    });
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    if (order.status === 'CANCELADO' || order.status === 'ENTREGADO') {
      res.status(400).json({ error: 'No se puede despachar un pedido cancelado o ya entregado' });
      return;
    }

    // Validate quantities
    for (const si of items) {
      const oi = order.items.find(i => i.id === si.orderItemId);
      if (!oi) { res.status(400).json({ error: `Ítem ${si.orderItemId} no pertenece a este pedido` }); return; }
      const remaining = oi.qty - oi.quantityShipped;
      if (si.quantity > remaining) {
        res.status(400).json({ error: `Ítem ${oi.id}: se intentan despachar ${si.quantity} pero solo quedan ${remaining} pendientes` });
        return;
      }
    }

    const shipmentAmount = items.reduce((sum, si) => {
      const oi = order.items.find(i => i.id === si.orderItemId)!;
      return sum + oi.unitPrice * si.quantity;
    }, 0);

    const shipment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      const lockedOrder = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
      if (!lockedOrder || lockedOrder.status === 'CANCELADO' || lockedOrder.status === 'ENTREGADO') {
        throw new Error('SHIPMENT_ORDER_TERMINAL');
      }
      // Create shipment
      const s = await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier,
          trackingNumber,
          notes,
          creditDispatch,
          status: 'DESPACHADO',
          dispatchedAt: new Date(),
          items: {
            create: items.map(si => ({ orderItemId: si.orderItemId, quantity: si.quantity })),
          },
        },
        include: {
          items: {
            include: {
              orderItem: { include: { product: { select: { id: true, name: true, reference: true } } } },
            },
          },
        },
      });

      // Guard the quantity increment in the database to serialize competing dispatches.
      for (const si of items) {
        const oi = order.items.find(i => i.id === si.orderItemId)!;
        const claimed = await tx.orderItem.updateMany({
          where: { id: si.orderItemId, orderId: order.id, quantityShipped: { lte: oi.qty - si.quantity } },
          data: { quantityShipped: { increment: si.quantity } },
        });
        if (claimed.count !== 1) {
          throw new Error(`SHIPMENT_QUANTITY_CONFLICT:${oi.id}`);
        }
        // Inventory movement
        await tx.inventoryMovement.create({
          data: {
            productId: oi.productId,
            type: 'SALIDA',
            qty: si.quantity,
            reason: `Despacho #${s.number} — Pedido #${order.number}`,
            referenceId: s.id,
            referenceType: 'Shipment',
          },
        });
        // Decrement stock
        await tx.product.update({
          where: { id: oi.productId },
          data: { stock: { decrement: si.quantity } },
        });
      }

      // Determine new order status
      const updatedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const allShipped = updatedItems.every(i => i.quantityShipped >= i.qty);
      const newOrderStatus = allShipped ? 'DESPACHADO' : 'DESPACHO_PARCIAL';
      await tx.order.update({
        where: { id: order.id },
        data: { status: newOrderStatus as never, updatedById: req.user!.userId },
      });

      // Credit invoice per shipment
      if (creditDispatch) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (order.client.paymentDays || 30));
        await tx.invoice.create({
          data: {
            orderId: order.id,
            shipmentId: s.id,
            clientId: order.clientId,
            amount: shipmentAmount,
            dueDate,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CREATE',
          entityType: 'Shipment',
          entityId: s.id,
          metadata: { orderNumber: order.number, shipmentNumber: s.number, amount: shipmentAmount },
        },
      });

      return s;
    });

    res.status(201).json(shipment);
  } catch (error) {
    if (error instanceof Error && error.message === 'SHIPMENT_ORDER_TERMINAL') {
      res.status(400).json({ error: 'No se puede despachar un pedido cancelado o ya entregado' });
      return;
    }
    if (error instanceof Error && error.message.startsWith('SHIPMENT_QUANTITY_CONFLICT:')) {
      res.status(409).json({ error: 'La cantidad pendiente cambió; actualice el pedido e intente nuevamente' });
      return;
    }
    console.error('POST shipment error:', error);
    res.status(500).json({ error: 'Error al crear despacho' });
  }
});

// PATCH /api/orders/:id/shipments/:shipmentId
router.patch('/:id/shipments/:shipmentId', async (req: AuthRequest, res: Response) => {
  try {
    const { status, carrier, trackingNumber, notes } = req.body;
    const validStatuses = ['PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Estado inválido' });
      return;
    }

    const existing = await prisma.shipment.findFirst({
      where: { id: req.params.shipmentId, orderId: req.params.id },
    });
    if (!existing) { res.status(404).json({ error: 'Despacho no encontrado' }); return; }
    const allowedTransitions: Record<string, string[]> = {
      PREPARANDO: ['DESPACHADO'],
      DESPACHADO: ['ENTREGADO'],
      ENTREGADO: [],
      CANCELADO: [],
    };

    const shipment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const parent = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!parent) throw new Error('SHIPMENT_ORDER_MISSING');
      if (parent.status === 'CANCELADO' || parent.status === 'ENTREGADO') throw new Error('SHIPMENT_ORDER_TERMINAL');
      const currentShipment = await tx.shipment.findFirst({
        where: { id: req.params.shipmentId, orderId: req.params.id },
      });
      if (!currentShipment) throw new Error('SHIPMENT_MISSING');
      if (status && status !== currentShipment.status && !allowedTransitions[currentShipment.status]?.includes(status)) {
        throw new Error('SHIPMENT_TRANSITION_INVALID');
      }
      const updatedShipment = await tx.shipment.update({
        where: { id: currentShipment.id },
        data: {
          ...(status ? { status: status as never } : {}),
          ...(carrier !== undefined ? { carrier } : {}),
          ...(trackingNumber !== undefined ? { trackingNumber } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(status === 'DESPACHADO' ? { dispatchedAt: new Date() } : {}),
        },
      });
      const [allShipments, orderItems] = await Promise.all([
        tx.shipment.findMany({ where: { orderId: req.params.id } }),
        tx.orderItem.findMany({ where: { orderId: req.params.id } }),
      ]);
      const allShipped = orderItems.length > 0 && orderItems.every(i => i.quantityShipped >= i.qty);
      const allDelivered = allShipped && allShipments.length > 0 && allShipments.every(s => s.status === 'ENTREGADO');
      const reconciledStatus = allDelivered ? 'ENTREGADO' : allShipped ? 'DESPACHADO' : 'DESPACHO_PARCIAL';
      await tx.order.update({
        where: { id: req.params.id },
        data: { status: reconciledStatus as never, updatedById: req.user!.userId },
      });
      return updatedShipment;
    });

    res.json(shipment);
  } catch (error) {
    if (error instanceof Error && error.message === 'SHIPMENT_ORDER_TERMINAL') {
      res.status(400).json({ error: 'No se puede modificar un despacho de un pedido cancelado o entregado' });
      return;
    }
    if (error instanceof Error && error.message === 'SHIPMENT_TRANSITION_INVALID') {
      res.status(400).json({ error: 'Transición de estado de despacho inválida' });
      return;
    }
    if (error instanceof Error && error.message === 'SHIPMENT_MISSING') {
      res.status(404).json({ error: 'Despacho no encontrado' });
      return;
    }
    console.error('PATCH shipment error:', error);
    res.status(500).json({ error: 'Error al actualizar despacho' });
  }
});

// DELETE /api/orders/:id/shipments/:shipmentId — solo si está en PREPARANDO
router.delete('/:id/shipments/:shipmentId', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${req.params.id} FOR UPDATE`;
      const parent = await tx.order.findUnique({ where: { id: req.params.id }, select: { status: true } });
      if (!parent) throw new Error('SHIPMENT_ORDER_MISSING');
      if (parent.status === 'CANCELADO' || parent.status === 'ENTREGADO') throw new Error('SHIPMENT_ORDER_TERMINAL');
      const shipment = await tx.shipment.findFirst({
        where: { id: req.params.shipmentId, orderId: req.params.id },
        include: { items: { include: { orderItem: true } } },
      });
      if (!shipment) throw new Error('SHIPMENT_MISSING');
      if (shipment.status !== 'PREPARANDO') throw new Error('SHIPMENT_NOT_PREPARING');

      // Revert quantityShipped
      for (const si of shipment.items) {
        await tx.orderItem.update({
          where: { id: si.orderItemId },
          data: { quantityShipped: { decrement: si.quantity } },
        });
        // Revert stock
        await tx.product.update({
          where: { id: si.orderItem.productId },
          data: { stock: { increment: si.quantity } },
        });
      }
      await tx.shipment.delete({ where: { id: shipment.id } });

      // Recalculate order status
      const updatedItems = await tx.orderItem.findMany({ where: { orderId: req.params.id } });
      if (!['CANCELADO', 'ENTREGADO'].includes(parent.status)) {
        const anyShipped = updatedItems.some(i => i.quantityShipped > 0);
        const allShipped = updatedItems.length > 0 && updatedItems.every(i => i.quantityShipped >= i.qty);
        const reconciledStatus = allShipped ? 'DESPACHADO' : anyShipped ? 'DESPACHO_PARCIAL' : 'EMPACADO';
        await tx.order.update({
          where: { id: req.params.id },
          data: { status: reconciledStatus as never },
        });
      }
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'SHIPMENT_ORDER_TERMINAL') {
      res.status(400).json({ error: 'No se puede eliminar un despacho de un pedido cancelado o entregado' });
      return;
    }
    if (error instanceof Error && error.message === 'SHIPMENT_NOT_PREPARING') {
      res.status(400).json({ error: 'Solo se pueden eliminar despachos en estado PREPARANDO' });
      return;
    }
    if (error instanceof Error && error.message === 'SHIPMENT_MISSING') {
      res.status(404).json({ error: 'Despacho no encontrado' });
      return;
    }
    console.error('DELETE shipment error:', error);
    res.status(500).json({ error: 'Error al eliminar despacho' });
  }
});

export default router;

