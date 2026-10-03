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
    meta: { title: 'Studio — a creative conversation for image and video', description: 'Explore the MaxVideoAI Studio preview: develop an idea, work with references, review generation quotes and shape your sequence in one creative workspace.' },
    eyebrow: 'MaxVideoAI Studio · Private preview',
    title: 'Start with an idea.\nMake it yours.',
    introduction: 'A conversation at the center. Your references and results around it. Explore a direction, create an image or video, and bring the pieces together when you are ready.',
    primaryCta: 'Open Studio preview', secondaryCta: 'Explore the workflow',
    accessNote: 'Studio is in private preview. Access depends on your account; opening Studio does not launch a generation.',
    imageAlt: 'Studio preview with a central creative conversation, visual references and a sequence timeline',
    imageCaption: 'Studio interface captured in a local preview with demonstration media. Production access remains restricted.',
    workflow: { eyebrow: 'From the first thought to the next frame', title: 'Your brief sets the pace.', steps: [
      { title: 'Bring an idea', body: 'Describe the feeling, scene or result you want. Add references from your media library when they help explain the direction.' },
      { title: 'Find the right approach', body: 'Develop a prompt, explore an image or plan a sequence. Model suggestions follow your request, available modes and reference needs.' },
      { title: 'Review, then create', body: 'Review the model, settings and exact generation quote. Confirm that quote when you are ready to start the paid attempt.' },
    ] },
    capabilities: { title: 'Room to explore. Tools to finish.', items: [
      { title: 'A conversation with context', body: 'Keep the creative discussion alongside project references and results. An idea, a prompt or a single image can be the whole project.' },
      { title: 'Images and video, together', body: 'Create with the models and modes available to your account. Keep your chosen model, or ask for a suitable alternative when a constraint changes.' },
      { title: 'A sequence you can shape', body: 'Bring ready media into the timeline, adjust the cut and review an export quote. The advanced canvas remains available for structured project work.' },
    ] },
    control: { title: 'The next paid step stays yours.', body: 'Generation and export have their own exact quotes and confirmation. Changing a request can change its price. A failed attempt or a refund never authorizes a new generation.' },
    mcp: { title: 'Already working with an assistant?', body: 'The MaxVideoAI MCP connection brings current model facts, quotes and generation recovery into supported assistant workflows. Setup and verified capabilities vary by host.', cta: 'Explore assistant connections' },
    faq: { title: 'Before you start', items: [
      { question: 'Can everyone use Studio today?', answer: 'Studio is currently a private preview. The entry link checks your account access. Public availability and the production rollout are separate from this preview.' },
      { question: 'Do I need a complete video plan?', answer: 'No. Start with a brief, a reference, a prompt to refine or one image. Build a sequence only when it serves your idea.' },
      { question: 'Does the Studio assistant cost money?', answer: 'Studio shows your included assistance allowance and its limits. Paid Sol assistance uses a budget you explicitly authorize from your MaxVideoAI wallet, at the token rates shown in Studio. You can choose Luna at no extra assistant fee while its included allowance is available. Assistance has no automatic recharge. Media generation and export are charged separately.' },
      { question: 'How do I know what a generation costs?', answer: 'Studio prepares a quote for the selected model, settings and references. Review the exact amount before confirming. Export has its own quote; an estimate is not an authorization to spend.' },
      { question: 'Is Studio the same as the MCP connection?', answer: 'Studio is a MaxVideoAI workspace. MCP connects an external assistant to specific MaxVideoAI tools. The external host keeps its own conversation; the connection does not give MaxVideoAI its full chat history.' },
    ] },
    closing: { title: 'Give your next idea some space.', body: 'Open the preview with an eligible account, or explore the models and examples while Studio develops.' },
  },
  fr: {
    meta: { title: 'Studio — créer des images et des vidéos en dialogue', description: 'Découvrez l’aperçu de MaxVideoAI Studio : développez une idée, travaillez avec vos références, validez vos devis et composez votre séquence.' },
    eyebrow: 'MaxVideoAI Studio · Aperçu privé', title: 'Une idée pour commencer.\nVotre regard pour la suite.',
    introduction: 'La conversation au centre. Vos références et vos résultats autour. Explorez une direction, créez une image ou une vidéo, puis assemblez les éléments quand vous le souhaitez.',
    primaryCta: 'Ouvrir l’aperçu Studio', secondaryCta: 'Découvrir le parcours',
    accessNote: 'Studio est en aperçu privé. L’accès dépend de votre compte ; ouvrir Studio ne lance aucune génération.',
    imageAlt: 'Aperçu de Studio avec une conversation créative centrale, des références visuelles et une timeline',
    imageCaption: 'Interface Studio capturée en aperçu local avec des médias de démonstration. L’accès en production reste restreint.',
    workflow: { eyebrow: 'De la première idée au prochain plan', title: 'Votre brief donne le rythme.', steps: [
      { title: 'Partez d’une idée', body: 'Décrivez l’ambiance, la scène ou le résultat souhaité. Ajoutez des références de votre bibliothèque lorsqu’elles précisent votre intention.' },
      { title: 'Trouvez la bonne approche', body: 'Développez un prompt, explorez une image ou préparez une séquence. Les suggestions de modèles suivent votre demande, les modes disponibles et vos références.' },
      { title: 'Vérifiez, puis créez', body: 'Examinez le modèle, les réglages et le devis exact. Confirmez ce devis lorsque vous souhaitez lancer la tentative payante.' },
    ] },
    capabilities: { title: 'De l’espace pour explorer. Des outils pour aboutir.', items: [
      { title: 'Une conversation en contexte', body: 'Gardez l’échange créatif aux côtés des références et résultats du projet. Une idée, un prompt ou une image peut constituer le projet entier.' },
      { title: 'Images et vidéos, ensemble', body: 'Créez avec les modèles et modes accessibles à votre compte. Gardez le modèle choisi, ou demandez une alternative adaptée lorsqu’une contrainte change.' },
      { title: 'Une séquence à votre main', body: 'Placez vos médias prêts dans la timeline, ajustez le montage et consultez un devis d’export. Le canvas avancé reste disponible pour les projets structurés.' },
    ] },
    control: { title: 'Vous décidez de la prochaine étape payante.', body: 'Génération et export disposent chacun d’un devis exact à confirmer. Une modification de la demande peut changer son prix. Un échec ou un remboursement n’autorise jamais une nouvelle génération.' },
    mcp: { title: 'Vous travaillez déjà avec un assistant ?', body: 'La connexion MCP MaxVideoAI apporte les informations actuelles des modèles, les devis et la récupération des générations dans les parcours compatibles. La configuration et les capacités vérifiées dépendent de l’hôte.', cta: 'Découvrir les connexions aux assistants' },
    faq: { title: 'Avant de commencer', items: [
      { question: 'Tout le monde peut-il utiliser Studio ?', answer: 'Studio est actuellement en aperçu privé. Le lien d’entrée vérifie l’accès de votre compte. La disponibilité publique et le déploiement en production sont distincts de cet aperçu.' },
      { question: 'Faut-il prévoir une vidéo complète ?', answer: 'Non. Partez d’un brief, d’une référence, d’un prompt à affiner ou d’une image. Construisez une séquence seulement si votre idée le demande.' },
      { question: 'L’assistant Studio est-il payant ?', answer: 'Studio affiche votre quota d’assistance inclus et ses limites. L’assistance Sol payante utilise un budget que vous autorisez explicitement depuis votre portefeuille MaxVideoAI, aux tarifs par token affichés dans Studio. Vous pouvez choisir Luna sans frais d’assistance supplémentaires tant que son quota inclus est disponible. L’assistance ne se recharge jamais automatiquement. La génération de médias et l’export sont facturés séparément.' },
      { question: 'Comment connaître le prix d’une génération ?', answer: 'Studio prépare un devis selon le modèle, les réglages et les références sélectionnés. Vérifiez le montant exact avant de confirmer. L’export a son propre devis ; une estimation n’autorise aucune dépense.' },
      { question: 'Studio et la connexion MCP sont-ils identiques ?', answer: 'Studio est un espace de création MaxVideoAI. MCP relie un assistant externe à des outils précis de MaxVideoAI. L’hôte conserve sa conversation ; cette connexion ne donne pas à MaxVideoAI son historique complet.' },
    ] },
    closing: { title: 'Faites de la place à votre prochaine idée.', body: 'Ouvrez l’aperçu avec un compte éligible, ou explorez les modèles et les exemples pendant que Studio évolue.' },
  },
  es: {
    meta: { title: 'Studio — crea imágenes y vídeos conversando', description: 'Descubre la vista previa de MaxVideoAI Studio: desarrolla una idea, trabaja con referencias, revisa presupuestos y da forma a tu secuencia.' },
    eyebrow: 'MaxVideoAI Studio · Vista previa privada', title: 'Empieza con una idea.\nDale tu mirada.',
    introduction: 'Una conversación en el centro. Tus referencias y resultados alrededor. Explora una dirección, crea una imagen o un vídeo y reúne las piezas cuando quieras.',
    primaryCta: 'Abrir la vista previa de Studio', secondaryCta: 'Explorar el proceso',
    accessNote: 'Studio está en vista previa privada. El acceso depende de tu cuenta; abrir Studio no inicia ninguna generación.',
    imageAlt: 'Vista previa de Studio con una conversación creativa central, referencias visuales y una línea de tiempo',
    imageCaption: 'Interfaz de Studio capturada en una vista previa local con medios de demostración. El acceso en producción sigue restringido.',
    workflow: { eyebrow: 'De la primera idea al siguiente plano', title: 'Tu idea marca el ritmo.', steps: [
      { title: 'Trae una idea', body: 'Describe la atmósfera, la escena o el resultado que buscas. Añade referencias de tu biblioteca cuando ayuden a explicar la dirección.' },
      { title: 'Encuentra el enfoque', body: 'Desarrolla un prompt, explora una imagen o prepara una secuencia. Las sugerencias de modelos siguen tu petición, los modos disponibles y las referencias necesarias.' },
      { title: 'Revisa y crea', body: 'Revisa el modelo, los ajustes y el presupuesto exacto de generación. Confirma ese presupuesto cuando quieras iniciar el intento de pago.' },
    ] },
    capabilities: { title: 'Espacio para explorar. Herramientas para terminar.', items: [
      { title: 'Una conversación con contexto', body: 'Mantén el diálogo creativo junto a las referencias y los resultados del proyecto. Una idea, un prompt o una imagen puede ser todo el proyecto.' },
      { title: 'Imágenes y vídeo, juntos', body: 'Crea con los modelos y modos disponibles para tu cuenta. Conserva el modelo elegido o pide una alternativa adecuada cuando cambie una limitación.' },
      { title: 'Una secuencia a tu manera', body: 'Lleva los medios listos a la línea de tiempo, ajusta el montaje y revisa un presupuesto de exportación. El lienzo avanzado sigue disponible para proyectos estructurados.' },
    ] },
    control: { title: 'El siguiente paso de pago lo decides tú.', body: 'La generación y la exportación tienen sus propios presupuestos exactos y confirmaciones. Cambiar una petición puede cambiar su precio. Un fallo o un reembolso nunca autoriza otra generación.' },
    mcp: { title: '¿Ya trabajas con un asistente?', body: 'La conexión MCP de MaxVideoAI lleva información actual de modelos, presupuestos y recuperación de generaciones a los flujos compatibles. La configuración y las capacidades verificadas varían según el cliente.', cta: 'Explorar conexiones con asistentes' },
    faq: { title: 'Antes de empezar', items: [
      { question: '¿Todo el mundo puede usar Studio?', answer: 'Studio está actualmente en vista previa privada. El enlace de entrada comprueba el acceso de tu cuenta. La disponibilidad pública y el despliegue en producción son etapas distintas de esta vista previa.' },
      { question: '¿Necesito planear un vídeo completo?', answer: 'No. Empieza con una idea, una referencia, un prompt que quieras mejorar o una imagen. Construye una secuencia solo cuando tu idea lo necesite.' },
      { question: '¿El asistente de Studio tiene un coste?', answer: 'Studio muestra tu asistencia incluida y sus límites. La asistencia Sol de pago utiliza un presupuesto que autorizas expresamente desde tu monedero MaxVideoAI, a las tarifas por token indicadas en Studio. Puedes elegir Luna sin coste adicional de asistencia mientras quede cuota incluida. La asistencia nunca se recarga automáticamente. La generación de medios y la exportación se cobran por separado.' },
      { question: '¿Cómo sé cuánto cuesta una generación?', answer: 'Studio prepara un presupuesto para el modelo, los ajustes y las referencias elegidos. Revisa el importe exacto antes de confirmar. La exportación tiene su propio presupuesto; una estimación no autoriza un gasto.' },
      { question: '¿Studio es lo mismo que la conexión MCP?', answer: 'Studio es un espacio de creación de MaxVideoAI. MCP conecta un asistente externo con herramientas concretas de MaxVideoAI. El cliente mantiene su conversación; la conexión no proporciona a MaxVideoAI su historial completo.' },
    ] },
    closing: { title: 'Dale espacio a tu próxima idea.', body: 'Abre la vista previa con una cuenta elegible o explora los modelos y ejemplos mientras Studio evoluciona.' },
  },
};

export function getStudioMarketingCopy(locale: AppLocale): StudioMarketingCopy {
  return copy[locale];
}
