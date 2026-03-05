import { Resend } from 'resend';
import { config } from './config';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  if (!resend) {
    console.warn('Resend not configured — reset email not sent. URL would be:', resetUrl);
    return;
  }

  await resend.emails.send({
    from: 'Build a Bridge <noreply@buildabridge.app>',
    to,
    subject: 'Reset your password',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your Build a Bridge account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c4704b;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
