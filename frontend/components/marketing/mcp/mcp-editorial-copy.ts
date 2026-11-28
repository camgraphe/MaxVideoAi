import faqCopy from './mcp-faq.json';
import { getMcpClientActionConfig } from '@/lib/mcp-integration-registry';
import type { AppLocale } from '@/i18n/locales';
import { MCP_N8N_PUBLIC_TEMPLATE_URL } from '@/lib/mcp-n8n-template';

const en = {
  meta: { title: 'AI Video MCP: Claude, ChatGPT, Codex & n8n | MaxVideoAI', description: 'Use the MaxVideoAI plugin in ChatGPT or Codex, or connect Claude, OpenClaw and self-hosted n8n via MCP. Compare models and approve the price before creating an AI video.' },
  eyebrow: 'YOUR ASSISTANT. YOUR VIDEO STUDIO.', title: 'From your brief to an AI video.',
  intro: 'Create video, images and audio with the MaxVideoAI plugin in ChatGPT or Codex. Or choose a compatible MCP client below. Sign in with the same MaxVideoAI account to find your library and credits wherever you create.',
  install: 'Install in ChatGPT', choose: 'Choose your integration', proofLink: 'See it in Claude', note: 'Add credits on maxvideoai.com. Your balance is shared across the website and every connected tool. You see the price before approving a paid generation. No MaxVideoAI subscription is required.',
  visualLabel: 'ILLUSTRATED WORKFLOW', prompt: 'Help me turn this idea into a cinematic video.',
  stages: ['Describe', 'Review', 'Create'], stageTitles: ['Start with your idea.', 'Know what you will spend.', 'Keep your creation.'],
  stageBodies: ['A prompt, a reference, a project already in your conversation.', 'Choose the model, duration and resolution. Approve the exact quote before generation.', 'Find the finished video in your MaxVideoAI library. Display in chat depends on your client.'],
  clientsEyebrow: 'CONNECT YOUR WAY', clientsTitle: 'Where do you want to create?', clientsIntro: 'Choose your assistant or automation tool. Each integration has its own setup guide and availability details.',
  guide: 'Setup guide', preparing: 'In preparation', preparingNote: 'More clients are being evaluated. Setup is not published yet.',
  modes: { claude: 'Custom MCP connector', chatgpt: 'ChatGPT plugin', codex: 'Plugin + MCP', openclaw: 'Skill + MCP', n8n: 'MCP workflow' },
  benefits: { claude: 'Build on the ideas in your conversation.', chatgpt: 'Add AI video to your project in ChatGPT.', codex: 'Create assets alongside your code.', openclaw: 'Give your agent a video creation workflow.', n8n: 'Connect briefs, approvals and video jobs.' },
  limits: { claude: 'Claude Web Free tested with limits', chatgpt: 'Available in the plugin directory', codex: 'Codex CLI tested · plugin available', openclaw: 'Tested with limits · ClawHub skill available', n8n: 'Self-hosted 2.38.7 · published template' },
  workflowEyebrow: 'FROM THE IDEA TO THE FINAL FILE', workflowTitle: 'The conversation moves forward. You stay in control.',
  workflowIntro: 'MaxVideoAI is a remote MCP server for AI video and image generation. It connects compatible assistants to current models, quotes and the media in your account.',
  proofEyebrow: 'A REAL RESULT', proofTitle: 'From a request to a video in Claude.', proofBody: 'A recorded Claude Desktop test shows the finished video and access to the MaxVideoAI library. Other clients may return a link instead of an inline player.',
  trustEyebrow: 'CONNECTED, WITH YOUR PERMISSION', trustTitle: 'Your account. Your decisions.',
  trust: [{title:'Sign in to MaxVideoAI',body:'Authorization opens on MaxVideoAI. Do not paste a password, API key or payment details into the conversation.'},{title:'Approve the exact price',body:'A recommendation or budget does not start a paid generation. Review the settings and exact quote before confirming.'},{title:'Disconnect when you want',body:'Remove the integration from your assistant and revoke its authorization in your MaxVideoAI account.'}],
  examples: 'Explore AI video examples', models: 'Compare video models', pricing: 'See generation prices',
  faqTitle: 'Before you connect.', docs: 'MCP documentation', support: 'Talk to us', repo: 'Plugin source & releases',
  setupTitle: 'Connect once. Start creating.', setupIntro: 'Follow the steps for your environment, then authorize your MaxVideoAI account.', setupDetails:'Connection details', verified:'Compatibility & limits', account:'What you authorize', all:'All integrations',
};
type EditorialCopy = typeof en & {
  faq: Array<{ question: string; answer: string; link?: { href: string; label: string; directory?: boolean } }>;
};
const fr: typeof en = {
  meta: { title: 'Vidéo IA par MCP : Claude, ChatGPT, Codex et n8n | MaxVideoAI', description: 'Utilisez le plugin MaxVideoAI dans ChatGPT ou Codex, ou reliez Claude, OpenClaw et n8n auto-hébergé via MCP. Comparez les modèles et validez le prix avant de créer une vidéo IA.' },
  eyebrow: 'VOTRE ASSISTANT. VOTRE STUDIO VIDÉO.', title: 'Du brief à la vidéo IA.',
  intro: 'Créez des vidéos, des images et des sons avec le plugin MaxVideoAI dans ChatGPT ou Codex. Vous pouvez aussi choisir un client MCP ci-dessous. Utilisez le même compte MaxVideoAI pour retrouver vos médias et vos crédits dans chaque outil.',
  install: 'Installer dans ChatGPT', choose: 'Choisir mon intégration', proofLink: 'Voir le résultat dans Claude', note: 'Rechargez vos crédits sur maxvideoai.com. Le site et vos outils connectés partagent le même solde. Vous voyez le prix avant de valider une génération payante. Aucun abonnement MaxVideoAI n’est nécessaire.',
  visualLabel:'PARCOURS ILLUSTRÉ', prompt:'Aide-moi à transformer cette idée en vidéo cinématique.',
  stages:['Décrire','Choisir','Créer'], stageTitles:['Partez de votre idée.','Sachez ce que vous allez payer.','Retrouvez votre création.'],
  stageBodies:['Un prompt, une référence, un projet déjà présent dans votre conversation.','Choisissez le modèle, la durée et la résolution. Validez le devis exact avant de générer.','La vidéo terminée rejoint votre bibliothèque MaxVideoAI. Son affichage dans la conversation dépend du client.'],
  clientsEyebrow:'À CHACUN SA FAÇON DE CRÉER', clientsTitle:'Où voulez-vous créer ?', clientsIntro:'Choisissez votre assistant ou votre outil d’automatisation. Chaque intégration a son guide de connexion et ses conditions de disponibilité.',
  guide:'Guide de connexion', preparing:'En préparation', preparingNote:'D’autres clients sont à l’étude. Leur guide de connexion n’est pas encore publié.',
  modes:{claude:'Connecteur MCP personnalisé',chatgpt:'Plugin ChatGPT',codex:'Plugin + MCP',openclaw:'Skill + MCP',n8n:'Workflow MCP'},
  benefits:{claude:'Prolongez les idées de votre conversation.',chatgpt:'Ajoutez la vidéo IA à votre projet dans ChatGPT.',codex:'Créez vos médias pendant que vous codez.',openclaw:'Donnez à votre agent un parcours de création vidéo.',n8n:'Reliez briefs, validations et générations vidéo.'},
  limits:{claude:'Claude Web Free testé avec limites',chatgpt:'Disponible dans l’annuaire des plugins',codex:'Codex CLI testé · plugin disponible',openclaw:'Testé avec limites · skill ClawHub disponible',n8n:'Auto-hébergé 2.38.7 · modèle publié'},
  workflowEyebrow:'DE L’IDÉE AU FICHIER FINAL',workflowTitle:'La conversation avance. Vous gardez la main.',
  workflowIntro:'MaxVideoAI est un serveur MCP distant pour générer des vidéos et des images IA. Il relie les assistants compatibles aux modèles actuels, aux devis et aux médias de votre compte.',
  proofEyebrow:'UN RÉSULTAT RÉEL',proofTitle:'D’une demande à une vidéo dans Claude.',proofBody:'Cette capture d’un test de Claude Desktop montre la vidéo terminée et l’accès à la bibliothèque MaxVideoAI. D’autres clients peuvent renvoyer un lien plutôt qu’un lecteur intégré.',
  trustEyebrow:'CONNECTÉ, AVEC VOTRE ACCORD',trustTitle:'Votre compte. Vos décisions.',
  trust:[{title:'Connectez-vous sur MaxVideoAI',body:'L’autorisation s’ouvre sur MaxVideoAI. Ne collez ni mot de passe, ni clé API, ni données de paiement dans la conversation.'},{title:'Validez le prix exact',body:'Une recommandation ou un budget ne lance aucune génération payante. Vérifiez les réglages et le devis exact avant de confirmer.'},{title:'Déconnectez quand vous voulez',body:'Retirez l’intégration de votre assistant et révoquez son autorisation dans votre compte MaxVideoAI.'}],
  examples:'Explorer les exemples de vidéos IA',models:'Comparer les modèles vidéo',pricing:'Voir les prix de génération',
  faqTitle:'Avant de vous connecter.',docs:'Documentation MCP',support:'Parlons-en',repo:'Code du plugin et versions',
  setupTitle:'Connectez une fois. Puis créez.',setupIntro:'Suivez les étapes adaptées à votre environnement, puis autorisez votre compte MaxVideoAI.',setupDetails:'Détails de connexion',verified:'Compatibilité et limites',account:'Ce que vous autorisez',all:'Toutes les intégrations',
};
const es: typeof en = {
  meta:{title:'Video con IA por MCP: Claude, ChatGPT, Codex y n8n | MaxVideoAI',description:'Usa el plugin de MaxVideoAI en ChatGPT o Codex, o conecta Claude, OpenClaw y n8n autoalojado por MCP. Compara modelos y aprueba el precio antes de crear un vídeo con IA.'},
  eyebrow:'TU ASISTENTE. TU ESTUDIO DE VIDEO.',title:'Del brief al video con IA.',intro: 'Crea vídeos, imágenes y audio con el plugin de MaxVideoAI en ChatGPT o Codex. También puedes conectar un cliente MCP de los que aparecen abajo. Usa la misma cuenta de MaxVideoAI para acceder a tus créditos y a tu biblioteca.',
  install:'Instalar en ChatGPT', choose:'Elegir mi integración',proofLink:'Ver el resultado en Claude',note: 'Recarga créditos en maxvideoai.com. El sitio y las herramientas que conectes comparten el saldo. Verás el precio antes de aprobar una generación de pago. No necesitas una suscripción a MaxVideoAI.',
  visualLabel:'EJEMPLO DEL PROCESO',prompt:'Ayúdame a convertir esta idea en un video cinematográfico.',
  stages:['Describir','Elegir','Crear'],stageTitles:['Empieza con tu idea.','Conoce el precio antes.','Conserva tu creación.'],stageBodies:['Un prompt, una referencia o un proyecto que ya está en tu conversación.','Elige modelo, duración y resolución. Aprueba el precio exacto antes de generar.','El video terminado se guarda en tu biblioteca MaxVideoAI. Su visualización en el chat depende del cliente.'],
  clientsEyebrow:'CONECTA A TU MANERA',clientsTitle:'¿Dónde quieres crear?',clientsIntro:'Elige tu asistente o herramienta de automatización. Cada integración tiene su propia guía y condiciones de disponibilidad.',guide:'Guía de conexión',preparing:'En preparación',preparingNote:'Estamos evaluando más clientes. Su guía de conexión aún no está publicada.',
  modes:{claude:'Conector MCP personalizado',chatgpt:'Plugin de ChatGPT',codex:'Plugin + MCP',openclaw:'Skill + MCP',n8n:'Workflow MCP'},
  benefits:{claude:'Dale continuidad a las ideas de tu conversación.',chatgpt:'Añade video con IA a tu proyecto en ChatGPT.',codex:'Crea recursos visuales mientras programas.',openclaw:'Dale a tu agente un flujo de creación de video.',n8n:'Conecta briefs, aprobaciones y generación de video.'},
  limits:{claude:'Claude Web Free probado con límites',chatgpt:'Disponible en el directorio de plugins',codex:'Codex CLI probado · plugin disponible',openclaw:'Probado con límites · skill en ClawHub',n8n:'Autoalojado 2.38.7 · plantilla publicada'},
  workflowEyebrow:'DE LA IDEA AL ARCHIVO FINAL',workflowTitle:'La conversación avanza. Tú mantienes el control.',workflowIntro:'MaxVideoAI es un servidor MCP remoto para generar videos e imágenes con IA. Conecta asistentes compatibles con los modelos actuales, los precios y los medios de tu cuenta.',
  proofEyebrow:'UN RESULTADO REAL',proofTitle:'De una petición a un video en Claude.',proofBody:'Esta captura de una prueba en Claude Desktop muestra el video terminado y el acceso a la biblioteca MaxVideoAI. Otros clientes pueden devolver un enlace en lugar de un reproductor integrado.',
  trustEyebrow:'CONECTADO, CON TU PERMISO',trustTitle:'Tu cuenta. Tus decisiones.',trust:[{title:'Inicia sesión en MaxVideoAI',body:'La autorización se abre en MaxVideoAI. No pegues contraseñas, claves API ni datos de pago en la conversación.'},{title:'Aprueba el precio exacto',body:'Una recomendación o un presupuesto no inicia una generación de pago. Revisa los ajustes y el precio exacto antes de confirmar.'},{title:'Desconecta cuando quieras',body:'Elimina la integración del asistente y revoca su autorización en tu cuenta MaxVideoAI.'}],
  examples:'Explorar ejemplos de videos con IA',models:'Comparar modelos de video',pricing:'Ver precios de generación',faqTitle:'Antes de conectar.',docs:'Documentación MCP',support:'Hablemos',repo:'Código del plugin y versiones',
  setupTitle:'Conecta una vez. Empieza a crear.',setupIntro:'Sigue los pasos para tu entorno y autoriza tu cuenta MaxVideoAI.',setupDetails:'Detalles de conexión',verified:'Compatibilidad y límites',account:'Qué autorizas',all:'Todas las integraciones',
};
export function getMcpEditorialCopy(locale: AppLocale): EditorialCopy {
  const { access, installation, automation, creation } = faqCopy[locale];
  const listing = getMcpClientActionConfig('chatgpt');
  const installLink = listing.deepLinkEnabled && listing.deepLink
    ? { href: listing.deepLink, label: installation.action, directory: true }
    : undefined;

  return {
    ...({ en, fr, es })[locale],
    faq: [
      access,
      { ...installation, link: installLink },
      { ...automation, link: { href: MCP_N8N_PUBLIC_TEMPLATE_URL, label: automation.action } },
      creation,
    ],
  };
}
