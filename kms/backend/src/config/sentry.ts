/**
 * Sentry error tracking — production only.
 *
 * Install: npm install @sentry/node
 *
 * Usage in app.ts:
 *   import { initSentry, sentryErrorHandler } from './config/sentry';
 *   initSentry(app);           // before routes
 *   app.use(sentryErrorHandler); // after routes, before errorHandler
 */
import { env } from './env';

let Sentry: typeof import('@sentry/node') | null = null;

// Lazy-load Sentry so the app still starts if the package is missing
async function loadSentry() {
  try {
    Sentry = await import('@sentry/node');
  } catch {
    // @sentry/node not installed — monitoring will be unavailable
  }
}

export async function initSentry(app: any): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || env.NODE_ENV !== 'production') return;

  await loadSentry();
  if (!Sentry) return;

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: process.env.npm_package_version,
    // Performance monitoring — capture 10% of transactions in production
    tracesSampleRate: 0.1,
    // Don't send PII to Sentry
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }
      return event;
    },
  });

  // Attach request handler (must be first middleware)
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

/**
 * Sentry error handler middleware — must be added AFTER all routes
 * and BEFORE the custom errorHandler.
 */
export function sentryErrorHandler() {
  return async (err: Error, req: any, res: any, next: any) => {
    if (Sentry && process.env.SENTRY_DSN && env.NODE_ENV === 'production') {
      Sentry.captureException(err);
    }
    next(err);
  };
}

/**
 * Manually capture a non-fatal exception (e.g., a failed background job).
 */
export function captureException(err: Error, context?: Record<string, unknown>): void {
  if (Sentry && process.env.SENTRY_DSN && env.NODE_ENV === 'production') {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry!.captureException(err);
    });
  }
}
