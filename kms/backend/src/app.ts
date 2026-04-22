import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { configurePassport } from './config/passport';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { generalRateLimiter } from './middleware/rateLimiter';

// Routes
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import documentsRouter from './routes/documents';
import internalRouter from './routes/internal';
import searchRouter from './routes/search';
import adminRouter from './routes/admin';

// Workers
import { startDocumentWorker, stopDocumentWorker } from './services/queueService';

const app = express();

// ─── Security middleware ───────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── General middleware ────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request logging ──────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// ─── Trust proxy (for Nginx) ──────────────────────────────────────
app.set('trust proxy', 1);

// ─── Passport (Google OAuth) ──────────────────────────────────────
configurePassport();
app.use(passport.initialize());

// ─── Global rate limiter ──────────────────────────────────────────
app.use('/api', generalRateLimiter);

// ─── API Documentation ────────────────────────────────────────────
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'KMS API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/internal', internalRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);

// ─── Error handling ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  // Start BullMQ document processing worker
  startDocumentWorker();

  const PORT = env.PORT;
  const server = app.listen(PORT, () => {
    logger.info(`🚀 KMS Backend running on port ${PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    await stopDocumentWorker();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});

export default app;
