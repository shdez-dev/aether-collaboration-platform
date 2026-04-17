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

    this.fromEmail = process.env.EMAIL_FROM || 'aether.notifications@gmail.com';
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
    const text = `Hi ${userName},\n\nPlease verify your email address by clicking the following link:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account with Aether, please ignore this email.\n\nBest regards,\nThe Aether Team`;

    await this.sendEmail({
      to,
      subject: 'Verify your email - Aether Collaboration Platform',
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
  <title>Verify Your Email - AETHER</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'JetBrains Mono', monospace;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #e0e0e0;
      line-height: 1.6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #121212;
      border: 2px solid #3b82f6;
      position: relative;
    }
    .scanline {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        to bottom,
        transparent 50%,
        rgba(59, 130, 246, 0.03) 50%
      );
      background-size: 100% 4px;
      pointer-events: none;
    }
    .terminal-header {
      background: #1a1a1a;
      border-bottom: 2px solid #3b82f6;
      padding: 16px 24px;
    }
    .terminal-title {
      font-size: 13px;
      color: #60a5fa;
      font-weight: 500;
      letter-spacing: 0.1em;
    }
    .content {
      padding: 32px 24px;
      position: relative;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    }
    .prompt {
      color: #3b82f6;
      font-weight: 600;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .prompt::before {
      content: "> ";
      color: #60a5fa;
      margin-right: 8px;
    }
    .message {
      color: #d1d5db;
      font-size: 14px;
      line-height: 1.8;
      margin-bottom: 16px;
    }
    .command-block {
      background: #0a0a0a;
      border: 1px solid #3b82f6;
      padding: 16px;
      margin: 24px 0;
      font-size: 13px;
      position: relative;
    }
    .command-block::before {
      content: "$ ";
      color: #60a5fa;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      background: #3b82f6;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 2px solid #3b82f6;
      margin: 24px 0;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .button:hover {
      background: transparent;
      color: #3b82f6 !important;
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
    }
    .button::before {
      content: ">";
      position: absolute;
      left: 12px;
      transition: all 0.2s;
    }
    .button:hover::before {
      left: calc(100% - 24px);
    }
    .divider {
      height: 1px;
      background: linear-gradient(
        to right,
        transparent,
        #3b82f6,
        transparent
      );
      margin: 32px 0;
    }
    .link-box {
      background: #1a1a1a;
      border: 1px solid #374151;
      padding: 12px;
      margin: 16px 0;
      font-size: 11px;
      color: #3b82f6;
      word-break: break-all;
      font-family: 'JetBrains Mono', monospace;
    }
    .info-box {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      padding: 12px 16px;
      margin: 24px 0;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer {
      background: #0a0a0a;
      border-top: 2px solid #3b82f6;
      padding: 24px;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #6b7280;
      margin: 8px 0;
      letter-spacing: 0.05em;
    }
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
      margin: 0 8px;
      transition: all 0.2s;
    }
    .footer-link:hover {
      color: #60a5fa;
      text-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { margin: 20px; border-width: 1px; }
      .content { padding: 24px 16px; }
      .logo { font-size: 20px; }
      .button { padding: 12px 24px; font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="scanline"></div>
    
    <div class="terminal-header">
      <div class="terminal-title">AETHER://VERIFICATION</div>
    </div>
    
    <div class="content">
      <div class="logo">AETHER</div>
      
      <div class="prompt">SYSTEM MESSAGE</div>
      <div class="message">
        Welcome, <strong>${userName}</strong>.<br><br>
        Your account has been successfully created in the AETHER network.<br>
        To activate your credentials and gain full access, verify your identity.
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationLink}" class="button">
          VERIFY IDENTITY
        </a>
      </div>
      
      <div class="divider"></div>
      
      <div class="command-block">
        Or execute manual verification:<br>
        <div class="link-box">${verificationLink}</div>
      </div>
      
      <div class="info-box">
        [!] SECURITY NOTICE<br>
        - Link expires in 24 hours<br>
        - Single use only<br>
        - If you didn't request this, ignore this transmission
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-text">
        [ <a href="${this.frontendUrl}" class="footer-link">AETHER.PLATFORM</a> ]
        [ <a href="${this.frontendUrl}/support" class="footer-link">SUPPORT</a> ]
      </div>
      <div class="footer-text" style="margin-top: 16px;">
        © ${new Date().getFullYear()} AETHER COLLABORATION PLATFORM<br>
        ALL SYSTEMS OPERATIONAL
      </div>
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
  <title>Password Reset - AETHER</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'JetBrains Mono', monospace;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #e0e0e0;
      line-height: 1.6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #121212;
      border: 2px solid #3b82f6;
      position: relative;
    }
    .scanline {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        to bottom,
        transparent 50%,
        rgba(59, 130, 246, 0.03) 50%
      );
      background-size: 100% 4px;
      pointer-events: none;
    }
    .terminal-header {
      background: #1a1a1a;
      border-bottom: 2px solid #3b82f6;
      padding: 16px 24px;
    }
    .terminal-dots {
      display: flex;
      gap: 8px;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid;
    }
    .dot.red { background: #ef4444; border-color: #dc2626; }
    .dot.yellow { background: #f59e0b; border-color: #d97706; }
    .dot.green { background: #10b981; border-color: #059669; }
    .terminal-title {
      font-size: 13px;
      color: #9ca3af;
      font-weight: 500;
      letter-spacing: 0.05em;
    }
    .content {
      padding: 32px 24px;
      position: relative;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    }
    .prompt {
      color: #3b82f6;
      font-weight: 600;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .prompt::before {
      content: "> ";
      color: #60a5fa;
      margin-right: 8px;
    }
    .message {
      color: #d1d5db;
      font-size: 14px;
      line-height: 1.8;
      margin-bottom: 16px;
    }
    .command-block {
      background: #0a0a0a;
      border: 1px solid #3b82f6;
      padding: 16px;
      margin: 24px 0;
      font-size: 13px;
      position: relative;
    }
    .command-block::before {
      content: "$ ";
      color: #60a5fa;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      background: #3b82f6;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 2px solid #3b82f6;
      margin: 24px 0;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .button:hover {
      background: transparent;
      color: #3b82f6 !important;
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
    }
    .button::before {
      content: ">";
      position: absolute;
      left: 12px;
      transition: all 0.2s;
    }
    .button:hover::before {
      left: calc(100% - 24px);
    }
    .divider {
      height: 1px;
      background: linear-gradient(
        to right,
        transparent,
        #3b82f6,
        transparent
      );
      margin: 32px 0;
    }
    .link-box {
      background: #1a1a1a;
      border: 1px solid #374151;
      padding: 12px;
      margin: 16px 0;
      font-size: 11px;
      color: #3b82f6;
      word-break: break-all;
      font-family: 'JetBrains Mono', monospace;
    }
    .warning-box {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      padding: 12px 16px;
      margin: 24px 0;
      font-size: 12px;
      color: #93c5fd;
    }
    .info-box {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      padding: 12px 16px;
      margin: 24px 0;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer {
      background: #0a0a0a;
      border-top: 2px solid #3b82f6;
      padding: 24px;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #6b7280;
      margin: 8px 0;
      letter-spacing: 0.05em;
    }
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
      margin: 0 8px;
      transition: all 0.2s;
    }
    .footer-link:hover {
      color: #60a5fa;
      text-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { margin: 20px; border-width: 1px; }
      .content { padding: 24px 16px; }
      .logo { font-size: 20px; }
      .button { padding: 12px 24px; font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="scanline"></div>
    
    <div class="terminal-header">
      <div class="terminal-title">AETHER://SECURITY_ALERT</div>
    </div>
    
    <div class="content">
      <div class="logo">AETHER</div>
      
      <div class="prompt">SECURITY PROTOCOL INITIATED</div>
      <div class="message">
        Alert, <strong>${userName}</strong>.<br><br>
        A password reset request has been detected for your AETHER account.<br>
        If you initiated this request, proceed with the reset sequence below.
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" class="button">
          RESET PASSWORD
        </a>
      </div>
      
      <div class="divider"></div>
      
      <div class="command-block">
        Or execute manual reset:<br>
        <div class="link-box">${resetLink}</div>
      </div>
      
      <div class="warning-box">
        [!] CRITICAL SECURITY NOTICE<br>
        - Link expires in 1 hour<br>
        - Single use authentication token<br>
        - Immediate expiration upon use
      </div>
      
      <div class="info-box">
        [?] DID NOT REQUEST THIS?<br>
        If you did not initiate this reset, your account may be at risk.<br>
        Ignore this message and your credentials will remain unchanged.<br>
        Consider enabling two-factor authentication.
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-text">
        [ <a href="${this.frontendUrl}" class="footer-link">AETHER.PLATFORM</a> ]
        [ <a href="${this.frontendUrl}/support" class="footer-link">SUPPORT</a> ]
      </div>
      <div class="footer-text" style="margin-top: 16px;">
        © ${new Date().getFullYear()} AETHER COLLABORATION PLATFORM<br>
        SECURITY SYSTEMS ACTIVE
      </div>
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
