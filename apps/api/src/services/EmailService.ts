import { BrevoClient } from '@getbrevo/brevo';

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
  private brevoClient: BrevoClient;
  private fromEmail: string;
  private fromName: string;
  private frontendUrl: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      throw new Error('BREVO_API_KEY is not configured in environment variables');
    }

    // Initialize Brevo client
    this.brevoClient = new BrevoClient({
      apiKey: apiKey,
    });

    this.fromEmail = process.env.EMAIL_FROM || 'sebastian@shernandez.dev';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Aether Platform';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://aether-web.up.railway.app';
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        sender: {
          email: this.fromEmail,
          name: this.fromName,
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
      });
    } catch (error: any) {
      console.error('Error sending email via Brevo:', error);
      throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(to: string, data: EmailVerificationData): Promise<void> {
    const { userName, verificationLink } = data;

    const html = this.getVerificationEmailTemplate(userName, verificationLink);
    const text = `Hola ${userName},\n\nVerifica tu dirección de correo haciendo clic en el siguiente enlace:\n\n${verificationLink}\n\nEste enlace expira en 24 horas.\n\nSi no creaste una cuenta en Aether, puedes ignorar este mensaje.\n\nEl equipo de Aether`;

    await this.sendEmail({
      to,
      subject: 'Verifica tu correo — Aether',
      html,
      text,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, data: PasswordResetData): Promise<void> {
    const { userName, resetLink } = data;

    const html = this.getPasswordResetEmailTemplate(userName, resetLink);
    const text = `Hola ${userName},\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta Aether.\n\n${resetLink}\n\nEste enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.\n\nEl equipo de Aether`;

    await this.sendEmail({
      to,
      subject: 'Restablece tu contraseña — Aether',
      html,
      text,
    });
  }

  /**
   * HTML template for email verification
   */
  private getVerificationEmailTemplate(userName: string, verificationLink: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu correo — Aether</title>
</head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f0f6ff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <svg width="22" height="22" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M110 39L32 173" stroke="#38b6ff" stroke-width="10" stroke-linecap="round"/>
                      <path d="M110 39L188 173" stroke="#38b6ff" stroke-width="10" stroke-linecap="round"/>
                      <path d="M66 122L154 122" stroke="#00e5cc" stroke-width="7" stroke-linecap="round"/>
                      <circle cx="110" cy="39" r="9" fill="#38b6ff"/>
                      <circle cx="32" cy="173" r="9" fill="#38b6ff"/>
                      <circle cx="188" cy="173" r="9" fill="#00e5cc"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;font-size:16px;font-weight:500;color:#f0f6ff;letter-spacing:-0.01em;">
                    Aether
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#0a1428;border:1px solid #1e3a5f;border-radius:8px;padding:36px 32px;">

              <!-- Tag -->
              <p style="margin:0 0 20px 0;font-family:'Courier New',Courier,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#00e5cc;">
                Verificación de correo
              </p>

              <!-- Heading -->
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:300;color:#f0f6ff;letter-spacing:-0.02em;line-height:1.2;">
                Hola, <span style="font-weight:500;">${userName}</span>
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;font-weight:300;line-height:1.7;color:#8aaac8;">
                Gracias por registrarte en Aether. Para activar tu cuenta y empezar a colaborar con tu equipo, verifica tu dirección de correo.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#38b6ff;border-radius:6px;">
                    <a href="${verificationLink}"
                       style="display:inline-block;padding:13px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;color:#080c14;text-decoration:none;border-radius:6px;">
                      Verificar correo
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="height:1px;background-color:#1e3a5f;"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;font-size:12px;color:#8aaac8;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;padding:10px 12px;background-color:#060a12;border:1px solid #1e3a5f;border-radius:4px;font-family:'Courier New',Courier,monospace;font-size:11px;color:#38b6ff;word-break:break-all;">
                ${verificationLink}
              </p>

              <!-- Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="padding:12px 14px;background-color:#060a12;border-left:2px solid #38b6ff;border-radius:0 4px 4px 0;">
                    <p style="margin:0;font-size:12px;color:#8aaac8;line-height:1.6;">
                      Este enlace expira en <strong style="color:#f0f6ff;">24 horas</strong> y es de un solo uso.<br>
                      Si no creaste una cuenta en Aether, puedes ignorar este mensaje.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:11px;color:#2a3d5a;">
                © ${new Date().getFullYear()} Aether &nbsp;·&nbsp;
                <a href="${this.frontendUrl}" style="color:#2a3d5a;text-decoration:none;">${this.frontendUrl}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * HTML template for password reset
   */
  private getPasswordResetEmailTemplate(userName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablece tu contraseña — Aether</title>
</head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f0f6ff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <svg width="22" height="22" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M110 39L32 173" stroke="#38b6ff" stroke-width="10" stroke-linecap="round"/>
                      <path d="M110 39L188 173" stroke="#38b6ff" stroke-width="10" stroke-linecap="round"/>
                      <path d="M66 122L154 122" stroke="#00e5cc" stroke-width="7" stroke-linecap="round"/>
                      <circle cx="110" cy="39" r="9" fill="#38b6ff"/>
                      <circle cx="32" cy="173" r="9" fill="#38b6ff"/>
                      <circle cx="188" cy="173" r="9" fill="#00e5cc"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;font-size:16px;font-weight:500;color:#f0f6ff;letter-spacing:-0.01em;">
                    Aether
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#0a1428;border:1px solid #1e3a5f;border-radius:8px;padding:36px 32px;">

              <!-- Tag -->
              <p style="margin:0 0 20px 0;font-family:'Courier New',Courier,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#00e5cc;">
                Restablecer contraseña
              </p>

              <!-- Heading -->
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:300;color:#f0f6ff;letter-spacing:-0.02em;line-height:1.2;">
                Hola, <span style="font-weight:500;">${userName}</span>
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;font-weight:300;line-height:1.7;color:#8aaac8;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva contraseña.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#38b6ff;border-radius:6px;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:13px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;color:#080c14;text-decoration:none;border-radius:6px;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="height:1px;background-color:#1e3a5f;"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;font-size:12px;color:#8aaac8;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;padding:10px 12px;background-color:#060a12;border:1px solid #1e3a5f;border-radius:4px;font-family:'Courier New',Courier,monospace;font-size:11px;color:#38b6ff;word-break:break-all;">
                ${resetLink}
              </p>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="padding:12px 14px;background-color:#060a12;border-left:2px solid #38b6ff;border-radius:0 4px 4px 0;">
                    <p style="margin:0;font-size:12px;color:#8aaac8;line-height:1.6;">
                      Este enlace expira en <strong style="color:#f0f6ff;">1 hora</strong> y es de un solo uso.<br>
                      Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:11px;color:#2a3d5a;">
                © ${new Date().getFullYear()} Aether &nbsp;·&nbsp;
                <a href="${this.frontendUrl}" style="color:#2a3d5a;text-decoration:none;">${this.frontendUrl}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

// Lazy-loaded singleton instance
let _emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!_emailServiceInstance) {
    _emailServiceInstance = new EmailService();
  }
  return _emailServiceInstance;
}

// For backwards compatibility
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
