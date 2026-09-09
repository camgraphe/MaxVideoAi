'use client';

import { Clapperboard } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';

/** Activity contains owned generations; public examples stay in the creation feed. */
export function FirstCreationState() {
  const { locale } = useI18n();
  const copy = locale === 'fr'
    ? ['De l’idée à la première image', 'Partez d’une idée ou adaptez un exemple dans Video.', 'Créer une vidéo']
    : locale === 'es'
      ? ['De la idea al primer fotograma', 'Empieza con una idea o adapta un ejemplo en Video.', 'Crear un vídeo']
      : ['From idea to first frame', 'Start with an idea or adapt an example in Video.', 'Create a video'];
  return <div className="flex flex-col items-center gap-4 px-4 py-14 text-center">
    <Clapperboard className="h-10 w-10 text-text-muted" aria-hidden />
    <h2 className="text-xl font-semibold text-text-primary">{copy[0]}</h2>
    <p className="text-sm text-text-secondary">{copy[1]}</p>
    <ButtonLink href="/app" prefetch={false}>{copy[2]}</ButtonLink>
  </div>;
}
