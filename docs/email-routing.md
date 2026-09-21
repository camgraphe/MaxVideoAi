# Routage des e-mails

La référence maintenue est [Stack e-mail MaxVideoAI](email/stack.md).

Contrôle DNS du 21 septembre 2026 : le MX de `maxvideoai.com` pointe vers `smtp.google.com` (priorité 1). L'ancienne description de Cloudflare Email Routing et de ses redirections était obsolète. Vérifier les alias et transferts dans Google ; les DNS seuls ne les décrivent pas.

L'envoi applicatif passe par Brevo. Les e-mails Auth sont configurés séparément dans Supabase et utilisent actuellement Postmark. Consulter le document de référence avant toute modification DNS ou SMTP.
