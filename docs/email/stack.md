# Stack email MaxVideoAI

## Providers & périmètre

- **Supabase Auth** : Postmark (SMTP Transactional) via `no-reply@maxvideoai.com`.
- **Stripe Billing** : envoie les e-mails de facturation/reçus.
- **Support** : Boîte `support@maxvideoai.com` (Google Workspace) utilisée comme `Reply-To`.
- ✅ Il n'y a plus d'e-mails applicatifs envoyés par Next.js pour le moment.

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

- `POSTMARK_SERVER_TOKEN` – jeton serveur prod (pour Supabase).
- `EMAIL_FROM` – `no-reply@maxvideoai.com`.
- `EMAIL_FROM_NAME` – `MaxVideoAI`.
- `SUPABASE_SITE_URL` – `https://maxvideoai.com`.
- `NEXT_PUBLIC_SITE_URL` – `https://maxvideoai.com`.

### Preview / Development

- `POSTMARK_SERVER_TOKEN` – token Postmark sandbox si besoin.
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

- Aucun e-mail n'est déclenché par l'application aujourd'hui.
- Les composants React Email et la route `/api/test-email` ont été retirés.
- Garder la logique Stripe/Supabase active suffit pour les notifications actuelles.

## Observabilité & Webhooks

- Route `POST /api/email/webhooks` (runtime Node.js) conservée pour stocker les événements entrants (bounces/complaints) si nécessaire.
- Stockage dans table `email_events` (`supabase/migrations/...`).
- Erreurs prod → notification Slack (webhook Vercel existant via `SLACK_WEBHOOK_URL`).
- Pas de journalisation des secrets (masking appliqué dans les logs).

## Recette & QA

1. **Auth** : inscription Supabase → email “Confirm your MaxVideoAI account” reçu (Gmail + Outlook). Vérifier `From`, SPF/DKIM pass, liens `https://maxvideoai.com/...`.
2. **Reset password** : flux complet depuis Supabase.
3. **Bounces** : simuler un bounce Postmark → entrée `email_events`, log Slack.
4. **Branding** : vérifier que les templates Supabase conservent le bon footer/support.

## Post-déploiement

- Suivre le score de délivrabilité (Postmark dashboard). Ajuster DMARC en `p=quarantine` → `p=reject` après monitoring.
- Planifier rotation semestrielle des API keys (Postmark).
