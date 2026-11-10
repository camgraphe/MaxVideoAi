import type { AppLocale } from '@/i18n/locales';

export const platformGuideChecked = '2026-11-10';

type SourceLabel = 'workflow' | 'credits' | 'packs' | 'assistant' | 'mcp' | 'offer' | 'realtime' | 'nodes';
export type GuideSource = { label: SourceLabel; href: string };
type Evidence = { name: string; workflow: GuideSource[]; web: GuideSource[]; assistant: GuideSource[] };

export const platformEvidence = {
  maxvideoai: {
    name: 'MaxVideoAI',
    workflow: [{ label: 'workflow', href: 'https://maxvideoai.com/pay-as-you-go-ai-video-generator' }],
    web: [{ label: 'credits', href: 'https://maxvideoai.com/pricing' }],
    assistant: [
      { label: 'assistant', href: 'https://maxvideoai.com/ai-video-prompt-generator' },
      { label: 'mcp', href: 'https://maxvideoai.com/docs/mcp' },
    ],
  },
  higgsfield: {
    name: 'Higgsfield',
    workflow: [{ label: 'workflow', href: 'https://higgsfield.ai/blog/cinema-studio-4-0-complete-guide' }],
    web: [
      { label: 'packs', href: 'https://higgsfield.ai/creator-hub/help-center/credits/how-credit-packs-work' },
      { label: 'credits', href: 'https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work' },
    ],
    assistant: [
      { label: 'assistant', href: 'https://geo.higgsfield.ai/blog/recommended/which-ai-tool-best-automates-daily-content-across-channels-8660c3' },
      { label: 'mcp', href: 'https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent' },
      { label: 'offer', href: 'https://higgsfield.ai/' },
    ],
  },
  openart: {
    name: 'OpenArt',
    workflow: [{ label: 'workflow', href: 'https://openart.ai/features/director/' }],
    web: [
      { label: 'credits', href: 'https://openart.ai/help/#credit-usage' },
      { label: 'packs', href: 'https://openart.ai/pricing' },
      { label: 'offer', href: 'https://openart.ai/faq/' },
    ],
    assistant: [
      { label: 'assistant', href: 'https://openart.ai/features/chat-mode/' },
      { label: 'mcp', href: 'https://openart.ai/mcp/claude-ai-video-generator/' },
    ],
  },
  krea: {
    name: 'Krea',
    workflow: [
      { label: 'realtime', href: 'https://www.krea.ai/docs/user-guide/features/realtime' },
      { label: 'nodes', href: 'https://www.krea.ai/docs/user-guide/features/nodes' },
    ],
    web: [{ label: 'credits', href: 'https://www.krea.ai/docs/user-guide/help-and-support/compute-units' }],
    assistant: [
      { label: 'assistant', href: 'https://www.krea.ai/docs/user-guide/agent/plans-and-credits' },
      { label: 'mcp', href: 'https://www.krea.ai/docs/developers/mcp' },
    ],
  },
  kling: {
    name: 'Kling',
    workflow: [{ label: 'workflow', href: 'https://kling.ai/dev/model-release/kling-4' }],
    web: [
      { label: 'packs', href: 'https://kling.ai/docs/payment-policy' },
      { label: 'credits', href: 'https://kling.ai/docs/point-policy' },
    ],
    assistant: [
      { label: 'assistant', href: 'https://kling.ai/dev/model-release/kling-4' },
      { label: 'mcp', href: 'https://kling.ai/app/mcp/guide' },
    ],
  },
  magnific: {
    name: 'Magnific',
    workflow: [{ label: 'workflow', href: 'https://www.magnific.com/ai/docs/custom-agents' }],
    web: [{ label: 'credits', href: 'https://www.magnific.com/ai/docs/ai-credits-and-limits' }],
    assistant: [
      { label: 'assistant', href: 'https://www.magnific.com/ai/docs/custom-agents' },
      { label: 'mcp', href: 'https://www.magnific.com/ai/docs/magnific-mcp' },
    ],
  },
  invideo: {
    name: 'InVideo',
    workflow: [{ label: 'workflow', href: 'https://invideo.io/editor/' }],
    web: [{ label: 'credits', href: 'https://help.invideo.io/en/articles/11528140-invideo-plans-and-credits-everything-you-need-to-know' }],
    assistant: [
      { label: 'assistant', href: 'https://invideo.io/faq/agentic-video-editing/' },
      { label: 'mcp', href: 'https://invideo.io/mcp/' },
    ],
  },
} satisfies Record<string, Evidence>;

