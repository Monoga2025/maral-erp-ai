import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import productRoutes from './routes/products';
import quotationRoutes from './routes/quotations';
import orderRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import productionRoutes from './routes/production';
import purchaseRoutes from './routes/purchases';
import supplierRoutes from './routes/suppliers';
import invoiceRoutes from './routes/invoices';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import userRoutes from './routes/users';
import taskRoutes from './routes/tasks';
import expenseRoutes from './routes/expenses';
import aiRoutes from './routes/ai';
import dianRoutes from './routes/dian';
import whatsappRoutes from './routes/whatsapp';
import campaignRoutes from './routes/campaigns';
import imageGenRoutes from './routes/image-gen';
import notificationRoutes from './routes/notifications';
import tagRoutes from './routes/tags';
import segmentRoutes from './routes/segments';
import categoryRoutes from './routes/categories';
import competitorRoutes from './routes/competitors';
import prospectingRoutes from './routes/prospecting';
import uploadRoutes from './routes/uploads';
import { startSender } from './lib/campaign-sender';
import { startDripWorker, seedDripSequences } from './lib/drip-scheduler';
import { startBestTimeJob } from './lib/best-time';
import { startPatternJob } from './lib/forbidden-patterns';
import { startWeeklyReportJob } from './jobs/weekly-report';
import { ensureSeedData } from './lib/autoSeed';
import { prisma } from './lib/prisma';
import { getStartupPolicy } from './lib/startupPolicy';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Middleware ──────────────────────────────────────────────
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (configuredOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN must list explicit origins when credentials are enabled');
}
app.use(cors({
  origin: configuredOrigins.length ? configuredOrigins : false,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logger ──────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color =
      res.statusCode >= 500 ? '\x1b[31m' :
      res.statusCode >= 400 ? '\x1b[33m' :
      '\x1b[32m';
    const userId = (req as { user?: { userId: string } }).user?.userId ?? '-';
    console.log(`${color}${req.method}\x1b[0m ${req.path} ${res.statusCode} ${ms}ms user=${userId}`);
  });
  next();
});

// Campaign media is intentionally public: its URLs are consumed by external messaging platforms.
app.use('/uploads/campaigns', express.static(path.resolve(UPLOAD_DIR, 'campaigns')));

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'maral-os-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
  });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/uploads', uploadRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dian', dianRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/image-gen', imageGenRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/prospecting', prospectingRoutes);

// ── Serve frontend in production ────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist, {
      setHeaders: (res, pathUrl) => {
        if (pathUrl.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

// ── Global error handler ────────────────────────────────────
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      error: isProduction && (!err.status || err.status === 500)
        ? 'Error interno del servidor'
        : err.message || 'Error interno del servidor',
    });
  }
);

// ── Start server ────────────────────────────────────────────
const startupPolicy = getStartupPolicy(process.env);
if (startupPolicy.seed) {
  ensureSeedData().catch(console.error);
  seedDripSequences().catch(console.error);
}
if (startupPolicy.backgroundJobs) {
  startSender();
  startDripWorker();
  startBestTimeJob();
  startPatternJob();
  startWeeklyReportJob();
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║       MARAL OS — Backend Server           ║');
  console.log('  ╠═══════════════════════════════════════════╣');
  console.log(`  ║  Port    : ${PORT}                            ║`);
  console.log(`  ║  Env     : ${(process.env.NODE_ENV || 'development').padEnd(30)}║`);
  console.log(`  ║  Health  : http://localhost:${PORT}/health    ║`);
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
});

// ── Graceful Shutdown ───────────────────────────────────────
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Database connection pool disconnected.');
    } catch (dbErr) {
      console.error('Error disconnecting database:', dbErr);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
