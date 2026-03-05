# Stack email MaxVideoAI

## Stack applicative effective

- **Application Next.js** : envoi SMTP via `nodemailer`
- **Provider utilisé par l'app** : **Brevo SMTP**
- **Implémentation** : `frontend/server/mailer.ts`

## Flux réellement utilisés

- `frontend/app/api/contact/route.ts` envoie les messages du formulaire de contact
- `frontend/server/legal-reports.ts` notifie l’équipe légale quand `LEGAL_NOTIFY_EMAIL` est configuré
- `frontend/app/api/email-test/route.ts` permet de vérifier la configuration SMTP

## Variables d'environnement utiles

- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT`
- `BREVO_SMTP_USERNAME`
- `BREVO_SMTP_PASSWORD`
- `CONTACT_SENDER_EMAIL`
- `CONTACT_RECIPIENT_EMAIL`
- `LEGAL_NOTIFY_EMAIL`
- `SUPABASE_SITE_URL`
- `NEXT_PUBLIC_SITE_URL`

## Variables optionnelles

- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `EMAIL_TEST_TOKEN`

## Hors périmètre de ce repo

Ce dépôt ne contient pas d’intégration active pour :

- Resend
- Postmark
- Mailtrap
- des webhooks e-mail inbound

Les e-mails Stripe Billing et les e-mails système Supabase peuvent exister hors de ce codebase, mais ils ne font pas partie de la stack e-mail applicative active ici.