export type PlatformId = keyof typeof platformEvidence;

type PlatformRow = { fit: string; web: string; assistant: string };
type GuideCopy = {
  checked: string;
  publisher: string;
  contentsLabel: string;
  labels: Record<SourceLabel, string>;
  jobs: {
    title: string;
    intro: string;
    items: { title: string; description: string; platforms: PlatformId[] }[];
    sourceAlt: string;
    imageAlt: string;
    imageCaption: string;
    imageLink: string;
  };
  matrix: {
    title: string;
    intro: string;
    columns: [string, string, string];
    rows: Record<PlatformId, PlatformRow>;
    note: string;
  };
  duels: {
    title: string;
    items: { id: string; title: string; picks: { platform: PlatformId; description: string }[]; check: string }[];
  };
  budget: {
    title: string;
    scenario: string;
    checked: string;
    labels: [string, string, string];
    note: string;
    price: string;
    details: string;
    comparison: string;
  };
};

export const platformGuideCopy: Record<AppLocale, GuideCopy> = {
  en: {
    checked: 'Public terms checked on',
    publisher: 'Published by MaxVideoAI, one of the platforms compared.',
    contentsLabel: 'In this guide',
    labels: { workflow: 'Workflow', credits: 'Credit terms', packs: 'Credit packs', assistant: 'Assistant', mcp: 'MCP', offer: 'Offer', realtime: 'Realtime', nodes: 'Nodes' },
    jobs: {
      title: 'Start with what you need to deliver',
      intro: 'A reverse shot, an edited film and a reusable visual process put different demands on an AI video platform.',
      items: [
        { title: 'A few clips for your edit', description: 'Check the first payment and whether you can keep unused credits between jobs.', platforms: ['maxvideoai', 'kling'] },
        { title: 'An assembled film', description: 'Check what you can edit on the timeline and export with sound.', platforms: ['openart', 'invideo'] },
        { title: 'A shot you can direct', description: 'Look for the camera, lighting and reference controls your shot actually needs.', platforms: ['higgsfield', 'kling'] },
        { title: 'A visual process you can repeat', description: 'Look for a live canvas or a sequence of steps you can save and reuse.', platforms: ['krea', 'magnific'] },
      ],
      sourceAlt: 'A woman in a rust jacket and a man in navy face each other across a table at dusk.',
      imageAlt: 'Over the man’s shoulder, a woman in a rust jacket faces him across the table.',
      imageCaption: 'A reference frame alongside the reverse angle produced with MaxVideoAI Angle.',
      imageLink: 'See how Angle works',
    },
    matrix: {
      title: 'Compare seven AI video platforms',
      intro: 'MCP connects a compatible AI assistant to a platform’s tools. The table separates Web credit terms from the rules inside an assistant.',
      columns: ['Platform and workflow', 'Web purchase and balance', 'Assistant and MCP'],
      rows: {
        maxvideoai: { fit: 'Generate individual shots across models and check the price before rendering.', web: 'Media top-ups from US$10 without a MaxVideoAI subscription. Purchased media credits stay available between projects.', assistant: 'Milo Lite has free assistance within limits. MCP planning and quotes use no media credits. Paid renders require approval.' },
        higgsfield: { fit: 'Cinema Studio for camera, lens and lighting controls.', web: 'An active plan is required to buy Web packs. Plan credits reset each cycle. Packs last 90 days and can still be used on eligible Free-plan models after cancellation.', assistant: 'Supercomputer Free mode uses zero credits for text when available. Media uses credits. Standard MCP requires a subscription. New Claude MCP users may qualify for unlimited eligible generations.' },
        openart: { fit: 'Director assembles multi-scene projects with audio.', web: 'Monthly plan credits reset. Plus, Pro and Wonder offer extra packs that renew automatically each month until canceled. Unused add-on credits roll over while subscribed. New accounts have a limited trial.', assistant: 'Chat Mode text is free. Renders use credits. MCP is included from Starter. Check trial eligibility for your host and model.' },
        krea: { fit: 'Realtime canvas and reusable Nodes graphs for visual iteration.', web: 'Paid plans can buy Web packs that expire after 90 days. Included units on individual paid plans reset each cycle.', assistant: 'Free-plan Agent text can use units. Media generation uses units. MCP can use workspace units or a separate API balance, depending on the connection.' },
        kling: { fit: 'Frame and multi-shot controls, depending on the model and mode.', web: 'The payment policy describes one-off credits valid for two years. Check the local checkout and any member-only uses.', assistant: 'The cost of Canvas Agent text alone is unverified. MCP and CLI accept paid Personal credits from non-subscribers, with one concurrent video.' },
        magnific: { fit: 'Spaces and Agents for reusable visual workflows.', web: 'Plan credits reset on renewal. Eligible packs can last up to three years with an active subscription. Remaining pack credits expire when the subscription ends.', assistant: 'Agents offer a Brainstorm mode. Text-only cost is unverified. MCP requires a paid plan and media uses credits.' },
        invideo: { fit: 'An editable timeline for a finished film.', web: 'Plan credits reset. Top-ups last up to 12 months or until the paid subscription ends, whichever comes first.', assistant: 'InVideo describes ordinary editing and MCP connection as free. AI generation uses InVideo credits. Host charges are separate.' },
      },
      note: 'Web credits, assistant access and developer API billing follow separate terms. Check the account, model, region and current offer before buying.',
    },
    duels: {
      title: 'Two choices between platforms',
      items: [
        {
          id: 'openart-vs-krea',
          title: 'OpenArt vs Krea',
          picks: [
            { platform: 'openart', description: 'Look at Director when your brief needs to become a multi-scene project with voices and music.' },
            { platform: 'krea', description: 'Look at Realtime and Nodes when you need to explore a look live or rerun a visual process with different inputs.' },
          ],
          check: 'Try one brief through the final export or the reusable graph. Confirm which tools your plan includes.',
        },
        {
          id: 'higgsfield-vs-openart',
          title: 'Higgsfield vs OpenArt',
          picks: [
            { platform: 'higgsfield', description: 'Look at Cinema Studio when the job depends on how you set the camera, lens or light in a particular shot.' },
            { platform: 'openart', description: 'Look at Director when the work is bringing several scenes, characters and audio together in one project.' },
          ],
          check: 'Check the controls or assembly you need in that workflow. For a cost comparison, match the exact model and settings.',
        },
      ],
    },
    budget: {
      title: 'Budget the next clip in three amounts',
      scenario: 'LTX 2.5 Pro · text to video · 10 s · 720p · audio off · no references',
      checked: 'Price checked on',
      labels: ['Media top-up', 'One completed render', 'Media balance left'],
      note: 'Example with an empty MaxVideoAI wallet and one completed render. Amounts in USD. Taxes or currency conversion may affect the payment.',
      price: 'See the preset price',
      details: 'Compare the cost of one, three or six attempts',
      comparison: 'Compare MaxVideoAI and Higgsfield for an occasional project',
    },
  },
  fr: {
    checked: 'Conditions publiques vérifiées le',
    publisher: 'Guide publié par MaxVideoAI, qui figure parmi les plateformes comparées.',
    contentsLabel: 'Dans ce guide',
    labels: { workflow: 'Fonctions', credits: 'Crédits', packs: 'Packs', assistant: 'Assistant', mcp: 'MCP', offer: 'Offre', realtime: 'Realtime', nodes: 'Nodes' },
    jobs: {
      title: 'Partez de ce que vous devez livrer',
      intro: 'Un contrechamp, un film monté et un processus visuel à répéter demandent des outils différents.',
      items: [
        { title: 'Quelques plans pour votre montage', description: 'Vérifiez la somme à avancer et ce que devient le solde entre deux projets.', platforms: ['maxvideoai', 'kling'] },
        { title: 'Un film assemblé', description: 'Vérifiez ce que vous pourrez modifier sur la timeline et exporter avec le son.', platforms: ['openart', 'invideo'] },
        { title: 'Un plan à mettre en scène', description: 'Repérez les contrôles de caméra, de lumière et de références utiles à ce plan.', platforms: ['higgsfield', 'kling'] },
        { title: 'Un processus visuel réutilisable', description: 'Cherchez une toile interactive ou des étapes que vous pourrez enregistrer et rejouer.', platforms: ['krea', 'magnific'] },
      ],
      sourceAlt: 'Une femme en veste rouille et un homme en bleu marine se font face à table, au crépuscule.',
      imageAlt: 'Par-dessus l’épaule de l’homme, une femme en veste rouille lui fait face à table.',
      imageCaption: 'Image de référence et contrechamp réalisé avec Angle dans MaxVideoAI.',
      imageLink: 'Découvrir Angle',
    },
    matrix: {
      title: 'Comparer sept plateformes vidéo IA',
      intro: 'Le MCP relie un assistant IA compatible aux outils d’une plateforme. Le tableau sépare les conditions d’achat sur le Web des règles dans un assistant.',
      columns: ['Plateforme et fonctions', 'Achat et solde Web', 'Assistant et MCP'],
      rows: {
        maxvideoai: { fit: 'Générez des plans avec plusieurs modèles et consultez le prix avant de lancer.', web: 'Recharge média dès 10 USD sans abonnement MaxVideoAI. Les crédits médias achetés restent disponibles entre les projets.', assistant: 'Milo Lite offre une aide gratuite dans certaines limites. La préparation et le devis MCP ne débitent pas de crédits média. Vous approuvez les rendus payants.' },
        higgsfield: { fit: 'Cinema Studio pour régler la caméra, l’objectif et la lumière.', web: 'Abonnement actif pour acheter un pack Web. Les crédits du forfait expirent au cycle. Les packs durent 90 jours et restent utilisables après résiliation sur les modèles Free éligibles.', assistant: 'Le texte en mode Free de Supercomputer est sans débit quand ce mode est disponible. Les médias utilisent des crédits. Le MCP standard exige un abonnement. Une offre Claude MCP prévoit des générations illimitées éligibles pour de nouveaux utilisateurs.' },
        openart: { fit: 'Director assemble des projets multi-scènes avec de l’audio.', web: 'Les crédits du plan sont remis à zéro à chaque cycle. Avec Plus, Pro ou Wonder, les packs supplémentaires se renouvellent automatiquement chaque mois jusqu’à leur résiliation. Leur solde se reporte pendant l’abonnement. Essai limité pour les nouveaux comptes.', assistant: 'Le texte dans Chat Mode est gratuit. Les rendus utilisent des crédits. Le MCP est inclus dès Starter. Vérifiez les critères de l’essai selon l’hôte et le modèle.' },
        krea: { fit: 'Toile Realtime et graphes Nodes réutilisables pour explorer un visuel.', web: 'Les forfaits payants permettent d’acheter des packs Web valables 90 jours. Les unités incluses des forfaits individuels payants expirent au cycle.', assistant: 'Sur Free, le texte de l’agent peut consommer des unités. Les médias utilisent des unités. Selon la connexion, le MCP utilise le solde de l’espace ou celui de l’API.' },
        kling: { fit: 'Images clés et découpage multi-plan selon le modèle et le mode.', web: 'Les conditions décrivent des achats ponctuels de crédits valables deux ans. Vérifiez le paiement local et les usages réservés aux membres.', assistant: 'Le coût du texte seul dans Canvas Agent reste à vérifier. MCP et CLI acceptent les crédits payants Personal des non-abonnés, avec une vidéo en parallèle.' },
        magnific: { fit: 'Spaces et Agents pour des processus visuels à réutiliser.', web: 'Les crédits du forfait expirent au renouvellement. Les packs éligibles durent jusqu’à trois ans avec un abonnement actif. Le reliquat du pack expire à la fin de l’abonnement.', assistant: 'Les Agents proposent un mode Brainstorm. Le coût du texte seul reste à vérifier. Le MCP exige un plan payant et les médias utilisent des crédits.' },
        invideo: { fit: 'Une timeline modifiable pour livrer un film monté.', web: 'Les crédits du forfait expirent au cycle. Les recharges durent jusqu’à douze mois ou jusqu’à la fin de l’abonnement payant, selon la première échéance.', assistant: 'InVideo annonce le montage ordinaire et la connexion MCP gratuits. La génération IA consomme des crédits InVideo. Les frais de l’hôte sont distincts.' },
      },
      note: 'Les crédits Web, l’accès dans un assistant et la facturation API suivent leurs propres conditions. Vérifiez le compte, le modèle, la région et l’offre en cours avant achat.',
    },
    duels: {
      title: 'Deux choix entre plateformes',
      items: [
        {
          id: 'openart-vs-krea',
          title: 'OpenArt ou Krea',
          picks: [
            { platform: 'openart', description: 'Regardez Director si votre brief doit aboutir à un projet multi-scènes avec voix et musique.' },
            { platform: 'krea', description: 'Regardez Realtime et Nodes pour explorer un style en direct ou rejouer un processus visuel avec d’autres entrées.' },
          ],
          check: 'Menez un brief jusqu’à l’export final ou au graphe réutilisable. Vérifiez les outils inclus dans votre forfait.',
        },
        {
          id: 'higgsfield-vs-openart',
          title: 'Higgsfield ou OpenArt',
          picks: [
            { platform: 'higgsfield', description: 'Regardez Cinema Studio si votre plan dépend d’un réglage précis de caméra, d’objectif ou de lumière.' },
            { platform: 'openart', description: 'Regardez Director si vous devez assembler plusieurs scènes, personnages et éléments audio dans un projet.' },
          ],
          check: 'Vérifiez les contrôles ou l’assemblage dans le parcours prévu. Pour comparer les coûts, alignez le modèle exact et ses réglages.',
        },
      ],
    },
    budget: {
      title: 'Chiffrez le prochain clip en trois montants',
      scenario: 'LTX 2.5 Pro · texte vers vidéo · 10 s · 720p · sans son · sans référence',
      checked: 'Tarif vérifié le',
      labels: ['Recharge média', 'Un rendu terminé', 'Solde média restant'],
      note: 'Exemple avec un portefeuille MaxVideoAI vide et un rendu terminé. Montants en USD. Le paiement peut varier selon les taxes et la conversion.',
      price: 'Voir le tarif du réglage',
      details: 'Comparer le coût d’un, de trois ou de six essais',
      comparison: 'Comparer MaxVideoAI et Higgsfield pour un projet ponctuel',
    },
  },
  es: {
    checked: 'Condiciones públicas verificadas el',
    publisher: 'Guía publicada por MaxVideoAI, una de las plataformas comparadas.',
    contentsLabel: 'En esta guía',
    labels: { workflow: 'Funciones', credits: 'Créditos', packs: 'Packs', assistant: 'Asistente', mcp: 'MCP', offer: 'Oferta', realtime: 'Realtime', nodes: 'Nodes' },
    jobs: {
      title: 'Empieza por lo que necesitas entregar',
      intro: 'Un contraplano, un vídeo montado y un proceso visual reutilizable requieren herramientas distintas.',
      items: [
        { title: 'Unos planos para tu montaje', description: 'Comprueba cuánto debes pagar al empezar y qué pasa con el saldo entre proyectos.', platforms: ['maxvideoai', 'kling'] },
        { title: 'Un vídeo montado', description: 'Comprueba qué puedes editar en la línea de tiempo y exportar con sonido.', platforms: ['openart', 'invideo'] },
        { title: 'Un plano que quieres dirigir', description: 'Busca los controles de cámara, luz y referencias que necesita tu plano.', platforms: ['higgsfield', 'kling'] },
        { title: 'Un proceso visual reutilizable', description: 'Busca un lienzo en tiempo real o una secuencia de pasos que puedas guardar y repetir.', platforms: ['krea', 'magnific'] },
      ],
      sourceAlt: 'Una mujer con chaqueta teja y un hombre vestido de azul marino se miran a ambos lados de la mesa al anochecer.',
      imageAlt: 'Vista sobre el hombro del hombre mientras una mujer con chaqueta teja lo mira desde el otro lado de la mesa.',
      imageCaption: 'Imagen de referencia y contraplano creado con Angle en MaxVideoAI.',
      imageLink: 'Descubrir Angle',
    },
    matrix: {
      title: 'Compara siete plataformas de vídeo con IA',
      intro: 'MCP conecta un asistente de IA compatible con las herramientas de una plataforma. La tabla separa las compras web de las reglas dentro de un asistente.',
      columns: ['Plataforma y funciones', 'Compra y saldo web', 'Asistente y MCP'],
      rows: {
        maxvideoai: { fit: 'Genera planos con varios modelos y consulta el precio antes de lanzar el render.', web: 'Recarga desde 10 USD sin suscripción a MaxVideoAI. Los créditos de generación comprados se conservan entre proyectos.', assistant: 'Milo Lite ofrece ayuda gratuita con límites. La planificación y la cotización por MCP no consumen créditos de generación. Los renders de pago requieren aprobación.' },
        higgsfield: { fit: 'Cinema Studio para controlar la cámara, el objetivo y la iluminación.', web: 'Hace falta una suscripción activa para comprar packs web. Los créditos del plan vencen en cada ciclo. Los packs duran 90 días y se pueden usar tras cancelar en modelos Free elegibles.', assistant: 'Cuando está disponible, el modo Free de Supercomputer permite texto sin gastar créditos. La generación multimedia usa créditos. El MCP estándar requiere suscripción. Los nuevos usuarios de Claude MCP pueden optar a generaciones ilimitadas elegibles.' },
        openart: { fit: 'Director ensambla proyectos con varias escenas y audio.', web: 'Los créditos del plan se reinician en cada ciclo. Con Plus, Pro o Wonder, los paquetes adicionales se renuevan automáticamente cada mes hasta que los canceles. Su saldo pasa al siguiente mes mientras siga activa la suscripción. Prueba limitada para cuentas nuevas.', assistant: 'El texto en Chat Mode es gratuito. Los renders usan créditos. MCP se incluye desde Starter. Consulta los requisitos de la prueba para el asistente y modelo elegidos.' },
        krea: { fit: 'Lienzo Realtime y grafos reutilizables en Nodes para explorar variantes.', web: 'Los planes de pago permiten comprar packs web que caducan a los 90 días. Las unidades incluidas en planes individuales de pago vencen en cada ciclo.', assistant: 'El texto del agente en Free puede consumir unidades. La generación multimedia consume unidades. Según la conexión, MCP usa el saldo del espacio o el de la API.' },
        kling: { fit: 'Fotogramas clave y varios planos según el modelo y el modo.', web: 'La política de pago describe compras puntuales de créditos válidos durante dos años. Comprueba el pago local y qué usos requieren un plan de pago.', assistant: 'Falta verificar el coste del texto en Canvas Agent. MCP y CLI aceptan créditos Personal comprados sin suscripción, con un vídeo a la vez.' },
        magnific: { fit: 'Spaces y Agents para repetir procesos visuales.', web: 'Los créditos del plan vencen al renovarse. Los packs elegibles duran hasta tres años con suscripción activa. El saldo del pack vence al terminar la suscripción.', assistant: 'Agents tiene modo Brainstorm. Falta verificar el coste de solo texto. MCP requiere un plan de pago y la generación multimedia consume créditos.' },
        invideo: { fit: 'Una línea de tiempo editable para entregar un vídeo montado.', web: 'Los créditos del plan vencen en cada ciclo. Las recargas duran hasta doce meses o hasta el fin de la suscripción de pago, lo que ocurra antes.', assistant: 'InVideo anuncia edición habitual y conexión MCP gratuitas. La generación con IA consume créditos InVideo. El asistente externo puede aplicar sus propios cargos.' },
      },
      note: 'Los créditos web, el acceso desde un asistente y la facturación de la API tienen condiciones distintas. Comprueba la cuenta, el modelo, la región y la oferta vigentes antes de comprar.',
    },
    duels: {
      title: 'Dos decisiones entre plataformas',
      items: [
        {
          id: 'openart-vs-krea',
          title: 'OpenArt vs Krea',
          picks: [
            { platform: 'openart', description: 'Considera Director si quieres convertir un brief en un proyecto con varias escenas, voces y música.' },
            { platform: 'krea', description: 'Considera Realtime y Nodes para explorar un estilo en directo o repetir un proceso visual con otras entradas.' },
          ],
          check: 'Lleva un brief hasta la exportación final o el grafo reutilizable. Comprueba qué herramientas incluye tu plan.',
        },
        {
          id: 'higgsfield-vs-openart',
          title: 'Higgsfield vs OpenArt',
          picks: [
            { platform: 'higgsfield', description: 'Considera Cinema Studio si tu plano depende de ajustar la cámara, el objetivo o la iluminación.' },
            { platform: 'openart', description: 'Considera Director si tienes que unir varias escenas, personajes y audio en un proyecto.' },
          ],
          check: 'Comprueba los controles o el montaje que necesitas. Para comparar costes, usa el mismo modelo con los mismos ajustes.',
        },
      ],
    },
    budget: {
      title: 'Calcula el presupuesto del próximo clip con tres importes',
      scenario: 'LTX 2.5 Pro · texto a vídeo · 10 s · 720p · sin sonido · sin referencias',
      checked: 'Precio verificado el',
      labels: ['Recarga', 'Un render completado', 'Saldo restante'],
      note: 'Ejemplo con un saldo MaxVideoAI inicial de cero y un render completado. Importes en USD. El pago puede variar con los impuestos y la conversión.',
      price: 'Ver el precio de estos ajustes',
      details: 'Comparar el coste de uno, tres o seis intentos',
      comparison: 'Comparar MaxVideoAI y Higgsfield para un proyecto puntual',
    },
  },
};
