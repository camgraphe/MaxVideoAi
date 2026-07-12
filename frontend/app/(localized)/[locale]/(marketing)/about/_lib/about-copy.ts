import type { AppLocale } from '@/i18n/locales';

export type AboutCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; subtitle: string };
  identity: { label: string; body: string };
  sections: Array<{ title: string; body: string }>;
  independence: { title: string; body: string };
  links: { standards: string; benchmarks: string; company: string; legal: string };
};

const COPY: Record<AppLocale, AboutCopy> = {
  en: {
    meta: {
      title: 'About MaxVideoAI',
      description:
        'Meet the founder of MaxVideoAI and learn how the product, model comparisons, and editorial methodology are maintained.',
    },
    hero: {
      eyebrow: 'About MaxVideoAI',
      title: 'A clearer way to choose and use AI video models.',
      subtitle:
        'MaxVideoAI brings model comparison, price-before-generation, and production workflows into one focused workspace.',
    },
    identity: {
      label: 'Built and maintained by',
      body:
        'Adrien builds the product, evaluates model behavior, and maintains MaxVideoAI’s practical guides and benchmark methodology.',
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
        'Découvrez le fondateur de MaxVideoAI et la manière dont le produit, les comparatifs et la méthodologie éditoriale sont maintenus.',
    },
    hero: {
      eyebrow: 'À propos de MaxVideoAI',
      title: 'Une manière plus claire de choisir et d’utiliser les modèles vidéo IA.',
      subtitle:
        'MaxVideoAI réunit comparaison des modèles, prix avant génération et workflows de production dans un espace de travail ciblé.',
    },
    identity: {
      label: 'Conçu et maintenu par',
      body:
        'Adrien développe le produit, évalue le comportement des modèles et maintient les guides pratiques ainsi que la méthodologie de benchmark de MaxVideoAI.',
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
        'Conoce al fundador de MaxVideoAI y cómo se mantienen el producto, las comparativas y la metodología editorial.',
    },
    hero: {
      eyebrow: 'Acerca de MaxVideoAI',
      title: 'Una forma más clara de elegir y usar modelos de video con IA.',
      subtitle:
        'MaxVideoAI reúne comparación de modelos, precio antes de generar y flujos de producción en un solo espacio de trabajo.',
    },
    identity: {
      label: 'Creado y mantenido por',
      body:
        'Adrien desarrolla el producto, evalúa el comportamiento de los modelos y mantiene las guías prácticas y la metodología de benchmarks de MaxVideoAI.',
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
