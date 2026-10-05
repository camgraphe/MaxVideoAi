import type { AppLocale } from '@/i18n/locales';

type Feature = { title: string; body: string };
export type StudioMarketingCopy = {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  introduction: string;
  primaryCta: string;
  secondaryCta: string;
  accessNote: string;
  costNote: string;
  brief: { label: string; body: string };
  imageAlt: string;
  imageCaption: string;
  workflow: { eyebrow: string; title: string; steps: Feature[] };
  capabilities: { title: string; items: Feature[] };
  control: { title: string; body: string };
  mcp: { title: string; body: string; cta: string };
  faq: { title: string; items: { question: string; answer: string }[] };
  closing: { title: string; body: string };
};

const copy: Record<AppLocale, StudioMarketingCopy> = {
  en: {
    meta: { title: 'Studio — a creative conversation for image, video and audio', description: 'Create images, videos and audio in MaxVideoAI Studio. Work with references, review generation quotes, edit your timeline and download individual creations.' },
    eyebrow: 'MaxVideoAI Studio',
    title: 'From a product brief\nto an image or clip.',
    introduction: 'Bring a product brief or reference. Refine the direction in conversation, review the exact quote, then create one image or short clip.',
    primaryCta: 'Open Studio', secondaryCta: 'Explore the workflow',
    accessNote: 'Sign in or create a MaxVideoAI account to start a conversation in Studio.',
    costNote: 'Sol uses included or purchased assistance credits. Media generation has its own quote to review and confirm.',
    brief: { label: 'A brief to try', body: 'A quiet product scene by the water. Help me refine the light and prepare one short clip. Show me the model, settings and exact quote; do not generate until I approve.' },
    imageAlt: 'Studio workspace with a central creative conversation, visual references and a sequence timeline',
    imageCaption: 'Studio with example media.',
    workflow: { eyebrow: 'From the first thought to the next frame', title: 'Your brief sets the pace.', steps: [
      { title: 'Bring your product brief', body: 'Open a conversation after signing in. Describe the product scene you want and add an owned reference from your media library if it helps.' },
      { title: 'Refine and review the quote', body: 'Develop the prompt with the assistant. Review the model, references, settings and current exact price before choosing to generate.' },
      { title: 'Approve and keep the media', body: 'Confirm the generation quote to start creating. When it completes, download the individual image or clip from your media library.' },
    ] },
    capabilities: { title: 'Room to explore. Tools to shape your idea.', items: [
      { title: 'A conversation with context', body: 'Keep the creative discussion alongside project references and results. An idea, a prompt or a single image can be the whole project.' },
      { title: 'Images, clips and sound', body: 'Create images, extend or reshape clips, and work on voices, music and sound. Studio offers compatible models and reference options, with a separate quote for each creation.' },
      { title: 'A sequence you can shape', body: 'Bring ready media into the conversational timeline and adjust the cut. Download individual creations from your media library.' },
    ] },
    control: { title: 'The next paid step stays yours.', body: 'Review the model, settings and exact price before confirming each generation. Changing a request can change its quote.' },
    mcp: { title: 'Already working with an assistant?', body: 'The MaxVideoAI MCP connection brings current model facts, quotes and generation recovery into supported assistant workflows. Setup and verified capabilities vary by host.', cta: 'Explore assistant connections' },
    faq: { title: 'Before you start', items: [
      { question: 'How do I start using Studio?', answer: 'Sign in or create a MaxVideoAI account to start a new creative conversation. You can also reopen your existing projects.' },
      { question: 'Do I need a complete video plan?', answer: 'No. Start with a brief, a reference, a prompt to refine or one image. Build a sequence only when it serves your idea.' },
      { question: 'Does the Studio assistant cost money?', answer: 'Sol uses your monthly included credits first, then purchased credits. These credits belong to your account; new projects do not reset them. You confirm each pack purchase from your MaxVideoAI balance, and purchased credits are cumulative. There is no automatic refill. You can choose Luna for everyday conversation at no extra assistance fee and without a monthly quota, subject to request limits and service availability. Media generation is charged separately: review its current exact quote and explicitly confirm before creating.' },
      { question: 'How do I know what a generation costs?', answer: 'Studio prepares a quote for the selected model, settings and references. Review the exact amount before confirming. An estimate is not an authorization to spend.' },
      { question: 'How do I use my creations?', answer: 'Download each image, video or audio creation from your media library. You can also organize ready media on your Studio timeline.' },
      { question: 'Is Studio the same as the MCP connection?', answer: 'Studio is a MaxVideoAI workspace. MCP connects an external assistant to specific MaxVideoAI tools. The external host keeps its own conversation; the connection does not give MaxVideoAI its full chat history.' },
    ] },
    closing: { title: 'Give your next idea some space.', body: 'Sign in or create an account, then start a new conversation in Studio.' },
  },
  fr: {
    meta: { title: 'Studio — créer des images, vidéos et audio en dialogue', description: 'Créez des images, vidéos et audio dans MaxVideoAI Studio. Travaillez avec vos références, vérifiez les devis, montez votre timeline et téléchargez vos créations individuelles.' },
    eyebrow: 'MaxVideoAI Studio', title: 'Du brief produit\nà l’image ou au clip.',
    introduction: 'Apportez un brief produit ou une référence. Affinez la direction par le dialogue, vérifiez le devis exact, puis créez une image ou un clip court.',
    primaryCta: 'Ouvrir Studio', secondaryCta: 'Découvrir le parcours',
    accessNote: 'Connectez-vous ou créez un compte MaxVideoAI pour démarrer une conversation dans Studio.',
    costNote: 'Sol utilise des crédits d’assistance inclus ou achetés. Chaque génération de médias a son devis à vérifier et confirmer.',
    brief: { label: 'Un brief pour commencer', body: 'Une scène produit calme au bord de l’eau. Aide-moi à affiner la lumière et à préparer un clip court. Présente le modèle, les réglages et le devis exact ; ne génère rien sans mon accord.' },
    imageAlt: 'Interface Studio avec une conversation créative centrale, des références visuelles et une timeline',
    imageCaption: 'Studio avec des médias d’exemple.',
    workflow: { eyebrow: 'De la première idée au prochain plan', title: 'Votre brief donne le rythme.', steps: [
      { title: 'Apportez votre brief produit', body: 'Ouvrez une conversation après connexion. Décrivez la scène produit souhaitée et ajoutez une référence de votre bibliothèque si elle précise votre intention.' },
      { title: 'Affinez et vérifiez le devis', body: 'Développez le prompt avec l’assistant. Vérifiez le modèle, les références, les réglages et le prix exact actuel avant de décider de générer.' },
      { title: 'Validez et conservez le média', body: 'Confirmez le devis pour lancer la création. Une fois terminée, téléchargez l’image ou le clip individuel depuis votre bibliothèque de médias.' },
    ] },
    capabilities: { title: 'De l’espace pour explorer. Des outils pour façonner votre idée.', items: [
      { title: 'Une conversation en contexte', body: 'Gardez l’échange créatif aux côtés des références et résultats du projet. Une idée, un prompt ou une image peut constituer le projet entier.' },
      { title: 'Images, clips et son', body: 'Créez des images, prolongez ou transformez vos clips, et travaillez les voix, la musique et le son. Studio propose les modèles et références compatibles, avec un devis distinct pour chaque création.' },
      { title: 'Une séquence à votre main', body: 'Placez vos médias prêts dans la timeline de la conversation et ajustez le montage. Téléchargez vos créations individuelles depuis votre bibliothèque de médias.' },
    ] },
    control: { title: 'Vous décidez de la prochaine étape payante.', body: 'Vérifiez le modèle, les réglages et le prix exact avant de confirmer chaque génération. Une modification de la demande peut changer son devis.' },
    mcp: { title: 'Vous travaillez déjà avec un assistant ?', body: 'La connexion MCP MaxVideoAI apporte les informations actuelles des modèles, les devis et la récupération des générations dans les parcours compatibles. La configuration et les capacités vérifiées dépendent de l’hôte.', cta: 'Découvrir les connexions aux assistants' },
    faq: { title: 'Avant de commencer', items: [
      { question: 'Comment commencer à utiliser Studio ?', answer: 'Connectez-vous ou créez un compte MaxVideoAI pour démarrer une nouvelle conversation créative. Vous pouvez aussi rouvrir vos projets existants.' },
      { question: 'Faut-il prévoir une vidéo complète ?', answer: 'Non. Partez d’un brief, d’une référence, d’un prompt à affiner ou d’une image. Construisez une séquence seulement si votre idée le demande.' },
      { question: 'L’assistant Studio est-il payant ?', answer: 'Sol utilise vos crédits mensuels inclus en premier, avant vos crédits achetés. Ces crédits sont liés à votre compte ; les nouveaux projets ne les réinitialisent pas. Vous confirmez chaque achat de pack depuis votre solde MaxVideoAI, et les crédits achetés sont cumulables. Aucune recharge automatique. Vous pouvez choisir Luna pour les conversations courantes sans frais d’assistance supplémentaires, sans quota mensuel, sous réserve des limites de requête et de la disponibilité du service. La génération de médias est facturée séparément : vérifiez son devis exact actuel et confirmez explicitement avant de créer.' },
      { question: 'Comment connaître le prix d’une génération ?', answer: 'Studio prépare un devis selon le modèle, les réglages et les références sélectionnés. Vérifiez le montant exact avant de confirmer. Une estimation n’autorise aucune dépense.' },
      { question: 'Comment utiliser mes créations ?', answer: 'Téléchargez chaque image, vidéo ou création audio depuis votre bibliothèque de médias. Vous pouvez aussi organiser vos médias prêts sur la timeline de Studio.' },
      { question: 'Studio et la connexion MCP sont-ils identiques ?', answer: 'Studio est un espace de création MaxVideoAI. MCP relie un assistant externe à des outils précis de MaxVideoAI. L’hôte conserve sa conversation ; cette connexion ne donne pas à MaxVideoAI son historique complet.' },
    ] },
    closing: { title: 'Faites de la place à votre prochaine idée.', body: 'Connectez-vous ou créez un compte, puis démarrez une nouvelle conversation dans Studio.' },
  },
  es: {
    meta: { title: 'Studio — crea imágenes, vídeos y audio conversando', description: 'Crea imágenes, vídeos y audio en MaxVideoAI Studio. Trabaja con referencias, revisa presupuestos, edita tu línea de tiempo y descarga tus creaciones individuales.' },
    eyebrow: 'MaxVideoAI Studio', title: 'Del brief de producto\na una imagen o clip.',
    introduction: 'Trae un brief de producto o una referencia. Define la dirección conversando, revisa el precio exacto y crea una imagen o un clip corto.',
    primaryCta: 'Abrir Studio', secondaryCta: 'Explorar el proceso',
    accessNote: 'Inicia sesión o crea una cuenta de MaxVideoAI para empezar una conversación en Studio.',
    costNote: 'Sol utiliza créditos de asistencia incluidos o comprados. Cada generación de medios tiene su propio presupuesto para revisar y confirmar.',
    brief: { label: 'Un brief para empezar', body: 'Una escena de producto tranquila junto al agua. Ayúdame a definir la luz y preparar un clip corto. Muéstrame el modelo, los ajustes y el precio exacto; no generes hasta que lo apruebe.' },
    imageAlt: 'Interfaz de Studio con una conversación creativa central, referencias visuales y una línea de tiempo',
    imageCaption: 'Studio con medios de ejemplo.',
    workflow: { eyebrow: 'De la primera idea al siguiente plano', title: 'Tu idea marca el ritmo.', steps: [
      { title: 'Trae tu brief de producto', body: 'Abre una conversación después de iniciar sesión. Describe la escena de producto y añade una referencia de tu biblioteca si ayuda a explicar la dirección.' },
      { title: 'Define y revisa el precio', body: 'Desarrolla el prompt con el asistente. Revisa el modelo, las referencias, los ajustes y el precio exacto actual antes de decidir si quieres generar.' },
      { title: 'Aprueba y conserva el medio', body: 'Confirma el precio para empezar a crear. Cuando termine, descarga la imagen o el clip individual desde tu biblioteca de medios.' },
    ] },
    capabilities: { title: 'Espacio para explorar. Herramientas para dar forma a tu idea.', items: [
      { title: 'Una conversación con contexto', body: 'Mantén el diálogo creativo junto a las referencias y los resultados del proyecto. Una idea, un prompt o una imagen puede ser todo el proyecto.' },
      { title: 'Imágenes, clips y sonido', body: 'Crea imágenes, prolonga o transforma tus clips y trabaja con voces, música y sonido. Studio propone modelos y referencias compatibles, con un presupuesto separado para cada creación.' },
      { title: 'Una secuencia a tu manera', body: 'Lleva los medios listos a la línea de tiempo de la conversación y ajusta el montaje. Descarga tus creaciones individuales desde tu biblioteca de medios.' },
    ] },
    control: { title: 'El siguiente paso de pago lo decides tú.', body: 'Revisa el modelo, los ajustes y el precio exacto antes de confirmar cada generación. Cambiar una petición puede cambiar su presupuesto.' },
    mcp: { title: '¿Ya trabajas con un asistente?', body: 'La conexión MCP de MaxVideoAI lleva información actual de modelos, presupuestos y recuperación de generaciones a los flujos compatibles. La configuración y las capacidades verificadas varían según el cliente.', cta: 'Explorar conexiones con asistentes' },
    faq: { title: 'Antes de empezar', items: [
      { question: '¿Cómo empiezo a usar Studio?', answer: 'Inicia sesión o crea una cuenta de MaxVideoAI para empezar una nueva conversación creativa. También puedes volver a abrir tus proyectos existentes.' },
      { question: '¿Necesito planear un vídeo completo?', answer: 'No. Empieza con una idea, una referencia, un prompt que quieras mejorar o una imagen. Construye una secuencia solo cuando tu idea lo necesite.' },
      { question: '¿El asistente de Studio tiene un coste?', answer: 'Sol utiliza tus créditos mensuales incluidos antes de los créditos comprados. Estos créditos pertenecen a tu cuenta; los proyectos nuevos no los restablecen. Confirmas cada compra de pack desde tu saldo MaxVideoAI, y los créditos comprados son acumulables. Ninguna recarga automática. Puedes elegir Luna para conversaciones cotidianas sin coste adicional de asistencia y sin cuota mensual, sujeto a los límites de solicitud y a la disponibilidad del servicio. La generación de medios se cobra por separado: revisa su presupuesto exacto actual y confirma expresamente antes de crear.' },
      { question: '¿Cómo sé cuánto cuesta una generación?', answer: 'Studio prepara un presupuesto para el modelo, los ajustes y las referencias elegidos. Revisa el importe exacto antes de confirmar. Una estimación no autoriza un gasto.' },
      { question: '¿Cómo utilizo mis creaciones?', answer: 'Descarga cada imagen, vídeo o creación de audio desde tu biblioteca de medios. También puedes organizar tus medios listos en la línea de tiempo de Studio.' },
      { question: '¿Studio es lo mismo que la conexión MCP?', answer: 'Studio es un espacio de creación de MaxVideoAI. MCP conecta un asistente externo con herramientas concretas de MaxVideoAI. El cliente mantiene su conversación; la conexión no proporciona a MaxVideoAI su historial completo.' },
    ] },
    closing: { title: 'Dale espacio a tu próxima idea.', body: 'Inicia sesión o crea una cuenta y empieza una nueva conversación en Studio.' },
  },
};

export function getStudioMarketingCopy(locale: AppLocale): StudioMarketingCopy {
  return copy[locale];
}
