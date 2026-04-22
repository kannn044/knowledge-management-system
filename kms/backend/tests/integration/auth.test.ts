/**
 * Integration tests for POST /api/auth/register and POST /api/auth/login
 * Tests validation, success flows, and error flows — Prisma is fully mocked.
 */

// ─── Mock all external dependencies ──────────────────────────────────────────
jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/redis', () => ({
  redis: { ping: jest.fn(), quit: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/queueService', () => ({
  startDocumentWorker: jest.fn(),
  stopDocumentWorker: jest.fn(),
  documentQueue: {},
  queueEvents: {},
  enqueueDocument: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
    sendRejectionEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/config/passport', () => ({
  configurePassport: jest.fn(),
}));

jest.mock('../../src/middleware/auditLog', () => ({
  auditLog: () => (_req: any, _res: any, next: any) => next(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import authRouter from '../../src/routes/auth';
import { errorHandler } from '../../src/middleware/errorHandler';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use('/api/auth', authRouter);
app.use(errorHandler);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validRegisterPayload = {
  email: 'newuser@example.com',
  password: 'SecurePass1',
  firstName: 'John',
  lastName: 'Doe',
  department: 'Engineering',
};

// ─── Registration tests ───────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = require('../../src/config/database');
    // Default: no existing user
    prisma.user.findUnique.mockResolvedValue(null);
    // Default: create returns the new user
    prisma.user.create.mockResolvedValue({
      id: 'user-uuid-1',
      email: validRegisterPayload.email,
      firstName: validRegisterPayload.firstName,
      lastName: validRegisterPayload.lastName,
      status: 'pending',
      role: { name: 'viewer' },
    });
    prisma.emailVerificationToken.create.mockResolvedValue({ token: 'verify-token-abc' });
  });

  it('returns 201 on successful registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('verification');
  });

  it('returns 409 when email is already taken', async () => {
    const { prisma } = require('../../src/config/database');
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: validRegisterPayload.email });

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for password without uppercase letter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterPayload, password: 'alllowercase1' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('returns 400 for password without number', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterPayload, password: 'NoNumbers!' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@example.com' }); // missing password, firstName, lastName

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Login tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const bcrypt = require('bcryptjs');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('returns 401 when user does not exist', async () => {
    const { prisma } = require('../../src/config/database');
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when password is wrong', async () => {
    const { prisma } = require('../../src/config/database');
    const hash = await bcrypt.hash('CorrectPass1', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      status: 'active',
      role: { name: 'viewer' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when account is not active (pending)', async () => {
    const { prisma } = require('../../src/config/database');
    const hash = await bcrypt.hash('Password1', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      status: 'pending', // Not yet active
      role: { name: 'viewer' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Password1' });

    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
