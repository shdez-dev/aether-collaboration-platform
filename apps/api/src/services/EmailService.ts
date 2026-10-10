import { BrevoClient } from '@getbrevo/brevo';
import nodemailer, { type Transporter } from 'nodemailer';
import { renderPasswordResetEmail, renderVerificationEmail } from './emailTemplates';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailVerificationData {
  userName: string;
  verificationLink: string;
}

interface PasswordResetData {
  userName: string;
  resetLink: string;
}

export class EmailService {
  private brevoClient?: BrevoClient;
  private smtpTransporter?: Transporter;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    const smtpLogin = process.env.BREVO_SMTP_LOGIN;
    const smtpKey = process.env.BREVO_SMTP_KEY;

    if (smtpLogin && smtpKey) {
      this.smtpTransporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpLogin, pass: smtpKey },
      });
    } else if (apiKey && apiKey !== 'xkeysib-placeholder-not-configured') {
      this.brevoClient = new BrevoClient({ apiKey });
    } else {
      throw new Error('Configure BREVO_SMTP_LOGIN and BREVO_SMTP_KEY or BREVO_API_KEY');
    }

    this.fromEmail = (this.smtpTransporter && process.env.AETHER_SMTP_FROM)
      || process.env.EMAIL_FROM
      || 'aether.notifications@gmail.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Aether';
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      if (this.smtpTransporter) {
        await this.smtpTransporter.sendMail({
          from: { address: this.fromEmail, name: this.fromName },
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        return;
      }

      if (!this.brevoClient) throw new Error('Email transport is not configured');
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
      });
    } catch (error: any) {
      console.error('Error sending email via Brevo:', error);
      throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
    }
  }

  async sendVerificationEmail(to: string, data: EmailVerificationData): Promise<void> {
    const { userName, verificationLink } = data;
    await this.sendEmail({
      to,
      subject: 'Confirma tu correo | Aether',
      html: renderVerificationEmail(userName, verificationLink),
      text: `Aether - Verificación de cuenta\n\nHola, ${userName}. Confirma tu correo para activar tu cuenta:\n${verificationLink}\n\nEste enlace estará disponible durante 24 horas y es de un solo uso.\nSi no creaste una cuenta, puedes ignorar este mensaje.`,
    });
  }

  async sendPasswordResetEmail(to: string, data: PasswordResetData): Promise<void> {
    const { userName, resetLink } = data;
    await this.sendEmail({
      to,
      subject: 'Restablece tu contraseña | Aether',
      html: renderPasswordResetEmail(userName, resetLink),
      text: `Aether - Restablecer contraseña\n\nHola, ${userName}. Recibimos una solicitud para cambiar tu contraseña:\n${resetLink}\n\nEste enlace expira en 1 hora y es de un solo uso. Si no solicitaste este cambio, ignora este mensaje.`,
    });
  }
}

// Lazy-loaded singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) emailServiceInstance = new EmailService();
  return emailServiceInstance;
}

// Backwards-compatible facade for callers that import emailService.
export const emailService = {
  get sendEmail() {
    return getEmailService().sendEmail.bind(getEmailService());
  },
  get sendVerificationEmail() {
    return getEmailService().sendVerificationEmail.bind(getEmailService());
  },
  get sendPasswordResetEmail() {
    return getEmailService().sendPasswordResetEmail.bind(getEmailService());
  },
};
