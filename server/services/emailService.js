const { Resend } = require('resend');

// ─── Initialize Resend Client ───────────────────────────────────────────────
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new Resend(apiKey.trim());
};

// ─── HTML Email Template ─────────────────────────────────────────────────────
const buildPasswordResetHtml = (resetUrl, expiryMinutes = 15) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Growvest Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td>
              <div style="background:#ffffff;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;border-bottom:1px solid #e4e9e4;border-left:1px solid #e4e9e4;border-right:1px solid #e4e9e4;">
                <img src="cid:growvestlogo" alt="Growvest Logo" style="height:60px;width:auto;display:block;margin:0 auto;" />
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td>
              <div style="background:#ffffff;padding:40px;border-left:1px solid #e4e9e4;border-right:1px solid #e4e9e4;">
                <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">Reset Your Password</h2>
                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                  We received a request to reset the password for your Growvest account.
                  Click the button below to set a new password.
                </p>

                <!-- Button -->
                <div style="text-align:center;margin:32px 0;">
                  <a href="${resetUrl}"
                     style="display:inline-block;background:linear-gradient(135deg,#0E3D23,#1A5C39);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.3px;">
                    Reset Password →
                  </a>
                </div>

                <!-- Fallback link -->
                <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0 0 24px;">
                  Button not working? Copy and paste this link into your browser:<br/>
                  <a href="${resetUrl}" style="color:#1A5C39;word-break:break-all;">${resetUrl}</a>
                </p>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>

                <!-- Expiry warning -->
                <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin-bottom:20px;">
                  <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">
                    ⏱ This link expires in <strong>${expiryMinutes} minutes</strong>.
                  </p>
                </div>

                <!-- Security notice -->
                <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:16px;">
                  <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">
                    🔒 Security Notice
                  </p>
                  <p style="margin:6px 0 0;color:#7f1d1d;font-size:13px;line-height:1.5;">
                    If you did not request a password reset, please ignore this email.
                    Your password will remain unchanged. This link is single-use only and will
                    expire automatically.
                  </p>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              <div style="background:#f9fafb;border:1px solid #e4e9e4;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
                  Need help? Contact us at
                  <a href="mailto:support@growvest.in" style="color:#1A5C39;font-weight:600;">support@growvest.in</a>
                  or WhatsApp us at
                  <a href="https://wa.me/918300278515" style="color:#1A5C39;font-weight:600;">+91 83002 78515</a>
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">
                  © ${new Date().getFullYear()} Growvest. All rights reserved.<br/>
                  This is an automated security email. Please do not reply.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Send Password Reset Email ────────────────────────────────────────────────
/**
 * Sends a password reset email using Resend API.
 * @param {string} toEmail   - Recipient email address
 * @param {string} resetUrl  - Full reset URL (web or deep-link)
 * @param {number} expiryMin - Token expiry in minutes (default 15)
 */
const sendPasswordResetEmail = async (toEmail, resetUrl, expiryMin = 15) => {
  console.log(`[Resend] Initiating password reset email send to: ${toEmail}`);
  const resend = getResendClient();

  if (!resend) {
    console.error('[Resend] RESEND_API_KEY environment variable is missing.');
    throw new Error('Resend API Key not configured. Please set RESEND_API_KEY in environment variables.');
  }

  // Sender email (Resend default testing sender: 'onboarding@resend.dev' unless custom domain is verified)
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  // Read local logo file and prepare inline CID attachment
  let attachments = [];
  try {
    const fs = require('fs');
    const path = require('path');
    const logoPath = path.join(__dirname, '../../app/assets/growvest-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      attachments = [
        {
          filename: 'growvest-logo.png',
          content: logoBuffer,
          cid: 'growvestlogo',
        }
      ];
    }
  } catch (err) {
    console.warn('[Resend] Logo attachment failed (non-fatal):', err.message);
  }

  const { data, error } = await resend.emails.send({
    from: `Growvest Security <${fromEmail}>`,
    to: [toEmail],
    subject: '🔐 Reset Your Growvest Password',
    text: `Reset your Growvest password by visiting this link (expires in ${expiryMin} minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: buildPasswordResetHtml(resetUrl, expiryMin),
    attachments,
  });

  if (error) {
    console.error('[Resend Error]', error);
    if (error.name === 'validation_error' && error.message?.includes('domain')) {
      throw new Error('Resend unverified domain error: Testing mode only sends to account email unless custom domain is verified in Resend.');
    }
    throw new Error(error.message || 'Failed to send email via Resend API');
  }

  console.log(`[Resend Success] Email sent via Resend API! ID: ${data?.id}`);
  return data;
};

module.exports = { sendPasswordResetEmail };
