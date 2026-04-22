/**
 * Integration tests for GET /api/health
 * Mocks the database, Redis, and Python service so no real infrastructure is needed.
 */

// ─── Mock external dependencies before importing app ──────────────────────────
jest.mock('../../src/config/database', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/redis', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ status: 200, data: { status: 'healthy' } }),
  create: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ status: 200, data: {} }),
    post: jest.fn(),
    delete: jest.fn(),
  }),
}));

jest.mock('../../src/services/queueService', () => ({
  startDocumentWorker: jest.fn(),
  stopDocumentWorker: jest.fn().mockResolvedValue(undefined),
  documentQueue: { add: jest.fn() },
  queueEvents: {},
  enqueueDocument: jest.fn(),
}));

jest.mock('../../src/config/passport', () => ({
  configurePassport: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import request from 'supertest';
import express from 'express';
import healthRouter from '../../src/routes/health';

const app = express();
app.use(express.json());
app.use('/api/health', healthRouter);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with all checks passing when services are healthy', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.postgres).toBe(true);
    expect(res.body.checks.redis).toBe(true);
    expect(res.body.checks.python_service).toBe(true);
  });

  it('returns 503 when postgres is down', async () => {
    const { prisma } = require('../../src/config/database');
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.postgres).toBe(false);
  });

  it('returns 503 when redis is down', async () => {
    const { redis } = require('../../src/config/redis');
    redis.ping.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.checks.redis).toBe(false);
  });

  it('includes uptime and timestamp in response', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
