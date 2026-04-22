/**
 * EmailJS service wrapper.
 * Uses EmailJS REST API (server-side) to send transactional emails.
 * https://www.emailjs.com/docs/rest-api/send/
 */
import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

interface EmailParams {
  [key: string]: string;
}

async function sendEmail(templateId: string, params: EmailParams): Promise<void> {
  if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !env.EMAILJS_PRIVATE_KEY) {
    logger.warn('EmailJS not configured — skipping email send. Check EMAILJS_* env vars.');
    // In dev, log what would be sent
    if (env.NODE_ENV === 'development') {
      logger.debug('Email params that would be sent:', { templateId, params });
    }
    return;
  }

  try {
    await axios.post(EMAILJS_API_URL, {
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: env.EMAILJS_PUBLIC_KEY,
      accessToken: env.EMAILJS_PRIVATE_KEY,
      template_params: params,
    });
    logger.info(`Email sent via template: ${templateId} → ${params.to_email}`);
  } catch (error) {
    logger.error('Failed to send email via EmailJS', {
      templateId,
      to: params.to_email,
      error: (error as Error).message,
    });
    // Don't throw — email failure shouldn't break the API response
  }
}

// ─── Email templates ──────────────────────────────────────────────

export const emailService = {
  /**
   * Send email verification link after registration.
   * Template variables: to_email, to_name, verify_url
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail(env.EMAILJS_TEMPLATE_ID_VERIFY ?? '', {
      to_email: email,
      to_name: name,
      verify_url: verifyUrl,
      app_name: 'KMS',
    });
  },

  /**
   * Notify user their account has been approved.
   * Template variables: to_email, to_name, login_url
   */
  async sendApprovalEmail(email: string, name: string): Promise<void> {
    await sendEmail(env.EMAILJS_TEMPLATE_ID_APPROVE ?? '', {
      to_email: email,
      to_name: name,
      login_url: `${env.FRONTEND_URL}/login`,
      app_name: 'KMS',
    });
  },

  /**
   * Notify user their account has been rejected.
   * Template variables: to_email, to_name
   */
  async sendRejectionEmail(email: string, name: string): Promise<void> {
    await sendEmail(env.EMAILJS_TEMPLATE_ID_REJECT ?? '', {
      to_email: email,
      to_name: name,
      app_name: 'KMS',
    });
  },

  /**
   * Send temporary password for forgotten password flow.
   * Template variables: to_email, to_name, temp_password, login_url
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    tempPassword: string
  ): Promise<void> {
    await sendEmail(env.EMAILJS_TEMPLATE_ID_RESET ?? '', {
      to_email: email,
      to_name: name,
      temp_password: tempPassword,
      login_url: `${env.FRONTEND_URL}/login`,
      app_name: 'KMS',
    });
  },
};
