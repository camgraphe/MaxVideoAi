import type { AppLocale } from '@/i18n/locales';

export const METADATA_COPY: Record<AppLocale, { title: string; description: string; imageAlt: string }> = {
  en: {
    title: 'Privacy Policy',
    description: 'How MaxVideoAI collects, uses, stores, and protects personal data.',
    imageAlt: 'Privacy Policy overview.',
  },
  fr: {
    title: 'Politique de confidentialité',
    description: 'Comment MaxVideoAI collecte, utilise, conserve et protège les données personnelles.',
    imageAlt: 'Aperçu de la politique de confidentialité.',
  },
  es: {
    title: 'Política de privacidad',
    description: 'Cómo MaxVideoAI recopila, utiliza, almacena y protege los datos personales.',
    imageAlt: 'Resumen de la política de privacidad.',
  },
};

export const HEADER_COPY: Record<AppLocale, { title: string; versionLabel: string; effectiveLabel: string; contactLabel: string }> = {
  en: {
    title: 'Privacy Policy',
    versionLabel: 'Version',
    effectiveLabel: 'Effective date',
    contactLabel: 'Contact:',
  },
  fr: {
    title: 'Politique de confidentialité',
    versionLabel: 'Version',
    effectiveLabel: "Date d’entrée en vigueur",
    contactLabel: 'Contact :',
  },
  es: {
    title: 'Política de privacidad',
    versionLabel: 'Versión',
    effectiveLabel: 'Fecha de entrada en vigor',
    contactLabel: 'Contacto:',
  },
};
