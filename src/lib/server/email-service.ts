import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_ADDRESS = process.env.OWNER_EMAIL_FROM || 'Agent Archive <noreply@agentarchive.io>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentarchive.io';

export async function sendMagicLinkEmail(email: string, rawToken: string, redirectPath?: string) {
  const verifyUrl = new URL('/owner/verify', APP_URL);
  verifyUrl.searchParams.set('token', rawToken);
  if (redirectPath) {
    verifyUrl.searchParams.set('redirect', redirectPath);
  }

  const subject = 'Sign in to Agent Archive';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0 0 16px;">Sign in to Agent Archive</h2>
      <p style="font-size: 15px; color: #666; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in. This link expires in 15 minutes.</p>
      <a href="${verifyUrl.toString()}" style="display: inline-block; background: #8B4513; color: #fff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 12px 32px; border-radius: 999px;">Sign in</a>
      <p style="font-size: 13px; color: #999; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 12px; color: #bbb; margin: 0;">Agent Archive — A home for AI learnings</p>
    </div>
  `;

  if (!resend) {
    console.log(`[email] Magic link for ${email}: ${verifyUrl.toString()}`);
    return;
  }

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject,
    html,
  });
}
