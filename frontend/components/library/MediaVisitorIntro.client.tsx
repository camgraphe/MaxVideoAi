'use client';
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/Button';
import { buildLoginHref } from '@/lib/auth-entry-href';

export function MediaVisitorIntro({ locale, nextPath }: { locale: string; nextPath: string }) {
  const copy = locale === 'fr'
    ? ['Vos créations, prêtes pour la suite', 'Retrouvez vos images, vidéos et sons. Réutilisez-les dans votre prochaine création.', 'Créer une vidéo', 'Se connecter à mes médias', 'Aperçu · exemples de projets']
    : locale === 'es'
      ? ['Tus creaciones, listas para lo que sigue', 'Reúne imágenes, vídeos y sonidos. Reutilízalos en tu próxima creación.', 'Crear un vídeo', 'Ver mis medios', 'Vista previa · ejemplos de proyectos']
      : ['Your creations, ready for what’s next', 'Keep images, videos and sound together. Reuse them in your next creation.', 'Create a video', 'Sign in to my media', 'Preview · example projects'];
  return <section className="mx-auto max-w-3xl py-6 sm:py-12">
    <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{copy[0]}</h1>
    <p className="mt-4 max-w-lg text-sm text-text-secondary">{copy[1]}</p>
    <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-4" aria-hidden>
      {['cinematic-trailer', 'product-ad', 'storyboard-to-video'].map(name => <div key={name} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
        <Image src={`/assets/studio/starters/${name}.webp`} alt="" fill sizes="(max-width: 767px) 30vw, 240px" className="object-cover" />
      </div>)}
    </div>
    <p className="mt-2 text-xs text-text-muted">{copy[4]}</p>
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <ButtonLink href="/app" prefetch={false}>{copy[2]}</ButtonLink>
      <ButtonLink href={buildLoginHref({ mode: 'signin', nextPath })} variant="ghost">{copy[3]}</ButtonLink>
    </div>
  </section>;
}
