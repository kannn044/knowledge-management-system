import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { logger } from './logger';

/**
 * Configure Google OAuth 2.0 strategy.
 * The actual user creation/lookup is handled in the auth route callback,
 * not here, to keep Passport stateless.
 */
export function configurePassport(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL missing');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      (_accessToken, _refreshToken, profile, done) => {
        // Pass the raw Google profile to the route handler
        done(null, profile);
      }
    )
  );

  // We're using JWT, not sessions — no session serialization needed
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  logger.info('✅ Google OAuth strategy configured');
}
