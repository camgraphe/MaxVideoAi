# Stack email MaxVideoAI

## Providers & périmètre

- **Supabase Auth** : Postmark (SMTP Transactional) via `no-reply@maxvideoai.com`.
- **Emails applicatifs Next.js** : Resend (API) avec React Email.
- **Staging / previews** : Mailtrap (capture sandbox).
- **Support** : Boîte `support@maxvideoai.com` (Google Workspace) utilisée comme `Reply-To`.

## DNS & délivrabilité

1. Créer le sous-domaine d'envoi `mail.maxvideoai.com` (ou `mg.maxvideoai.com`).
2. Ajouter les enregistrements fournis par chaque provider :
   - **SPF (TXT)** : inclure Postmark et Resend (`include:`). Ne pas supprimer l'entrée Workspace existante.
   - **DKIM (TXT)** : clés générées par Postmark + Resend (1 entrée par clé).
   - **Return-Path / Bounce (CNAME)** : cible Postmark (`pm-bounces`).
   - **DMARC (TXT)** : `v=DMARC1; p=quarantine; rua=mailto:dmarc@maxvideoai.com; fo=1`.
3. Vérifier la propagation (Postmark Sender Signatures + Resend Domain Setup).
4. Héberger logo/favicons sur `https://maxvideoai.com/…` (fichiers déjà dans `frontend/public`).

## Secrets & variables d'environnement

### Production (Vercel)

- `POSTMARK_SERVER_TOKEN` – jeton serveur prod.
- `RESEND_API_KEY` – clé API prod.
- `EMAIL_FROM` – `no-reply@maxvideoai.com`.
- `EMAIL_FROM_NAME` – `MaxVideoAI`.
- `SUPABASE_SITE_URL` – `https://maxvideoai.com`.
- `NEXT_PUBLIC_SITE_URL` – `https://maxvideoai.com`.

### Preview / Development

- `POSTMARK_SERVER_TOKEN` – token Postmark sandbox si besoin (sinon Mailtrap uniquement).
- `RESEND_API_KEY` – clé Resend test/sandbox (`re_...`).
- `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS` – credentials inbox Mailtrap.
- `EMAIL_FROM` – alias sandbox (ex. `no-reply@mailtrap.maxvideoai.com`).
- `EMAIL_FROM_NAME` – `MaxVideoAI`.
- `SUPABASE_SITE_URL` – URL preview Vercel.
- `NEXT_PUBLIC_SITE_URL` – URL preview Vercel.

> ⚠️ Les tokens restent exclusivement dans Vercel (Production, Preview, Development). Ne jamais les ajouter aux commits.

## Supabase Auth

1. **Project Settings → Auth → URL Configuration**  
   - `SITE URL` : `https://maxvideoai.com` (ou preview selon environnement).
   - `Redirect URLs` : ajouter `https://maxvideoai.com/*` + preview.
2. **Auth → Email Templates**  
   - `Confirm signup`, `Magic Link`, `Reset password`.
   - HTML + texte disponibles dans `supabase/templates/*.html|txt`. Conserver les placeholders Supabase (`{{ .Email }}`, `{{ .ConfirmationURL }}`, `{{ .ActionLink }}`).
   - Préheader recommandé : “Active ton workspace MaxVideoAI” (déjà présent dans les templates HTML).
3. **Auth → Emails → SMTP Settings**
   - Host `smtp.postmarkapp.com`, port `587`, TLS activé.
   - Username & Password = `POSTMARK_SERVER_TOKEN`.
   - `From email` : `no-reply@maxvideoai.com`.
   - `From name` : `MaxVideoAI`.
   - `Reply-to` : `support@maxvideoai.com`.

## Application Next.js

- Lib d'envoi dans `frontend/src/lib/email.ts` (choix runtime en fonction de l'environnement).
- Provider:
  - **Prod** : Resend API.
  - **Preview/Dev** : SMTP Mailtrap (fallback Resend test si Mailtrap injoignable).
- Templates React Email dans `frontend/emails/RenderCompletedEmail.tsx` et `frontend/emails/WalletLowBalanceEmail.tsx`.
- Endpoint interne `POST /api/test-email` pour smoke test (ajouter `x-admin-key: $CRON_SECRET`).

## Observabilité & Webhooks

- Route `POST /api/email/webhooks` (runtime Node.js) reçoit événements Postmark/Resend (bounces, complaints).
- Stockage dans table `email_events` (`supabase/migrations/...`).
- Erreurs prod → notification Slack (webhook Vercel existant via `SLACK_WEBHOOK_URL`).
- Pas de journalisation des secrets (masking appliqué dans les logs).

## Recette & QA

1. **Auth** : inscription Supabase → email “Confirm your MaxVideoAI account” reçu (Gmail + Outlook). Vérifier `From`, SPF/DKIM pass, liens `https://maxvideoai.com/...`.
2. **Reset password** : flux complet depuis Supabase.
3. **Applicatif** : `POST /api/test-email` sur preview → message capturé dans Mailtrap (HTML + texte).
4. **Bounces** : simuler un bounce Postmark → entrée `email_events`, log Slack.
5. **Branding** : header/logo/preheader/CTA conformes, footer minimal (raison sociale + support).

## Post-déploiement

- Ajouter un smoke-test automatisé : hook Vercel post-déploiement qui déclenche `/api/test-email` sur previews.
- Suivre le score de délivrabilité (Postmark dashboard). Ajuster DMARC en `p=quarantine` → `p=reject` après monitoring.
- Planifier rotation semestrielle des API keys (Postmark & Resend).
