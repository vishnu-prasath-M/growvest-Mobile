# ─── Forgot Password / Email Service Setup ───────────────────────────────────
#
# Add these environment variables to your server's .env (or Render dashboard)
# to enable the password reset email feature.
#
# EMAIL_SERVICE: The email provider. Default: gmail
#   Options: gmail, outlook, yahoo, sendgrid (for sendgrid, use 'smtp.sendgrid.net')
EMAIL_SERVICE=gmail

# EMAIL_USER: The email address that sends reset emails.
#   For Gmail: your Gmail address (e.g. your-app@gmail.com)
EMAIL_USER=your-email@gmail.com

# EMAIL_PASS: App Password (NOT your regular password).
#   For Gmail:
#     1. Enable 2-Step Verification on your Google account
#     2. Go to: Google Account → Security → App Passwords
#     3. Generate an App Password for "Mail"
#     4. Paste the 16-character code here (no spaces)
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx

# APP_URL: The public URL of your server (used in reset email links)
#   In development: http://localhost:5000
#   In production: https://growvest-mobile.onrender.com
APP_URL=https://growvest-mobile.onrender.com

# ─── How to set these on Render ──────────────────────────────────────────────
# 1. Go to your Render service dashboard
# 2. Click "Environment" in the left sidebar
# 3. Add the three variables above: EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS, APP_URL
# 4. Click "Save Changes" — Render will redeploy automatically
#
# ─── Security Notes ──────────────────────────────────────────────────────────
# • NEVER commit EMAIL_PASS to git. Use .env files or secret management.
# • Use Gmail App Passwords, not your main Google password.
# • For production, consider SendGrid or Resend for higher deliverability.
