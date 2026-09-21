# Stack e-mail MaxVideoAI

État vérifié le 21 septembre 2026. Une variable présente dans Vercel ne prouve pas qu'un fournisseur est utilisé.

## Circuits et responsabilités

| Usage | Propriétaire | Transport/configuration |
| --- | --- | --- |
| Confirmation de compte, récupération, autres e-mails Auth | Supabase Auth | Brevo SMTP dans le tableau de bord Supabase, enregistré le 21/09/2026 ; test reçu en Spam sur Gmail, réception principale à améliorer |
| Formulaire de contact | `frontend/app/api/contact/route.ts` | Brevo via `frontend/server/mailer.ts`, variables Vercel |
| Notification légale | `frontend/server/legal-reports.ts` | Même Brevo si `LEGAL_NOTIFY_EMAIL` existe ; sinon notification Slack ; rapport d'abord enregistré en base |
| Alertes de coûts | `frontend/app/api/cron/infra-costs-alert/route.ts` | Même Brevo si `INFRA_COST_ALERT_EMAIL_TO` existe |
| Réception des boîtes du domaine | Messagerie du domaine | MX public Google (`smtp.google.com`), alias à vérifier dans Google |
| Reçus et factures automatiques Stripe | Configuration Stripe | Non auditée dans cette intervention ; distincte du mailer applicatif |

Les e-mails Auth ne passent pas par Next.js, Nodemailer ou les clés Postmark/Resend de Vercel. Modifier le mailer applicatif ne répare pas le SMTP de Supabase. `supabase/config.toml` décrit le développement local, pas l'état du projet hébergé.

## Configuration applicative

- `BREVO_SMTP_HOST` : défaut `smtp-relay.sendinblue.com`.
- `BREVO_SMTP_PORT` : défaut `587` ; `465` utilise TLS dès la connexion.
- `BREVO_SMTP_USERNAME`, `BREVO_SMTP_PASSWORD` : identifiants SMTP, distincts des clés API et des adresses d'expédition.
- `CONTACT_SENDER_EMAIL` : expéditeur explicite, par exemple `MaxVideoAI <support@maxvideoai.com>` ; `EMAIL_FROM` est le repli compatible.
- `CONTACT_RECIPIENT_EMAIL` : destinataire interne du formulaire de contact.
- `LEGAL_NOTIFY_EMAIL`, `INFRA_COST_ALERT_EMAIL_TO` : destinations optionnelles.
- `EMAIL_TEST_TOKEN` : accès facultatif au diagnostic, sinon session admin.

`frontend/server/mailer-config.ts` résout cette configuration. Le transport exige TLS, borne les délais réseau et reste désactivé sans identifiants et expéditeur. Tous les envois applicatifs partagent `frontend/server/mailer.ts`.

## Diagnostic

Après déploiement du correctif de cet audit, `GET /api/email-test`, authentifié par session admin ou `EMAIL_TEST_TOKEN`, vérifie connexion et authentification SMTP sans envoyer de message. La réponse précise `scope: application_smtp` et `emailSent: false`. Avant ce correctif, GET envoyait réellement un e-mail.

`POST /api/email-test` conserve l'envoi explicite d'un message de test, avec un destinataire contrôlé dans `{ "to": "..." }`. Une connexion SMTP valide ne prouve ni l'acceptation d'un expéditeur ni la livraison en boîte de réception. Ce diagnostic ne teste pas Supabase Auth.

## Vestiges identifiés

- Vercel contient `POSTMARK_SERVER_TOKEN`, `RESEND_API_KEY`, `SUPPORT_EMAIL` et `EMAIL_FROM_NAME`, sans consommateur applicatif actuel trouvé. `EMAIL_FROM_NAME` a été retiré du lecteur de configuration et de l'exemple local ; le nom peut faire partie de l'adresse d'expédition.
- Les dépendances React Email sont présentes sans import dans le code actuel ; contrôler les scripts externes avant retrait.
- La table historique `email_events` possède une migration et un bootstrap, mais aucun producteur/lecteur applicatif trouvé. Elle ne constitue pas un suivi de livraison opérationnel. Conserver ses données et migrations.
- Ne pas supprimer les secrets distants avant vérification des anciens déploiements et usages externes. Une clé Vercel inutilisée et la clé SMTP enregistrée dans Supabase sont deux configurations distinctes.

## Authentification et langues

Voir [la continuité de langue](../engineering/auth-locale-continuity.md). La langue du site et de son retour d'authentification est indépendante du contenu des modèles hébergés dans Supabase. Le modèle Recovery observé est le modèle anglais par défaut. Le passage du SMTP Supabase à Brevo a été confirmé par une nouvelle lecture du tableau de bord après enregistrement par l’utilisateur ; cela ne déploie pas les changements Next.js. Un test réel autorisé vers la boîte admin a été reçu en Spam le 21/09 à 15:45, avec signature du domaine affichée par Gmail. La délivrabilité reste à traiter.

Le correctif local ajoute `/auth/reset-password`. Les demandes portent `flow=recovery` : le callback dirige vers ce formulaire, qui vérifie la preuve après un clic explicite, puis appelle `supabase.auth.updateUser({ password })`. Il ne réutilise jamais une session existante comme preuve de récupération. Les liens sans preuve ou expirés proposent une nouvelle demande ; le retour `next` est limité au site. Les identifiants temporaires sont retirés de l’URL et cette route exclut les analytics.

Le modèle hébergé utilise encore `ConfirmationURL` : avec PKCE, le lien doit être ouvert dans le navigateur de la demande. La prise en charge locale de `token_hash` prépare un modèle ultérieur compatible avec un autre navigateur, mais ce modèle n’est pas publié. Le SMTP et un test de réception/changement réel restent nécessaires avant de déclarer la récupération fonctionnelle.

Voir [l'audit du 21 septembre 2026](audit-2026-09-21.md) pour les preuves, limites et opérations recommandées.

## Branded Supabase templates

`node scripts/email/auth-templates.mjs` generates confirmation, recovery and magic-link HTML/text from one shared shell. `--check` detects drift. Hosted templates must be published separately in Supabase; committing local files does not update hosted Auth. The local CLI sections are `confirmation`, `recovery`, and `magic_link`.

Signup writes `user_metadata.locale` (en/fr/es). Email content uses that saved preference, with English for existing accounts without a preference. It does not infer language from IP. Recovery page language/continuation come from the request's encoded `RedirectTo`, restricted to the production callback and sanitized independently. Email language for an existing account may differ from a later unauthenticated language choice; changing it requires an authenticated preference update or a future email hook.

Recovery emails link directly to the MaxVideoAI recovery page with a one-time `TokenHash`. An explicit Continue action verifies it, so a GET from a mail scanner does not consume it, and no original-browser PKCE verifier is required. Other auth templates retain the supported `ConfirmationURL`. Never use the obsolete `ActionLink` placeholder. No secrets or real recovery links belong in previews, logs, analytics, or git.

The template logo is the existing public PNG; layout uses tables and inline styles. Support is `support@maxvideoai.com`. No fixed expiration is promised in copy because hosted expiry is configured independently.
