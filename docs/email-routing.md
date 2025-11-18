# Email Routing & SMTP

## Inbound (Cloudflare)

- MX records (priority 1/2/3):
  - `smtp.route1.mx.cloudflare.net`
  - `smtp.route2.mx.cloudflare.net`
  - `smtp.route3.mx.cloudflare.net`
- Cloudflare Email Routing rules:
  - `admin@maxvideoai.com` → forward to `admin@maxvideoai.com` (Gmail inbox)
  - `support@maxvideoai.com` → forward to `admin@maxvideoai.com`
  - Catch-all (`*@maxvideoai.com`) → forward to `admin@maxvideoai.com`
- No local mailboxes—everything is routed by Cloudflare.

## Outbound (Brevo SMTP)

Set the following environment variables (values supplied via Brevo):

```
SMTP_HOST=smtp-relay.sendinblue.com
SMTP_PORT=587
SMTP_USERNAME=BREVO_SMTP_LOGIN
SMTP_PASSWORD=BREVO_SMTP_KEY
SMTP_FROM="MaxVideoAI <admin@maxvideoai.com>"
```

The app falls back to legacy providers only if SMTP is not configured, so legacy env vars remain for now. Use `/api/email-test` after deployments to confirm delivery.
