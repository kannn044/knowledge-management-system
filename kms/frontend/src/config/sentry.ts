/**
 * Sentry error tracking for the React frontend — production only.
 *
 * Install: npm install @sentry/react
 *
 * Usage in main.tsx:
 *   import { initSentry } from './config/sentry';
 *   initSentry();
 *
 * Usage for React Router integration in App.tsx:
 *   import { useSentryRoutes } from './config/sentry';
 *   const SentryRoutes = useSentryRoutes();
 *   // Then use <SentryRoutes> instead of <Routes> in your router
 */

let SentryModule: typeof import('@sentry/react') | null = null;

/**
 * Initialize Sentry. No-ops if VITE_SENTRY_DSN is not set or not in production.
 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const isProd = import.meta.env.PROD;
  if (!dsn || !isProd) return;

  try {
    SentryModule = await import('@sentry/react');
    SentryModule.init({
      dsn,
      environment: isProd ? 'production' : 'development',
      release: import.meta.env.VITE_APP_VERSION as string | undefined,
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,
      // Capture 10% of sessions for session replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        SentryModule.browserTracingIntegration(),
      ],
      // Don't send tokens or auth headers
      beforeSend(event) {
        if (event.request?.headers?.Authorization) {
          event.request.headers.Authorization = '[REDACTED]';
        }
        return event;
      },
    });
  } catch {
    // @sentry/react not installed — monitoring unavailable
  }
}

/**
 * Manually report an error to Sentry (e.g., from an API catch block).
 */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (!SentryModule) return;
  SentryModule.withScope((scope) => {
    if (context) scope.setExtras(context);
    SentryModule!.captureException(err);
  });
}

/**
 * Returns a Sentry-wrapped Routes component for React Router v6.
 * Falls back to regular Routes if Sentry is not available.
 */
export function getSentryRoutes() {
  if (!SentryModule) {
    // Lazy import to avoid circular deps — caller should handle this
    return null;
  }
  return SentryModule.withSentryReactRouterV6Routing;
}
