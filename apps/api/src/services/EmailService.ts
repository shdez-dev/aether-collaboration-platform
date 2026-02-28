import { Resend } from 'resend';

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
  private resend: Resend;
  private fromEmail: string;
  private frontendUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    console.log('[EmailService] Initializing...');
    console.log('[EmailService] RESEND_API_KEY configured:', apiKey ? '✓ YES' : '✗ NO');
    console.log(
      '[EmailService] API Key preview:',
      apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET'
    );

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured in environment variables');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    console.log('[EmailService] From Email:', this.fromEmail);
    console.log('[EmailService] Frontend URL:', this.frontendUrl);
    console.log('[EmailService] Initialization complete ✓');
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    console.log('\n[EmailService] ========== SENDING EMAIL ==========');
    console.log('[EmailService] To:', options.to);
    console.log('[EmailService] From:', this.fromEmail);
    console.log('[EmailService] Subject:', options.subject);

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log('[EmailService] ✓ Email sent successfully!');
      console.log('[EmailService] Result:', JSON.stringify(result, null, 2));
      console.log('[EmailService] =====================================\n');
    } catch (error: any) {
      console.error('\n[EmailService] ✗ ERROR SENDING EMAIL:');
      console.error('[EmailService] Error type:', error.constructor.name);
      console.error('[EmailService] Error message:', error.message);
      console.error('[EmailService] Full error:', JSON.stringify(error, null, 2));
      console.error('[EmailService] Stack:', error.stack);
      console.error('[EmailService] =====================================\n');
      throw error; // Re-throw the original error, not a generic one
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(to: string, data: EmailVerificationData): Promise<void> {
    console.log('[EmailService] sendVerificationEmail called');
    console.log('[EmailService] To:', to);
    console.log('[EmailService] User name:', data.userName);
    console.log('[EmailService] Link:', data.verificationLink);

    const { userName, verificationLink } = data;

    const html = this.getVerificationEmailTemplate(userName, verificationLink);
    const text = `Hi ${userName},\n\nPlease verify your email address by clicking the following link:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account with Aether, please ignore this email.\n\nBest regards,\nThe Aether Team`;

    console.log('[EmailService] Template generated, calling sendEmail...');

    await this.sendEmail({
      to,
      subject: 'Verify your email - Aether Collaboration Platform',
      html,
      text,
    });

    console.log('[EmailService] sendVerificationEmail completed');
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, data: PasswordResetData): Promise<void> {
    const { userName, resetLink } = data;

    const html = this.getPasswordResetEmailTemplate(userName, resetLink);
    const text = `Hi ${userName},\n\nYou requested to reset your password. Click the following link to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, please ignore this email and your password will remain unchanged.\n\nBest regards,\nThe Aether Team`;

    await this.sendEmail({
      to,
      subject: 'Reset your password - Aether Collaboration Platform',
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
    }
    .content h2 {
      margin: 0 0 20px 0;
      font-size: 22px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .content p {
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #555555;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin: 20px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-1px);
    }
    .footer {
      padding: 30px;
      text-align: center;
      background-color: #f9f9f9;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #888888;
    }
    .link {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      margin: 30px 0;
      border: none;
      border-top: 1px solid #e5e5e5;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 20px;
      }
      .content {
        padding: 30px 20px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Aether</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName},</h2>
      <p>Thanks for signing up for Aether Collaboration Platform! We're excited to have you on board.</p>
      <p>To get started, please verify your email address by clicking the button below:</p>
      
      <div style="text-align: center;">
        <a href="${verificationLink}" class="button">Verify Email Address</a>
      </div>
      
      <hr class="divider">
      
      <p style="font-size: 14px; color: #777777;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 13px; color: #667eea; word-break: break-all;">
        ${verificationLink}
      </p>
      
      <p style="font-size: 14px; color: #999999; margin-top: 30px;">
        This link will expire in 24 hours.
      </p>
    </div>
    <div class="footer">
      <p>If you didn't create an account with Aether, please ignore this email.</p>
      <p style="margin-top: 15px;">
        <a href="${this.frontendUrl}" class="link">Visit Aether</a> • 
        <a href="${this.frontendUrl}/support" class="link">Support</a>
      </p>
      <p style="margin-top: 15px; color: #aaaaaa;">
        © ${new Date().getFullYear()} Aether Collaboration Platform. All rights reserved.
      </p>
    </div>
  </div>
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
    }
    .content h2 {
      margin: 0 0 20px 0;
      font-size: 22px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .content p {
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #555555;
    }
    .alert-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .alert-box p {
      margin: 0;
      font-size: 14px;
      color: #856404;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin: 20px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-1px);
    }
    .footer {
      padding: 30px;
      text-align: center;
      background-color: #f9f9f9;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #888888;
    }
    .link {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      margin: 30px 0;
      border: none;
      border-top: 1px solid #e5e5e5;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 20px;
      }
      .content {
        padding: 30px 20px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Aether</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName},</h2>
      <p>We received a request to reset your password for your Aether account.</p>
      <p>Click the button below to create a new password:</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      
      <hr class="divider">
      
      <p style="font-size: 14px; color: #777777;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 13px; color: #667eea; word-break: break-all;">
        ${resetLink}
      </p>
      
      <div class="alert-box">
        <p><strong>Security Notice:</strong> This link will expire in 1 hour for your protection.</p>
      </div>
      
      <p style="font-size: 14px; color: #999999; margin-top: 20px;">
        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact our support team.</p>
      <p style="margin-top: 15px;">
        <a href="${this.frontendUrl}" class="link">Visit Aether</a> • 
        <a href="${this.frontendUrl}/support" class="link">Support</a>
      </p>
      <p style="margin-top: 15px; color: #aaaaaa;">
        © ${new Date().getFullYear()} Aether Collaboration Platform. All rights reserved.
      </p>
    </div>
  </div>
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
