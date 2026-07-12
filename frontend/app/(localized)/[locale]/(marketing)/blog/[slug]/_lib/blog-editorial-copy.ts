import type { AppLocale } from '@/i18n/locales';

export type BlogEditorialCopy = {
  by: string;
  published: string;
  updated: string;
  aboutAuthor: string;
  standards: string;
};

const COPY: Record<AppLocale, BlogEditorialCopy> = {
  en: {
    by: 'By',
    published: 'Published',
    updated: 'Updated',
    aboutAuthor: 'About the author',
    standards: 'Editorial Standards',
  },
  fr: {
    by: 'Par',
    published: 'Publié le',
    updated: 'Mis à jour le',
    aboutAuthor: 'À propos de l’auteur',
    standards: 'Normes éditoriales',
  },
  es: {
    by: 'Por',
    published: 'Publicado',
    updated: 'Actualizado',
    aboutAuthor: 'Acerca del autor',
    standards: 'Estándares editoriales',
  },
};

export function getBlogEditorialCopy(locale: AppLocale): BlogEditorialCopy {
  return COPY[locale] ?? COPY.en;
}
