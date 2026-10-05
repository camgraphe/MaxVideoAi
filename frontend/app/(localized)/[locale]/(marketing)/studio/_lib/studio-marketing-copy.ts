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
  betaNote: string;
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
    meta: { title: 'Studio — a creative conversation for image and video', description: 'Explore the MaxVideoAI Studio public beta: develop an idea, work with references, review generation quotes and shape your sequence in one creative workspace.' },
    eyebrow: 'MaxVideoAI Studio · Public beta',
    title: 'From a product brief\nto an image or clip.',
    introduction: 'Bring a product brief or reference. Refine the direction in conversation, review the exact quote, then create one image or short clip.',
    primaryCta: 'Open Studio', secondaryCta: 'Explore the workflow',
    accessNote: 'Studio is in public beta. Sign in or create a MaxVideoAI account to start a conversation. Opening Studio does not launch a generation.',
    costNote: 'Media generation is paid separately. Assistance has limited account allowances; paid assistance uses a budget you authorize.',
    betaNote: 'Public beta: individual media creation and timeline editing. Sequence MP4 export is not yet available.',
    brief: { label: 'A brief to try', body: 'A quiet product scene by the water. Help me refine the light and prepare one short clip. Show me the model, settings and exact quote; do not generate until I approve.' },
    imageAlt: 'Studio preview with a central creative conversation, visual references and a sequence timeline',
    imageCaption: 'Studio interface captured locally with demonstration media.',
    workflow: { eyebrow: 'From the first thought to the next frame', title: 'Your brief sets the pace.', steps: [
      { title: 'Bring your product brief', body: 'Open a conversation after signing in. Describe the product scene you want and add an owned reference from your media library if it helps.' },
      { title: 'Refine and review the quote', body: 'Develop the prompt with the assistant. Review the model, references, settings and current exact price before choosing to generate.' },
      { title: 'Approve and keep the media', body: 'Confirm the generation quote to start the paid attempt. When it completes, keep the individual image or clip in your media library.' },
    ] },
    capabilities: { title: 'Room to explore. Tools to shape your idea.', items: [
      { title: 'A conversation with context', body: 'Keep the creative discussion alongside project references and results. An idea, a prompt or a single image can be the whole project.' },
      { title: 'Images, clips and sound', body: 'Create images, extend or reshape clips, and work on voices, music and sound. Studio offers compatible models and reference options, with a separate quote for each creation.' },
      { title: 'A sequence you can shape', body: 'Bring ready media into the conversational timeline and adjust the cut. MP4 export is not yet available during the public beta.' },
    ] },
    control: { title: 'The next paid step stays yours.', body: 'Each generation has an exact quote for you to confirm. Changing a request can change its price. A failed attempt or a refund never authorizes a new generation.' },
    mcp: { title: 'Already working with an assistant?', body: 'The MaxVideoAI MCP connection brings current model facts, quotes and generation recovery into supported assistant workflows. Setup and verified capabilities vary by host.', cta: 'Explore assistant connections' },
    faq: { title: 'Before you start', items: [
      { question: 'Can everyone use Studio today?', answer: 'Studio is open in public beta. Sign in or create a MaxVideoAI account to start a new creative conversation. You can also reopen your existing projects.' },
      { question: 'Do I need a complete video plan?', answer: 'No. Start with a brief, a reference, a prompt to refine or one image. Build a sequence only when it serves your idea.' },
      { question: 'Does the Studio assistant cost money?', answer: 'Studio shows the remaining percentage of your included assistance allowances. These are limited allowances per account, not wallet credit; new projects do not reset them. Paid Sol assistance uses a budget you explicitly authorize from your MaxVideoAI wallet, at the token rates shown in Studio. You can explicitly choose Luna at no extra assistant fee while its included allowance is available. Assistance has no automatic recharge. Media generation is charged separately.' },
      { question: 'How do I know what a generation costs?', answer: 'Studio prepares a quote for the selected model, settings and references. Review the exact amount before confirming. An estimate is not an authorization to spend.' },
      { question: 'Can I export my sequence as an MP4?', answer: 'You can arrange and edit media on the timeline. MP4 export is not yet available during the public beta.' },
      { question: 'Is Studio the same as the MCP connection?', answer: 'Studio is a MaxVideoAI workspace. MCP connects an external assistant to specific MaxVideoAI tools. The external host keeps its own conversation; the connection does not give MaxVideoAI its full chat history.' },
    ] },
    closing: { title: 'Give your next idea some space.', body: 'Sign in or create an account, then start a new conversation in Studio.' },
  },
  fr: {
    meta: { title: 'Studio — créer des images et des vidéos en dialogue', description: 'Découvrez la bêta publique de MaxVideoAI Studio : développez une idée, travaillez avec vos références, validez vos devis et composez votre séquence.' },
    eyebrow: 'MaxVideoAI Studio · Bêta publique', title: 'Du brief produit\nà l’image ou au clip.',
    introduction: 'Apportez un brief produit ou une référence. Affinez la direction par le dialogue, vérifiez le devis exact, puis créez une image ou un clip court.',
    primaryCta: 'Ouvrir Studio', secondaryCta: 'Découvrir le parcours',
    accessNote: 'Studio est en bêta publique. Connectez-vous ou créez un compte MaxVideoAI pour démarrer une conversation. Ouvrir Studio ne lance aucune génération.',
    costNote: 'La génération de médias est facturée séparément. Les quotas d’assistance sont limités par compte ; l’assistance payante utilise un budget que vous autorisez.',
    betaNote: 'Bêta publique : création de médias individuels et édition de la timeline. L’export MP4 des séquences n’est pas encore disponible.',
    brief: { label: 'Un brief pour commencer', body: 'Une scène produit calme au bord de l’eau. Aide-moi à affiner la lumière et à préparer un clip court. Présente le modèle, les réglages et le devis exact ; ne génère rien sans mon accord.' },
    imageAlt: 'Aperçu de Studio avec une conversation créative centrale, des références visuelles et une timeline',
    imageCaption: 'Interface Studio capturée localement avec des médias de démonstration.',
    workflow: { eyebrow: 'De la première idée au prochain plan', title: 'Votre brief donne le rythme.', steps: [
      { title: 'Apportez votre brief produit', body: 'Ouvrez une conversation après connexion. Décrivez la scène produit souhaitée et ajoutez une référence de votre bibliothèque si elle précise votre intention.' },
      { title: 'Affinez et vérifiez le devis', body: 'Développez le prompt avec l’assistant. Vérifiez le modèle, les références, les réglages et le prix exact actuel avant de décider de générer.' },
      { title: 'Validez et conservez le média', body: 'Confirmez le devis pour lancer la tentative payante. Une fois terminée, l’image ou le clip individuel rejoint votre bibliothèque de médias.' },
    ] },
    capabilities: { title: 'De l’espace pour explorer. Des outils pour façonner votre idée.', items: [
      { title: 'Une conversation en contexte', body: 'Gardez l’échange créatif aux côtés des références et résultats du projet. Une idée, un prompt ou une image peut constituer le projet entier.' },
      { title: 'Images, clips et son', body: 'Créez des images, prolongez ou transformez vos clips, et travaillez les voix, la musique et le son. Studio propose les modèles et références compatibles, avec un devis distinct pour chaque création.' },
      { title: 'Une séquence à votre main', body: 'Placez vos médias prêts dans la timeline de la conversation et ajustez le montage. L’export MP4 n’est pas encore disponible pendant la bêta publique.' },
    ] },
    control: { title: 'Vous décidez de la prochaine étape payante.', body: 'Chaque génération dispose d’un devis exact à confirmer. Une modification de la demande peut changer son prix. Un échec ou un remboursement n’autorise jamais une nouvelle génération.' },
    mcp: { title: 'Vous travaillez déjà avec un assistant ?', body: 'La connexion MCP MaxVideoAI apporte les informations actuelles des modèles, les devis et la récupération des générations dans les parcours compatibles. La configuration et les capacités vérifiées dépendent de l’hôte.', cta: 'Découvrir les connexions aux assistants' },
    faq: { title: 'Avant de commencer', items: [
      { question: 'Tout le monde peut-il utiliser Studio ?', answer: 'Studio est ouvert en bêta publique. Connectez-vous ou créez un compte MaxVideoAI pour démarrer une nouvelle conversation créative. Vous pouvez aussi rouvrir vos projets existants.' },
      { question: 'Faut-il prévoir une vidéo complète ?', answer: 'Non. Partez d’un brief, d’une référence, d’un prompt à affiner ou d’une image. Construisez une séquence seulement si votre idée le demande.' },
      { question: 'L’assistant Studio est-il payant ?', answer: 'Studio affiche le pourcentage restant de vos quotas d’assistance inclus. Ces quotas sont limités par compte et ne constituent pas un crédit de portefeuille ; un nouveau projet ne les réinitialise pas. L’assistance Sol payante utilise un budget que vous autorisez explicitement depuis votre portefeuille MaxVideoAI, aux tarifs par token affichés dans Studio. Vous pouvez choisir explicitement Luna sans frais d’assistance supplémentaires tant que son quota inclus est disponible. L’assistance ne se recharge jamais automatiquement. La génération de médias est facturée séparément.' },
      { question: 'Comment connaître le prix d’une génération ?', answer: 'Studio prépare un devis selon le modèle, les réglages et les références sélectionnés. Vérifiez le montant exact avant de confirmer. Une estimation n’autorise aucune dépense.' },
      { question: 'Puis-je exporter ma séquence en MP4 ?', answer: 'Vous pouvez organiser et monter vos médias sur la timeline. L’export MP4 n’est pas encore disponible pendant la bêta publique.' },
      { question: 'Studio et la connexion MCP sont-ils identiques ?', answer: 'Studio est un espace de création MaxVideoAI. MCP relie un assistant externe à des outils précis de MaxVideoAI. L’hôte conserve sa conversation ; cette connexion ne donne pas à MaxVideoAI son historique complet.' },
    ] },
    closing: { title: 'Faites de la place à votre prochaine idée.', body: 'Connectez-vous ou créez un compte, puis démarrez une nouvelle conversation dans Studio.' },
  },
  es: {
    meta: { title: 'Studio — crea imágenes y vídeos conversando', description: 'Descubre la beta pública de MaxVideoAI Studio: desarrolla una idea, trabaja con referencias, revisa presupuestos y da forma a tu secuencia.' },
    eyebrow: 'MaxVideoAI Studio · Beta pública', title: 'Del brief de producto\na una imagen o clip.',
    introduction: 'Trae un brief de producto o una referencia. Define la dirección conversando, revisa el precio exacto y crea una imagen o un clip corto.',
    primaryCta: 'Abrir Studio', secondaryCta: 'Explorar el proceso',
    accessNote: 'Studio está en beta pública. Inicia sesión o crea una cuenta de MaxVideoAI para empezar una conversación. Abrir Studio no inicia ninguna generación.',
    costNote: 'La generación de medios se cobra por separado. La asistencia tiene cuotas limitadas por cuenta; la asistencia de pago usa un presupuesto que autorizas.',
    betaNote: 'Beta pública: creación de medios individuales y edición de la línea de tiempo. La exportación MP4 de secuencias aún no está disponible.',
    brief: { label: 'Un brief para empezar', body: 'Una escena de producto tranquila junto al agua. Ayúdame a definir la luz y preparar un clip corto. Muéstrame el modelo, los ajustes y el precio exacto; no generes hasta que lo apruebe.' },
    imageAlt: 'Vista previa de Studio con una conversación creativa central, referencias visuales y una línea de tiempo',
    imageCaption: 'Interfaz de Studio capturada localmente con medios de demostración.',
    workflow: { eyebrow: 'De la primera idea al siguiente plano', title: 'Tu idea marca el ritmo.', steps: [
      { title: 'Trae tu brief de producto', body: 'Abre una conversación después de iniciar sesión. Describe la escena de producto y añade una referencia de tu biblioteca si ayuda a explicar la dirección.' },
      { title: 'Define y revisa el precio', body: 'Desarrolla el prompt con el asistente. Revisa el modelo, las referencias, los ajustes y el precio exacto actual antes de decidir si quieres generar.' },
      { title: 'Aprueba y conserva el medio', body: 'Confirma el precio para iniciar el intento de pago. Cuando termine, conserva la imagen o el clip individual en tu biblioteca de medios.' },
    ] },
    capabilities: { title: 'Espacio para explorar. Herramientas para dar forma a tu idea.', items: [
      { title: 'Una conversación con contexto', body: 'Mantén el diálogo creativo junto a las referencias y los resultados del proyecto. Una idea, un prompt o una imagen puede ser todo el proyecto.' },
      { title: 'Imágenes, clips y sonido', body: 'Crea imágenes, prolonga o transforma tus clips y trabaja con voces, música y sonido. Studio propone modelos y referencias compatibles, con un presupuesto separado para cada creación.' },
      { title: 'Una secuencia a tu manera', body: 'Lleva los medios listos a la línea de tiempo de la conversación y ajusta el montaje. La exportación MP4 aún no está disponible durante la beta pública.' },
    ] },
    control: { title: 'El siguiente paso de pago lo decides tú.', body: 'Cada generación tiene un presupuesto exacto que debes confirmar. Cambiar una petición puede cambiar su precio. Un fallo o un reembolso nunca autoriza otra generación.' },
    mcp: { title: '¿Ya trabajas con un asistente?', body: 'La conexión MCP de MaxVideoAI lleva información actual de modelos, presupuestos y recuperación de generaciones a los flujos compatibles. La configuración y las capacidades verificadas varían según el cliente.', cta: 'Explorar conexiones con asistentes' },
    faq: { title: 'Antes de empezar', items: [
      { question: '¿Todo el mundo puede usar Studio?', answer: 'Studio está abierto en beta pública. Inicia sesión o crea una cuenta de MaxVideoAI para empezar una nueva conversación creativa. También puedes volver a abrir tus proyectos existentes.' },
      { question: '¿Necesito planear un vídeo completo?', answer: 'No. Empieza con una idea, una referencia, un prompt que quieras mejorar o una imagen. Construye una secuencia solo cuando tu idea lo necesite.' },
      { question: '¿El asistente de Studio tiene un coste?', answer: 'Studio muestra el porcentaje restante de tus cuotas de asistencia incluidas. Son cuotas limitadas por cuenta, no crédito del monedero; los proyectos nuevos no las restablecen. La asistencia Sol de pago utiliza un presupuesto que autorizas expresamente desde tu monedero MaxVideoAI, a las tarifas por token indicadas en Studio. Puedes elegir Luna expresamente sin coste adicional de asistencia mientras quede cuota incluida. La asistencia nunca se recarga automáticamente. La generación de medios se cobra por separado.' },
      { question: '¿Cómo sé cuánto cuesta una generación?', answer: 'Studio prepara un presupuesto para el modelo, los ajustes y las referencias elegidos. Revisa el importe exacto antes de confirmar. Una estimación no autoriza un gasto.' },
      { question: '¿Puedo exportar mi secuencia en MP4?', answer: 'Puedes organizar y editar tus medios en la línea de tiempo. La exportación MP4 aún no está disponible durante la beta pública.' },
      { question: '¿Studio es lo mismo que la conexión MCP?', answer: 'Studio es un espacio de creación de MaxVideoAI. MCP conecta un asistente externo con herramientas concretas de MaxVideoAI. El cliente mantiene su conversación; la conexión no proporciona a MaxVideoAI su historial completo.' },
    ] },
    closing: { title: 'Dale espacio a tu próxima idea.', body: 'Inicia sesión o crea una cuenta y empieza una nueva conversación en Studio.' },
  },
};

export function getStudioMarketingCopy(locale: AppLocale): StudioMarketingCopy {
  return copy[locale];
}
