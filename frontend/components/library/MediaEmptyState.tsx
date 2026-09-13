import { AudioWaveform, Clapperboard, Images } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

type Props = { kind: 'image' | 'video' | 'audio'; locale: string; saved: boolean; onShowRenders: () => void };

/** A category can be empty even when this account has generated other media. */
export function MediaEmptyState({ kind, locale, saved, onShowRenders }: Props) {
  const copy = locale === 'fr' ? {
    title: 'Place à votre prochaine création',
    body: saved ? 'Aucun média enregistré dans cette catégorie. Importez un fichier ou retrouvez vos rendus.' : 'Vos rendus terminés dans cette catégorie apparaîtront ici.',
    create: { video: 'Créer une vidéo', image: 'Créer une image', audio: 'Créer un audio' }, renders: 'Voir les rendus',
  } : locale === 'es' ? {
    title: 'Espacio para tu próxima creación',
    body: saved ? 'No hay medios guardados en esta categoría. Importa un archivo o consulta tus resultados.' : 'Los resultados completados de esta categoría aparecerán aquí.',
    create: { video: 'Crear un vídeo', image: 'Crear una imagen', audio: 'Crear audio' }, renders: 'Ver resultados',
  } : {
    title: 'Room for your next creation',
    body: saved ? 'No saved media in this category. Import a file or find your completed renders.' : 'Your completed renders in this category will appear here.',
    create: { video: 'Create a video', image: 'Create an image', audio: 'Create audio' }, renders: 'View renders',
  };
  const Icon = kind === 'video' ? Clapperboard : kind === 'audio' ? AudioWaveform : Images;
  return <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-10 sm:py-16">
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-surface-2"><Icon className="h-9 w-9" aria-hidden /></div>
    <h2 className="text-xl font-semibold text-text-primary">{copy.title}</h2>
    <p className="max-w-sm text-sm text-text-secondary">{copy.body}</p>
    <ButtonLink href={kind === 'video' ? '/app' : `/app/${kind}`} prefetch={false}>{copy.create[kind]}</ButtonLink>
    {saved ? <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={onShowRenders}>{copy.renders}</button> : null}
  </section>;
}
