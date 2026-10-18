import type { AppLocale } from '@/i18n/locales';

export type AboutCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; subtitle: string };
  identity: { label: string; body: string };
  work: { title: string; items: Array<{ label: string; href: string }> };
  sections: Array<{ title: string; body: string }>;
  independence: { title: string; body: string };
  links: { standards: string; benchmarks: string; company: string; legal: string };
};

const COPY: Record<AppLocale, AboutCopy> = {
  en: {
    meta: {
      title: 'About MaxVideoAI',
      description:
        'Discover MaxVideoAI, its production workflows, model comparisons, and editorial methodology.',
    },
    hero: {
      eyebrow: 'About MaxVideoAI',
      title: 'A clearer way to choose and use AI video models.',
      subtitle:
        'MaxVideoAI brings model comparison, price-before-generation, and production workflows into one focused workspace.',
    },
    identity: {
      label: 'The platform',
      body:
        'MaxVideoAI publishes practical guides, model comparisons, and production examples. Its editorial standards distinguish provider specifications, observed measurements, and editorial judgments.',
    },
    work: {
      title: "Selected work and production notes",
      items: [
        { label: "AI podcast: workflow, revisions and editing decisions", href: "/blog/gpt-6-podcast-maxvideoai-premiere-pro" },
        { label: "Wan 3 Prime: a published match-cut example and its prompt", href: "/video/wan-3-prime-ai-match-cut-transitions" },
      ],
    },
    sections: [
      {
        title: 'What we build',
        body:
          'One workspace for comparing current and legacy AI video models, preparing inputs, seeing the price before generation, and reviewing outputs.',
      },
      {
        title: 'Why model choice matters',
        body:
          'Different shots need different strengths. MaxVideoAI keeps model capabilities, pricing, examples, and controls visible so the choice stays practical.',
      },
      {
        title: 'How we evaluate models',
        body:
          'Provider specifications, observed production timing, and MaxVideoAI editorial scores are kept separate and linked to their methodology.',
      },
    ],
    independence: {
      title: 'Our commercial relationship',
      body:
        'MaxVideoAI sells access to the models it covers. We disclose that relationship and separate sourced facts, observed production metrics, and editorial judgment.',
    },
    links: {
      standards: 'Read Editorial Standards',
      benchmarks: 'Open Benchmark Lab',
      company: 'Company & Trust',
      legal: 'Legal center',
    },
  },
  fr: {
    meta: {
      title: 'À propos de MaxVideoAI',
      description:
        'Découvrez MaxVideoAI, ses workflows de production, ses comparatifs de modèles et sa méthodologie éditoriale.',
    },
    hero: {
      eyebrow: 'À propos de MaxVideoAI',
      title: 'Une manière plus claire de choisir et d’utiliser les modèles vidéo IA.',
      subtitle:
        'MaxVideoAI réunit comparaison des modèles, prix avant génération et workflows de production dans un espace de travail ciblé.',
    },
    identity: {
      label: 'La plateforme',
      body:
        'MaxVideoAI publie des guides pratiques, des comparatifs de modèles et des exemples de production. Ses normes éditoriales distinguent les spécifications fournisseurs, les mesures observées et les appréciations éditoriales.',
    },
    work: {
      title: "Réalisations et notes de production",
      items: [
        { label: "Podcast IA : workflow, révisions et choix de montage (en anglais)", href: "/blog/gpt-6-podcast-maxvideoai-premiere-pro" },
        { label: "Wan 3 Prime : exemple publié de transitions et prompt (en anglais)", href: "/video/wan-3-prime-ai-match-cut-transitions" },
      ],
    },
    sections: [
      {
        title: 'Ce que nous construisons',
        body:
          'Un seul espace pour comparer les modèles vidéo IA actuels et legacy, préparer les entrées, voir le prix avant génération et examiner les rendus.',
      },
      {
        title: 'Pourquoi le choix du modèle compte',
        body:
          'Chaque plan demande des qualités différentes. MaxVideoAI garde capacités, prix, exemples et contrôles visibles pour rendre le choix concret.',
      },
      {
        title: 'Comment nous évaluons les modèles',
        body:
          'Les spécifications fournisseurs, les temps de production observés et les scores éditoriaux MaxVideoAI restent séparés et reliés à leur méthodologie.',
      },
    ],
    independence: {
      title: 'Notre relation commerciale',
      body:
        'MaxVideoAI commercialise l’accès aux modèles présentés. Nous déclarons cette relation et séparons les faits sourcés, les mesures de production observées et le jugement éditorial.',
    },
    links: {
      standards: 'Lire les normes éditoriales',
      benchmarks: 'Ouvrir Benchmark Lab',
      company: 'Entreprise & confiance',
      legal: 'Centre juridique',
    },
  },
  es: {
    meta: {
      title: 'Acerca de MaxVideoAI',
      description:
        'Conoce MaxVideoAI, sus flujos de producción, sus comparativas de modelos y su metodología editorial.',
    },
    hero: {
      eyebrow: 'Acerca de MaxVideoAI',
      title: 'Una forma más clara de elegir y usar modelos de video con IA.',
      subtitle:
        'MaxVideoAI reúne comparación de modelos, precio antes de generar y flujos de producción en un solo espacio de trabajo.',
    },
    identity: {
      label: 'La plataforma',
      body:
        'MaxVideoAI publica guías prácticas, comparativas de modelos y ejemplos de producción. Sus estándares editoriales distinguen las especificaciones de proveedores, las mediciones observadas y los juicios editoriales.',
    },
    work: {
      title: "Trabajos y notas de producción",
      items: [
        { label: "Podcast con IA: flujo, revisiones y decisiones de edición (en inglés)", href: "/blog/gpt-6-podcast-maxvideoai-premiere-pro" },
        { label: "Wan 3 Prime: ejemplo publicado de transiciones y prompt (en inglés)", href: "/video/wan-3-prime-ai-match-cut-transitions" },
      ],
    },
    sections: [
      {
        title: 'Lo que desarrollamos',
        body:
          'Un espacio para comparar modelos de video con IA actuales y legacy, preparar entradas, ver el precio antes de generar y revisar resultados.',
      },
      {
        title: 'Por qué importa elegir el modelo',
        body:
          'Cada toma necesita fortalezas diferentes. MaxVideoAI mantiene visibles las capacidades, los precios, los ejemplos y los controles para facilitar una decisión práctica.',
      },
      {
        title: 'Cómo evaluamos los modelos',
        body:
          'Las especificaciones de proveedores, los tiempos de producción observados y las puntuaciones editoriales de MaxVideoAI se mantienen separados y vinculados a su metodología.',
      },
    ],
    independence: {
      title: 'Nuestra relación comercial',
      body:
        'MaxVideoAI comercializa el acceso a los modelos que presenta. Declaramos esa relación y separamos los datos con fuente, las métricas de producción observadas y el criterio editorial.',
    },
    links: {
      standards: 'Leer estándares editoriales',
      benchmarks: 'Abrir Benchmark Lab',
      company: 'Empresa y confianza',
      legal: 'Centro legal',
    },
  },
};

export function getAboutCopy(locale: AppLocale): AboutCopy {
  return COPY[locale] ?? COPY.en;
}
