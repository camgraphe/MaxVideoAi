import type { AppLocale } from '@/i18n/locales';

export type EditorialStandardsSectionId =
  | 'authorship'
  | 'sources'
  | 'process'
  | 'corrections'
  | 'benchmarks'
  | 'disclosure';

export type EditorialStandardsCopy = {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    reviewedLabel: string;
    reviewedDate: '2026-07-12';
  };
  sections: Array<{
    id: EditorialStandardsSectionId;
    title: string;
    body: string;
    bullets?: string[];
  }>;
  links: { about: string; benchmarks: string; contact: string };
};

const COPY: Record<AppLocale, EditorialStandardsCopy> = {
  en: {
    meta: {
      title: 'Editorial Standards',
      description:
        'Learn how MaxVideoAI handles authorship, sources, corrections, benchmark updates, and commercial-interest disclosure.',
    },
    hero: {
      eyebrow: 'MaxVideoAI editorial practice',
      title: 'Editorial standards for practical AI video research.',
      intro:
        'These standards explain who is accountable for our content, how claims are sourced, and how material corrections or methodology changes are published.',
      reviewedLabel: 'Last reviewed',
      reviewedDate: '2026-07-12',
    },
    sections: [
      {
        id: 'authorship',
        title: 'Authorship and accountability',
        body:
          'Adrien Millot, Founder & Product Lead, is the primary author and editorial lead for MaxVideoAI. If another contributor authors or materially reviews a page, that person will be identified on the page.',
      },
      {
        id: 'sources',
        title: 'How we label sources',
        body:
          'We keep provider documentation, MaxVideoAI product configuration, anonymized observed production metrics, and MaxVideoAI editorial judgment distinct.',
        bullets: [
          'Provider specifications link to the provider or product source.',
          'Observed timing describes rolling production behavior, not a controlled experiment.',
          'Editorial scores are MaxVideoAI judgments under the published methodology.',
        ],
      },
      {
        id: 'process',
        title: 'Before publication',
        body:
          'Material product claims are checked against current routes, source links, visible pricing behavior, and supported controls before publication or a substantial update.',
      },
      {
        id: 'corrections',
        title: 'Corrections',
        body:
          'Send factual corrections to support@maxvideoai.com with the page URL and supporting source. Material corrections update the page and its modified date; they do not rewrite the original publication date.',
      },
      {
        id: 'benchmarks',
        title: 'Benchmark updates',
        body:
          'Benchmark definitions, formulas, prompt protocols, observed latency rules, and methodology changes are versioned in Benchmark Lab. Historical editorial scores are not relabeled as documented prompt-pack runs.',
      },
      {
        id: 'disclosure',
        title: 'Commercial-interest disclosure',
        body:
          'MaxVideoAI sells access to the models it compares. We disclose that commercial relationship and separate sourced facts, observed production metrics, and editorial judgment.',
      },
    ],
    links: { about: 'About the editor', benchmarks: 'Open Benchmark Lab', contact: 'Contact MaxVideoAI' },
  },
  fr: {
    meta: {
      title: 'Normes éditoriales',
      description:
        'Découvrez comment MaxVideoAI gère les auteurs, les sources, les corrections, les mises à jour des benchmarks et la transparence commerciale.',
    },
    hero: {
      eyebrow: 'Pratique éditoriale MaxVideoAI',
      title: 'Des normes éditoriales pour une recherche vidéo IA concrète.',
      intro:
        'Ces normes expliquent qui répond de nos contenus, comment les affirmations sont sourcées et comment les corrections importantes ou les changements de méthode sont publiés.',
      reviewedLabel: 'Dernière révision',
      reviewedDate: '2026-07-12',
    },
    sections: [
      {
        id: 'authorship',
        title: 'Auteur et responsabilité',
        body:
          'Adrien Millot, Founder & Product Lead, est l’auteur principal et le responsable éditorial de MaxVideoAI. Si une autre personne écrit ou relit substantiellement une page, elle sera identifiée sur cette page.',
      },
      {
        id: 'sources',
        title: 'Comment nous identifions les sources',
        body:
          'Nous distinguons la documentation des fournisseurs, la configuration produit MaxVideoAI, les mesures de production observées et anonymisées, et le jugement éditorial MaxVideoAI.',
        bullets: [
          'Les spécifications fournisseurs renvoient vers la source fournisseur ou produit.',
          'Les temps observés décrivent un comportement de production glissant, pas une expérience contrôlée.',
          'Les scores éditoriaux sont des jugements MaxVideoAI appliquant la méthodologie publiée.',
        ],
      },
      {
        id: 'process',
        title: 'Avant publication',
        body:
          'Les affirmations produit importantes sont vérifiées avec les routes actuelles, les liens sources, le comportement tarifaire visible et les contrôles disponibles avant publication ou mise à jour substantielle.',
      },
      {
        id: 'corrections',
        title: 'Corrections',
        body:
          'Envoyez les corrections factuelles à support@maxvideoai.com avec l’URL de la page et une source justificative. Une correction importante met à jour la page et sa date de modification sans réécrire la date de publication initiale.',
      },
      {
        id: 'benchmarks',
        title: 'Mises à jour des benchmarks',
        body:
          'Les définitions, formules, protocoles de prompts, règles de latence observée et changements de méthode sont versionnés dans Benchmark Lab. Les scores éditoriaux historiques ne sont pas présentés comme des exécutions documentées du pack de prompts.',
      },
      {
        id: 'disclosure',
        title: 'Transparence sur l’intérêt commercial',
        body:
          'MaxVideoAI commercialise l’accès aux modèles comparés. Nous déclarons cette relation commerciale et séparons les faits sourcés, les mesures de production observées et le jugement éditorial.',
      },
    ],
    links: { about: 'À propos du responsable', benchmarks: 'Ouvrir Benchmark Lab', contact: 'Contacter MaxVideoAI' },
  },
  es: {
    meta: {
      title: 'Estándares editoriales',
      description:
        'Conoce cómo MaxVideoAI gestiona la autoría, las fuentes, las correcciones, las actualizaciones de benchmarks y la transparencia comercial.',
    },
    hero: {
      eyebrow: 'Práctica editorial de MaxVideoAI',
      title: 'Estándares editoriales para investigar video con IA de forma práctica.',
      intro:
        'Estos estándares explican quién responde por nuestro contenido, cómo se sustentan las afirmaciones y cómo publicamos correcciones importantes o cambios de metodología.',
      reviewedLabel: 'Última revisión',
      reviewedDate: '2026-07-12',
    },
    sections: [
      {
        id: 'authorship',
        title: 'Autoría y responsabilidad',
        body:
          'Adrien Millot, Founder & Product Lead, es el autor principal y responsable editorial de MaxVideoAI. Si otra persona escribe o revisa de manera sustancial una página, se la identificará en esa página.',
      },
      {
        id: 'sources',
        title: 'Cómo identificamos las fuentes',
        body:
          'Separamos la documentación de proveedores, la configuración del producto MaxVideoAI, las métricas de producción observadas y anonimizadas, y el criterio editorial de MaxVideoAI.',
        bullets: [
          'Las especificaciones de proveedores enlazan a la fuente del proveedor o del producto.',
          'Los tiempos observados describen el comportamiento móvil de producción, no un experimento controlado.',
          'Las puntuaciones editoriales son criterios de MaxVideoAI bajo la metodología publicada.',
        ],
      },
      {
        id: 'process',
        title: 'Antes de publicar',
        body:
          'Las afirmaciones importantes sobre el producto se comprueban con las rutas actuales, las fuentes, el comportamiento visible de precios y los controles disponibles antes de publicar o hacer una actualización sustancial.',
      },
      {
        id: 'corrections',
        title: 'Correcciones',
        body:
          'Envía correcciones factuales a support@maxvideoai.com con la URL de la página y una fuente de respaldo. Una corrección importante actualiza la página y su fecha de modificación sin cambiar la fecha de publicación original.',
      },
      {
        id: 'benchmarks',
        title: 'Actualizaciones de benchmarks',
        body:
          'Las definiciones, fórmulas, protocolos de prompts, reglas de latencia observada y cambios de metodología se versionan en Benchmark Lab. Las puntuaciones editoriales históricas no se presentan como ejecuciones documentadas del pack de prompts.',
      },
      {
        id: 'disclosure',
        title: 'Transparencia sobre el interés comercial',
        body:
          'MaxVideoAI comercializa el acceso a los modelos que compara. Declaramos esa relación comercial y separamos los datos con fuente, las métricas de producción observadas y el criterio editorial.',
      },
    ],
    links: { about: 'Acerca del responsable', benchmarks: 'Abrir Benchmark Lab', contact: 'Contactar a MaxVideoAI' },
  },
};

export function getEditorialStandardsCopy(locale: AppLocale): EditorialStandardsCopy {
  return COPY[locale] ?? COPY.en;
}
