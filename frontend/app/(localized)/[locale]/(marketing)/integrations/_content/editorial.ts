import type { AppLocale } from '@/i18n/locales';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import type { IntegrationPageCopy } from './types';

export function refineIntegrationCopy(copy: IntegrationPageCopy, locale: AppLocale): IntegrationPageCopy {
  const editorial = getMcpEditorialCopy(locale);
  const client = copy.client as keyof typeof editorial.modes;
  const titles = {
    en: {claude:'Create AI videos with Claude.',chatgpt:'Bring AI video into ChatGPT.',codex:'Create AI videos with Codex.',openclaw:'AI video. Powered by OpenClaw.',n8n:'Automate AI video with n8n.'},
    fr: {claude:'Créez vos vidéos IA avec Claude.',chatgpt:'La vidéo IA entre dans ChatGPT.',codex:'Créez vos vidéos IA avec Codex.',openclaw:'Vos vidéos IA, avec OpenClaw.',n8n:'Automatisez vos vidéos IA avec n8n.'},
    es: {claude:'Crea videos con IA en Claude.',chatgpt:'Lleva el video con IA a ChatGPT.',codex:'Crea videos con IA en Codex.',openclaw:'Crea videos con IA en OpenClaw.',n8n:'Automatiza tus videos con IA en n8n.'},
  };
  if (!titles[locale][client]) return copy;
  const intros = {
    en: {claude:'Develop your idea in Claude, compare suitable video models and approve the exact price. Find the finished creation in your MaxVideoAI account.',chatgpt:'Turn a project in your conversation into a video with MaxVideoAI. Compare models, choose the settings and approve the exact price before generation.',codex:'A launch video, an animated reference or a scene for your site: use the MaxVideoAI plugin alongside your project, with a quote before every generation.',openclaw:'Connect OpenClaw to MaxVideoAI to plan your video, choose the model and generate after you approve the exact quote.',n8n:'Connect your brief to model selection, an exact quote and video generation. Keep human approval as a clear step in your self-hosted workflow.'},
    fr: {claude:'Développez votre idée dans Claude, comparez les modèles vidéo adaptés et validez le prix exact. Retrouvez la création terminée dans votre compte MaxVideoAI.',chatgpt:'Transformez le projet de votre conversation en vidéo avec MaxVideoAI. Comparez les modèles, choisissez les réglages et validez le prix exact avant de générer.',codex:'Une vidéo de lancement, une référence animée ou une scène pour votre site : utilisez le plugin MaxVideoAI au fil de votre projet, avec un devis avant chaque génération.',openclaw:'Connectez OpenClaw à MaxVideoAI pour préparer votre vidéo, choisir le modèle et générer après votre accord sur le devis exact.',n8n:'Reliez votre brief au choix du modèle, au devis exact et à la génération vidéo. Gardez l’accord humain comme étape explicite de votre workflow auto-hébergé.'},
    es: {claude:'Desarrolla tu idea en Claude, compara los modelos de video adecuados y aprueba el precio exacto. Encuentra la creación terminada en tu cuenta MaxVideoAI.',chatgpt:'Convierte el proyecto de tu conversación en un video con MaxVideoAI. Compara modelos, elige los ajustes y aprueba el precio exacto antes de generar.',codex:'Un video de lanzamiento, una referencia animada o una escena para tu sitio: usa el plugin MaxVideoAI junto a tu proyecto, con un precio exacto antes de cada generación.',openclaw:'Conecta OpenClaw con MaxVideoAI para planear tu video, elegir el modelo y generar después de aprobar el precio exacto.',n8n:'Conecta tu brief con la selección del modelo, el precio exacto y la generación de video. Mantén la aprobación humana como un paso explícito en tu workflow autoalojado.'},
  };
  const metaTitles = {
    en:{claude:'Claude AI Video Connector: MaxVideoAI MCP',chatgpt:'ChatGPT AI Video: MaxVideoAI MCP App',codex:'Codex AI Video Plugin: MaxVideoAI MCP',openclaw:'OpenClaw AI Video Skill: MaxVideoAI MCP',n8n:'n8n AI Video Automation: MaxVideoAI MCP'},
    fr:{claude:'Connecteur vidéo IA Claude : MaxVideoAI MCP',chatgpt:'Vidéo IA dans ChatGPT : app MCP MaxVideoAI',codex:'Plugin vidéo IA Codex : MaxVideoAI MCP',openclaw:'Skill vidéo IA OpenClaw : MaxVideoAI MCP',n8n:'Automatisation vidéo IA n8n : MaxVideoAI MCP'},
    es:{claude:'Conector de video con IA para Claude: MaxVideoAI MCP',chatgpt:'Video con IA en ChatGPT: app MCP MaxVideoAI',codex:'Plugin de video con IA para Codex: MaxVideoAI MCP',openclaw:'Skill de video con IA para OpenClaw: MaxVideoAI MCP',n8n:'Automatización de video con IA en n8n: MaxVideoAI MCP'},
  };
  const helpIntro = locale === 'fr' ? 'Les réponses utiles pour connecter votre compte et lancer votre première création.' : locale === 'es' ? 'Respuestas para conectar tu cuenta y crear por primera vez.' : 'Answers to help you connect your account and make your first creation.';
  const oauthTitle = locale === 'fr' ? 'Vous autorisez votre compte.' : locale === 'es' ? 'Tú autorizas tu cuenta.' : 'You authorize your account.';
  return {...copy,troubleshooting:{...copy.troubleshooting,intro:helpIntro},meta:{title:metaTitles[locale][client],description:intros[locale][client]},hero:{...copy.hero,eyebrow:`${editorial.modes[client]} · MaxVideoAI`,title:titles[locale][client],intro:intros[locale][client],setupLabel:client==='n8n'&&locale==='es'?'Conectar n8n autoalojado':copy.hero.setupLabel,liveStatus:editorial.limits[client]},setup:{...copy.setup,oauthTitle,title:editorial.setupTitle,intro:editorial.setupIntro}};
}
