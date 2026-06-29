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
<body style="margin:0;padding:0;background-color:#0D0F12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0F12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <div style="width:28px;height:28px;border-radius:8px;background-color:#F2571E;display:inline-flex;align-items:center;justify-content:center;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5L5.5 19.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
                        <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
                        <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
                      </svg>
                    </div>
                  </td>
                  <td style="vertical-align:middle;font-size:17px;font-weight:700;color:#ECE5D6;letter-spacing:-0.015em;">
                    Aether
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:36px 32px;">

              <!-- Tag -->
              <p style="margin:0 0 20px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#615846;">
                Verificación de correo
              </p>

              <!-- Heading -->
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#F4EEE2;letter-spacing:-0.02em;line-height:1.2;">
                Hola, ${userName}
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.7;color:#9C9486;">
                Gracias por unirte a Aether. Para activar tu cuenta y empezar a colaborar con tu equipo, verifica tu dirección de correo.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#F2571E;border-radius:10px;">
                    <a href="${verificationLink}"
                       style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#FEF3EE;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
                      Verificar correo
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="height:1px;background-color:rgba(255,255,255,0.07);"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;font-size:12px;color:#615846;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;padding:10px 12px;background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-family:'Courier New',Courier,monospace;font-size:11px;color:#9C9486;word-break:break-all;">
                ${verificationLink}
              </p>

              <!-- Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:12px 14px;background-color:rgba(242,87,30,0.05);border-left:2px solid rgba(242,87,30,0.3);border-radius:0 6px 6px 0;">
                    <p style="margin:0;font-size:12px;color:#9C9486;line-height:1.6;">
                      Este enlace expira en <strong style="color:#C8BFAE;">24 horas</strong> y es de un solo uso.<br>
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
              <p style="margin:0;font-size:11px;color:#3D3830;">
                © ${new Date().getFullYear()} Aether &nbsp;·&nbsp;
                <a href="${this.frontendUrl}" style="color:#3D3830;text-decoration:none;">${this.frontendUrl}</a>
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
<body style="margin:0;padding:0;background-color:#0D0F12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0F12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <div style="width:28px;height:28px;border-radius:8px;background-color:#F2571E;display:inline-flex;align-items:center;justify-content:center;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5L5.5 19.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
                        <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
                        <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
                      </svg>
                    </div>
                  </td>
                  <td style="vertical-align:middle;font-size:17px;font-weight:700;color:#ECE5D6;letter-spacing:-0.015em;">
                    Aether
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:36px 32px;">

              <!-- Tag -->
              <p style="margin:0 0 20px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#615846;">
                Restablecer contraseña
              </p>

              <!-- Heading -->
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#F4EEE2;letter-spacing:-0.02em;line-height:1.2;">
                Hola, ${userName}
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.7;color:#9C9486;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta Aether. Haz clic en el botón para crear una nueva contraseña.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#F2571E;border-radius:10px;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#FEF3EE;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="height:1px;background-color:rgba(255,255,255,0.07);"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;font-size:12px;color:#615846;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;padding:10px 12px;background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-family:'Courier New',Courier,monospace;font-size:11px;color:#9C9486;word-break:break-all;">
                ${resetLink}
              </p>

              <!-- Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:12px 14px;background-color:rgba(242,87,30,0.05);border-left:2px solid rgba(242,87,30,0.3);border-radius:0 6px 6px 0;">
                    <p style="margin:0;font-size:12px;color:#9C9486;line-height:1.6;">
                      Este enlace expira en <strong style="color:#C8BFAE;">1 hora</strong> y es de un solo uso.<br>
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
              <p style="margin:0;font-size:11px;color:#3D3830;">
                © ${new Date().getFullYear()} Aether &nbsp;·&nbsp;
                <a href="${this.frontendUrl}" style="color:#3D3830;text-decoration:none;">${this.frontendUrl}</a>
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
