import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import axios from 'axios';
import { env } from '../config/env';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const checks = {
    postgres: false,
    redis: false,
    python_service: false,
  };

  // PostgreSQL check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {
    // postgres not ready
  }

  // Redis check
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG';
  } catch {
    // redis not ready
  }

  // Python microservice check
  try {
    const resp = await axios.get(`${env.PYTHON_SERVICE_URL}/health`, { timeout: 3000 });
    checks.python_service = resp.status === 200;
  } catch {
    // python not ready
  }

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
  });
});

export default router;
