import type { AppLocale } from '@/i18n/locales';

type CompanyResourceLink = { href: string; label: string; description: string };

export type CompanyCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string };
  resources: Array<{ title: string; links: CompanyResourceLink[] }>;
  rights: {
    eyebrow: string;
    title: string;
    uploads: string;
    outputs: string;
    commercialUse: string;
    privacy: string;
    legalCta: string;
    privacyCta: string;
  };
};

const COPY: Record<AppLocale, CompanyCopy> = {
  en: {
    meta: {
      title: 'Company & Trust — MaxVideoAI',
      description: 'Find MaxVideoAI company, editorial, operational, content-rights, privacy, and legal resources.',
    },
    hero: {
      eyebrow: 'Company & Trust',
      title: 'The people, standards, and policies behind MaxVideoAI.',
      intro:
        'Use this hub to understand who maintains the product, how editorial research is handled, where to check operations, and which terms apply to your content.',
    },
    resources: [
      {
        title: 'People & editorial',
        links: [
          { href: '/about', label: 'About', description: 'Meet the founder and understand what MaxVideoAI builds.' },
          { href: '/editorial-standards', label: 'Editorial Standards', description: 'Authorship, sources, corrections, and benchmark updates.' },
          { href: '/benchmarks', label: 'Benchmark Lab', description: 'Editorial scores, sourced specifications, observed speed, and methodology.' },
        ],
      },
      {
        title: 'Product operations',
        links: [
          { href: '/docs', label: 'Docs', description: 'Product onboarding and practical references.' },
          { href: '/workflows', label: 'Workflows', description: 'How MaxVideoAI production flows are structured.' },
          { href: '/status', label: 'Status', description: 'Current service notices and support guidance.' },
          { href: '/changelog', label: 'Changelog', description: 'Recent product, model, and workflow updates.' },
          { href: '/contact', label: 'Contact', description: 'Support, partnerships, and press requests.' },
        ],
      },
      {
        title: 'Legal & data',
        links: [
          { href: '/legal', label: 'Legal center', description: 'The index of current policies and notices.' },
          { href: '/legal/terms', label: 'Terms of Service', description: 'Accounts, generated media, acceptable use, and liability.' },
          { href: '/legal/privacy', label: 'Privacy Policy', description: 'Data categories, purposes, retention, and rights.' },
          { href: '/legal/subprocessors', label: 'Sub-processors', description: 'Providers involved in payments, hosting, storage, and inference.' },
          { href: '/return-policy', label: 'Refund & Return Policy', description: 'Refund and consumer-return information.' },
        ],
      },
    ],
    rights: {
      eyebrow: 'Content rights & data',
      title: 'Clear starting points for your content.',
      uploads: 'Your uploaded prompts and assets remain yours under the Terms.',
      outputs: 'Generated media remains yours, subject to the Terms.',
      commercialUse:
        'Users may use their generations commercially, subject to third-party rights, applicable laws, and any restrictions specific to the model or provider used.',
      privacy:
        'New renders are private by default. Provider processing and sub-processors are explained in our privacy resources.',
      legalCta: 'Review generated-media terms',
      privacyCta: 'Review privacy details',
    },
  },
  fr: {
    meta: {
      title: 'Entreprise & confiance — MaxVideoAI',
      description: 'Retrouvez les ressources MaxVideoAI sur l’entreprise, l’éditorial, les opérations, les droits, la confidentialité et le juridique.',
    },
    hero: {
      eyebrow: 'Entreprise & confiance',
      title: 'Les personnes, les normes et les politiques derrière MaxVideoAI.',
      intro:
        'Ce hub explique qui maintient le produit, comment la recherche éditoriale est conduite, où suivre les opérations et quelles conditions s’appliquent à vos contenus.',
    },
    resources: [
      {
        title: 'Personnes & éditorial',
        links: [
          { href: '/about', label: 'À propos', description: 'Découvrez le fondateur et ce que construit MaxVideoAI.' },
          { href: '/editorial-standards', label: 'Normes éditoriales', description: 'Auteurs, sources, corrections et mises à jour des benchmarks.' },
          { href: '/benchmarks', label: 'Benchmark Lab', description: 'Scores éditoriaux, spécifications sourcées, vitesse observée et méthodologie.' },
        ],
      },
      {
        title: 'Opérations produit',
        links: [
          { href: '/docs', label: 'Docs', description: 'Onboarding produit et références pratiques.' },
          { href: '/workflows', label: 'Workflows', description: 'Structure des flux de production MaxVideoAI.' },
          { href: '/status', label: 'Statut', description: 'Notifications de service actuelles et conseils support.' },
          { href: '/changelog', label: 'Changelog', description: 'Évolutions récentes du produit, des modèles et des workflows.' },
          { href: '/contact', label: 'Contact', description: 'Support, partenariats et demandes presse.' },
        ],
      },
      {
        title: 'Juridique & données',
        links: [
          { href: '/legal', label: 'Centre juridique', description: 'Index des politiques et notifications en vigueur.' },
          { href: '/legal/terms', label: 'Conditions d’utilisation', description: 'Comptes, médias générés, usage acceptable et responsabilité.' },
          { href: '/legal/privacy', label: 'Politique de confidentialité', description: 'Catégories de données, finalités, conservation et droits.' },
          { href: '/legal/subprocessors', label: 'Sous-traitants', description: 'Prestataires de paiement, hébergement, stockage et inférence.' },
          { href: '/return-policy', label: 'Politique de remboursement', description: 'Informations sur les remboursements et retours consommateurs.' },
        ],
      },
    ],
    rights: {
      eyebrow: 'Droits sur les contenus & données',
      title: 'Des repères clairs pour vos contenus.',
      uploads: 'Vos prompts et assets importés restent les vôtres conformément aux Conditions.',
      outputs: 'Les médias générés restent les vôtres, sous réserve des Conditions.',
      commercialUse:
        'Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.',
      privacy:
        'Les nouveaux rendus sont privés par défaut. Le traitement par les fournisseurs et les sous-traitants est expliqué dans nos ressources de confidentialité.',
      legalCta: 'Consulter les conditions sur les médias',
      privacyCta: 'Consulter la confidentialité',
    },
  },
  es: {
    meta: {
      title: 'Empresa y confianza — MaxVideoAI',
      description: 'Consulta los recursos de MaxVideoAI sobre empresa, edición, operaciones, derechos de contenido, privacidad y aspectos legales.',
    },
    hero: {
      eyebrow: 'Empresa y confianza',
      title: 'Las personas, los estándares y las políticas detrás de MaxVideoAI.',
      intro:
        'Este centro explica quién mantiene el producto, cómo se gestiona la investigación editorial, dónde revisar las operaciones y qué términos se aplican a tu contenido.',
    },
    resources: [
      {
        title: 'Personas y edición',
        links: [
          { href: '/about', label: 'Acerca de', description: 'Conoce al fundador y lo que desarrolla MaxVideoAI.' },
          { href: '/editorial-standards', label: 'Estándares editoriales', description: 'Autoría, fuentes, correcciones y actualizaciones de benchmarks.' },
          { href: '/benchmarks', label: 'Benchmark Lab', description: 'Puntuaciones editoriales, especificaciones con fuentes, velocidad observada y metodología.' },
        ],
      },
      {
        title: 'Operaciones del producto',
        links: [
          { href: '/docs', label: 'Docs', description: 'Incorporación al producto y referencias prácticas.' },
          { href: '/workflows', label: 'Flujos de trabajo', description: 'Cómo se estructuran los flujos de producción de MaxVideoAI.' },
          { href: '/status', label: 'Estado', description: 'Avisos actuales del servicio y orientación de soporte.' },
          { href: '/changelog', label: 'Changelog', description: 'Actualizaciones recientes del producto, los modelos y los flujos.' },
          { href: '/contact', label: 'Contacto', description: 'Soporte, alianzas y solicitudes de prensa.' },
        ],
      },
      {
        title: 'Aspectos legales y datos',
        links: [
          { href: '/legal', label: 'Centro legal', description: 'Índice de políticas y avisos vigentes.' },
          { href: '/legal/terms', label: 'Términos del servicio', description: 'Cuentas, medios generados, uso aceptable y responsabilidad.' },
          { href: '/legal/privacy', label: 'Política de privacidad', description: 'Categorías de datos, finalidades, retención y derechos.' },
          { href: '/legal/subprocessors', label: 'Subencargados', description: 'Proveedores de pagos, hosting, almacenamiento e inferencia.' },
          { href: '/return-policy', label: 'Política de reembolsos', description: 'Información sobre reembolsos y devoluciones del consumidor.' },
        ],
      },
    ],
    rights: {
      eyebrow: 'Derechos de contenido y datos',
      title: 'Puntos de partida claros para tu contenido.',
      uploads: 'Los prompts y recursos que subes siguen siendo tuyos conforme a los Términos.',
      outputs: 'Los medios generados siguen siendo tuyos, sujetos a los Términos.',
      commercialUse:
        'Los usuarios pueden usar comercialmente sus generaciones, siempre que respeten los derechos de terceros, las leyes aplicables y cualquier restricción específica del modelo o proveedor utilizado.',
      privacy:
        'Los nuevos renders son privados de forma predeterminada. El procesamiento de proveedores y los subencargados se explican en nuestros recursos de privacidad.',
      legalCta: 'Revisar términos de medios generados',
      privacyCta: 'Revisar detalles de privacidad',
    },
  },
};

export function getCompanyCopy(locale: AppLocale): CompanyCopy {
  return COPY[locale] ?? COPY.en;
}
