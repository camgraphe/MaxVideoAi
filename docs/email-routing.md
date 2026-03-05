# Email Routing & SMTP

## Inbound (Cloudflare)

- MX records (priority 1/2/3):
  - `smtp.route1.mx.cloudflare.net`
  - `smtp.route2.mx.cloudflare.net`
  - `smtp.route3.mx.cloudflare.net`
- Cloudflare Email Routing rules:
  - `admin@maxvideoai.com` → forward to `admin@maxvideoai.com`
  - `support@maxvideoai.com` → forward to `admin@maxvideoai.com`
  - Catch-all (`*@maxvideoai.com`) → forward to `admin@maxvideoai.com`

## Outbound (Brevo SMTP)

Set the following environment variables:

```bash
BREVO_SMTP_HOST=smtp-relay.sendinblue.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USERNAME=BREVO_SMTP_LOGIN
BREVO_SMTP_PASSWORD=BREVO_SMTP_KEY
CONTACT_SENDER_EMAIL="MaxVideoAI <support@maxvideoai.com>"
CONTACT_RECIPIENT_EMAIL=contact@maxvideoai.com
```

Use `/api/email-test` after deployments to confirm delivery, authenticated either as an admin session or with `EMAIL_TEST_TOKEN`.
