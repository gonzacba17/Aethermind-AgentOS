import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

/**
 * Email Service - Flexible email sending supporting SendGrid and SMTP
 * Features:
 * - Automatic provider detection based on env vars
 * - Development mode with Ethereal email (preview URLs)
 * - HTML template support
 * - Graceful fallback and error handling
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private provider: 'sendgrid' | 'smtp' | 'ethereal' | 'none' = 'none';
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor() {
    this.from = process.env.FROM_EMAIL || 'noreply@aethermind.com';
    this.initialize();
  }

  private async initialize() {
    // Option 1: SendGrid (preferred for production)
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.provider = 'sendgrid';
      console.log('✅ Email Service: SendGrid configured');
      return;
    }

    // Option 2: SMTP (good for custom mail servers)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.provider = 'smtp';
      console.log('✅ Email Service: SMTP configured');
      return;
    }

    // Option 3: Ethereal (development/testing - generates preview URLs)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.provider = 'ethereal';
        console.log('⚠️  Email Service: Using Ethereal (test mode) - emails will not be delivered');
        console.log('   Configure SENDGRID_API_KEY or SMTP credentials for real emails');
        return;
      } catch (error) {
        console.warn('⚠️  Email Service: Could not create Ethereal account:', error);
      }
    }

    // No email provider configured
    this.provider = 'none';
    console.warn('⚠️  Email Service: No provider configured - emails will be logged only');
    console.warn('   Set SENDGRID_API_KEY or SMTP credentials to enable email sending');
  }

  /**
   * Send email using configured provider
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, html, text } = options;

    try {
      switch (this.provider) {
        case 'sendgrid':
          await sgMail.send({
            to,
            from: this.from,
            subject,
            html,
            text: text || this.stripHtml(html),
          });
          console.log(`✅ Email sent via SendGrid to ${to}: ${subject}`);
          break;

        case 'smtp':
        case 'ethereal':
          if (!this.transporter) {
            throw new Error('Email transporter not initialized');
          }
          const info = await this.transporter.sendMail({
            from: this.from,
            to,
            subject,
            html,
            text: text || this.stripHtml(html),
          });

          if (this.provider === 'ethereal') {
            console.log(`📧 Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            console.log(`   Subject: ${subject}`);
            console.log(`   To: ${to}`);
          } else {
            console.log(`✅ Email sent via SMTP to ${to}: ${subject}`);
          }
          break;

        case 'none':
          console.log(`📧 [EMAIL NOT SENT - No provider configured]`);
          console.log(`   To: ${to}`);
          console.log(`   Subject: ${subject}`);
          console.log(`   Body preview: ${this.stripHtml(html).substring(0, 100)}...`);
          break;
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <h2>Welcome to Aethermind!</h2>
              <p>Thank you for signing up. Please verify your email address to get started:</p>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p style="margin-top: 30px; color: #666;">This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>If you didn't create an account, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} Aethermind. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify your Aethermind account',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reset Your Password</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #f5576c;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p>This link will expire in 1 hour for your security.</p>
              </div>
            </div>
            <div class="footer">
              <p>If you didn't request a password reset, please ignore this email.</p>
              <p>Your password will not change until you access the link above and create a new one.</p>
              <p>&copy; ${new Date().getFullYear()} Aethermind. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Reset your Aethermind password',
      html,
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(email: string, userName: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const billingUrl = `${frontendUrl}/settings/billing`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .alert { background: #ffe3e3; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Payment Failed</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <div class="alert">
                <strong>Action Required:</strong>
                <p>We were unable to process your subscription payment.</p>
              </div>
              <p>To continue using your Pro/Enterprise features, please update your payment method:</p>
              <a href="${billingUrl}" class="button">Update Payment Method</a>
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Your subscription will be retried automatically</li>
                <li>If payment fails after multiple attempts, your account will be downgraded to Free</li>
                <li>You can update your payment method at any time to restore access</li>
              </ul>
            </div>
            <div class="footer">
              <p>Questions? Contact support at support@aethermind.com</p>
              <p>&copy; ${new Date().getFullYear()} Aethermind. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: '⚠️ Aethermind - Payment Failed',
      html,
    });
  }

  /**
   * Send subscription canceled notification
   */
  async sendSubscriptionCanceledEmail(email: string, userName: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const pricingUrl = `${frontendUrl}/pricing`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #868e96 0%, #495057 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .info { background: #e7f5ff; border-left: 4px solid #339af0; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Subscription Canceled</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Your Aethermind subscription has been canceled. You've been moved to the Free plan.</p>
              <div class="info">
                <strong>Free Plan Includes:</strong>
                <ul>
                  <li>Up to 3 agents</li>
                  <li>Basic workflow capabilities</li>
                  <li>30-day log retention</li>
                  <li>Community support</li>
                </ul>
              </div>
              <p>Want to restore your Pro/Enterprise features?</p>
              <a href="${pricingUrl}" class="button">View Plans</a>
              <p>We're sorry to see you go. If you have feedback on how we can improve, please let us know!</p>
            </div>
            <div class="footer">
              <p>Contact us at support@aethermind.com</p>
              <p>&copy; ${new Date().getFullYear()} Aethermind. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Aethermind Subscription Canceled',
      html,
    });
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Check if email service is available
   */
  isConfigured(): boolean {
    return this.provider !== 'none';
  }

  /**
   * Get current provider name
   */
  getProvider(): string {
    return this.provider;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
