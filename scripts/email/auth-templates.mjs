import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const copy = {
  en: {
    footer: 'Need help? Contact', ignore: 'If you did not request this email, you can safely ignore it.',
    recovery: ['Reset your password', 'We received a request to reset your MaxVideoAI password. Use the button below to choose a new one.', 'Choose a new password', 'Your password stays unchanged until you save a new one. This personal link can only be used once.'],
    confirmation: ['Confirm your email address', 'Welcome to MaxVideoAI. Confirm your email address to finish creating your account.', 'Confirm my email', 'This personal link can only be used once.'],
    magic_link: ['Your sign-in link', 'Use the button below to sign in to your MaxVideoAI account.', 'Sign in to MaxVideoAI', 'This personal link can only be used once. Never share it.'],
  },
  fr: {
    footer: 'Besoin d’aide ? Contactez', ignore: 'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail.',
    recovery: ['Réinitialisez votre mot de passe', 'Nous avons reçu une demande de réinitialisation de votre mot de passe MaxVideoAI. Utilisez le bouton ci-dessous pour en choisir un nouveau.', 'Choisir un nouveau mot de passe', 'Votre mot de passe reste inchangé tant que vous n’en enregistrez pas un nouveau. Ce lien personnel est à usage unique.'],
    confirmation: ['Confirmez votre adresse e-mail', 'Bienvenue sur MaxVideoAI. Confirmez votre adresse e-mail pour terminer la création de votre compte.', 'Confirmer mon adresse e-mail', 'Ce lien personnel est à usage unique.'],
    magic_link: ['Votre lien de connexion', 'Utilisez le bouton ci-dessous pour vous connecter à votre compte MaxVideoAI.', 'Me connecter à MaxVideoAI', 'Ce lien personnel est à usage unique. Ne le partagez jamais.'],
  },
  es: {
    footer: '¿Necesitas ayuda? Contacta con', ignore: 'Si no has solicitado este correo, puedes ignorarlo.',
    recovery: ['Restablece tu contraseña', 'Hemos recibido una solicitud para restablecer tu contraseña de MaxVideoAI. Usa el botón para elegir una nueva.', 'Elegir una nueva contraseña', 'Tu contraseña no cambiará hasta que guardes una nueva. Este enlace personal solo se puede usar una vez.'],
    confirmation: ['Confirma tu correo electrónico', 'Te damos la bienvenida a MaxVideoAI. Confirma tu correo electrónico para terminar de crear tu cuenta.', 'Confirmar mi correo', 'Este enlace personal solo se puede usar una vez.'],
    magic_link: ['Tu enlace de acceso', 'Usa el botón para iniciar sesión en tu cuenta de MaxVideoAI.', 'Iniciar sesión en MaxVideoAI', 'Este enlace personal solo se puede usar una vez. No lo compartas.'],
  },
};
export const templateFiles = { recovery: 'reset-password', confirmation: 'confirm-signup', magic_link: 'magic-link' };
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const localized = (values) => `{{ if eq .Data.locale "fr" }}${values.fr}{{ else if eq .Data.locale "es" }}${values.es}{{ else }}${values.en}{{ end }}`;

export function renderAuthTemplate(kind, previewLocale) {
  const value = (get) => previewLocale ? get(copy[previewLocale]) : localized(Object.fromEntries(Object.entries(copy).map(([locale, text]) => [locale, get(text)])));
  const lang = previewLocale ?? localized({ en: 'en', fr: 'fr', es: 'es' });
  const title = value(c => esc(c[kind][0]));
  const link = previewLocale ? 'https://maxvideoai.com/auth/reset-password?preview=1' : kind === 'recovery'
    ? '{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&amp;redirect_to={{ .RedirectTo | urlquery }}'
    : '{{ .ConfirmationURL }}';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MaxVideoAI — ${title}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;color:#17212e;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${title} · MaxVideoAI</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e2e5ea;border-radius:16px">
<tr><td style="padding:32px 28px 24px;border-bottom:1px solid #e2e5ea"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="https://maxvideoai.com/apple-touch-icon.png" alt="" width="40" height="40" style="display:block;border:0;border-radius:8px"></td><td style="padding-left:12px;font-size:22px;font-weight:700;color:#17212e">MaxVideoAI</td></tr></table></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;font-weight:700">${title}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.65">${value(c => esc(c[kind][1]))}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#111827" style="border-radius:8px;text-align:center"><a href="${link}" style="display:inline-block;padding:16px 22px;border:1px solid #111827;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;line-height:1.4">${value(c => esc(c[kind][2]))}</a></td></tr></table>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#526071">${value(c => esc(c[kind][3]))}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#526071">${value(c => esc(c.ignore))}</p></td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e2e5ea;font-size:13px;line-height:1.6;color:#526071">${value(c => esc(c.footer))} <a href="mailto:support@maxvideoai.com" style="color:#17212e">support@maxvideoai.com</a><br>MaxVideoAI · <a href="https://maxvideoai.com" style="color:#526071;text-decoration:none">maxvideoai.com</a></td></tr>
</table></td></tr></table></body></html>
`;
}

export function renderAuthSubject(kind) {
  return 'MaxVideoAI — ' + localized(Object.fromEntries(Object.entries(copy).map(([locale, c]) => [locale, c[kind][0]])));
}

export function renderAuthText(kind) {
  return localized(Object.fromEntries(Object.entries(copy).map(([locale,c]) => [locale, `MaxVideoAI\n\n${c[kind][0]}\n\n${c[kind][1]}\n\n${kind === 'recovery' ? '{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&redirect_to={{ .RedirectTo | urlquery }}' : '{{ .ConfirmationURL }}'}\n\n${c[kind][3]}\n\n${c.ignore}\n\n${c.footer} support@maxvideoai.com\n`])));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [kind, file] of Object.entries(templateFiles)) {
    for (const [extension, content] of [['html', renderAuthTemplate(kind)], ['txt', renderAuthText(kind)]]) {
      const path = new URL(`../../supabase/templates/${file}.${extension}`, import.meta.url);
      if (process.argv.includes('--check')) {
        if (readFileSync(path, 'utf8') !== content) throw new Error(`Regenerate ${file}.${extension}`);
      } else writeFileSync(path, content);
    }
  }
}
