import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Redis
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Python microservice
  PYTHON_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // EmailJS
  EMAILJS_SERVICE_ID: z.string().optional(),
  EMAILJS_TEMPLATE_ID_VERIFY: z.string().optional(),
  EMAILJS_TEMPLATE_ID_APPROVE: z.string().optional(),
  EMAILJS_TEMPLATE_ID_REJECT: z.string().optional(),
  EMAILJS_TEMPLATE_ID_RESET: z.string().optional(),
  EMAILJS_PUBLIC_KEY: z.string().optional(),
  EMAILJS_PRIVATE_KEY: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // File upload
  UPLOAD_DIR: z.string().default('/app/uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),

  // Internal service communication
  INTERNAL_API_SECRET: z.string().default('internal_secret_change_me'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _env.data;
export type Env = typeof env;
