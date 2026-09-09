'use client';

import { useSearchParams } from 'next/navigation';
import { buildAuthReturnTarget, buildLoginHref } from '@/lib/auth-entry-href';
import Image from 'next/image';
import Link from 'next/link';
import { Film, GitBranch, LockKeyhole, Scissors, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import styles from './studio-preview-access.module.css';

const ENGLISH_COPY = {
  eyebrow: 'Studio beta',
  title: 'Your story, from first idea to final cut.',
  body: 'Connect ideas, generations and media on a visual canvas, then assemble every shot on the timeline.',
  status: 'Access by invitation',
  note: 'The beta is opening gradually. Studio will unlock here as soon as your account is invited.',
  tools: 'Explore creative tools',
  canvas: 'Canvas',
  preview: 'Preview',
  timeline: 'Timeline',
  plan: 'Plan',
  planBody: 'Arrange shots and their dependencies.',
  create: 'Generate',
  createBody: 'Create with MaxVideoAI models.',
  edit: 'Edit',
  editBody: 'Assemble image, video and sound.',
};

const FRENCH_COPY = {
  eyebrow: 'Studio bêta',
  title: 'Votre histoire, de la première idée au montage final.',
  body: 'Reliez vos idées, vos générations et vos médias sur un canevas visuel, puis assemblez chaque plan sur la timeline.',
  status: 'Accès sur invitation',
  note: 'La bêta s’ouvre progressivement. Studio apparaîtra ici dès que votre compte sera invité.',
  tools: 'Explorer les outils',
  canvas: 'Canevas',
  preview: 'Aperçu',
  timeline: 'Timeline',
  plan: 'Structurer',
  planBody: 'Organisez les plans et leurs dépendances.',
  create: 'Générer',
  createBody: 'Créez avec les modèles MaxVideoAI.',
  edit: 'Monter',
  editBody: 'Assemblez image, vidéo et son.',
};

const SPANISH_COPY = {
  eyebrow: 'Studio beta',
  title: 'Tu historia, desde la primera idea hasta el montaje final.',
  body: 'Conecta ideas, generaciones y medios en un lienzo visual y monta cada plano en la línea de tiempo.',
  status: 'Acceso por invitación',
  note: 'La beta se abre gradualmente. Studio aparecerá aquí cuando tu cuenta reciba acceso.',
  tools: 'Explorar herramientas',
  canvas: 'Lienzo',
  preview: 'Vista previa',
  timeline: 'Línea de tiempo',
  plan: 'Planificar',
  planBody: 'Organiza los planos y sus dependencias.',
  create: 'Generar',
  createBody: 'Crea con los modelos de MaxVideoAI.',
  edit: 'Editar',
  editBody: 'Combina imagen, vídeo y sonido.',
};

export default function StudioPreviewAccess({ visitor = false }: { visitor?: boolean }) {
  const searchParams = useSearchParams();
  const nextPath = buildAuthReturnTarget('/app/studio/projects', searchParams);
  const { locale } = useI18n();
  const copy = locale === 'fr' ? FRENCH_COPY : locale === 'es' ? SPANISH_COPY : ENGLISH_COPY;

  return (
    <div className={styles.previewShell}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Sparkles aria-hidden />{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p className={styles.intro}>{copy.body}</p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/app" prefetch={false}>{locale === 'fr' ? 'Créer une vidéo' : locale === 'es' ? 'Crear un vídeo' : 'Create a video'}</Link>
            {visitor ? <Link href={buildLoginHref({ mode: 'signin', nextPath })} prefetch={false}>{locale === 'fr' ? 'Déjà invité ? Se connecter' : locale === 'es' ? '¿Ya tienes invitación? Inicia sesión' : 'Already invited? Sign in'}</Link> : null}
          </div>
          <p className={styles.note}><LockKeyhole className="mr-1 inline h-3 w-3" aria-hidden />{copy.status}. {copy.note}</p>
        </div>

        <div className={styles.productPreview} aria-hidden>
          <div className={styles.previewTopbar}>
            <span><i />Studio</span>
            <span className={styles.previewTabs}><b>{copy.canvas}</b><b>{copy.preview}</b></span>
          </div>
          <div className={styles.previewBody}>
            <div className={styles.canvasPane}>
              <span className={`${styles.node} ${styles.nodePrompt}`}><Sparkles />Prompt</span>
              <span className={`${styles.node} ${styles.nodeImage}`}><Film />Shot 01</span>
              <span className={`${styles.node} ${styles.nodeVideo}`}><Film />Shot 02</span>
              <span className={styles.connectorOne} />
              <span className={styles.connectorTwo} />
            </div>
            <div className={styles.resultPane}>
              <Image
                src="/assets/studio/starters/cinematic-trailer.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 42vw, 300px"
              />
              <span>{copy.preview}</span>
            </div>
          </div>
          <div className={styles.timeline}>
            <span className={styles.timelineLabel}>{copy.timeline}</span>
            <div className={styles.timelineTrack}><i /><i /><i /></div>
            <div className={styles.audioTrack}><i /><i /></div>
          </div>
        </div>
      </section>

      <section className={styles.capabilities} aria-label={copy.eyebrow}>
        <article><GitBranch aria-hidden /><div><strong>{copy.plan}</strong><span>{copy.planBody}</span></div></article>
        <article><Sparkles aria-hidden /><div><strong>{copy.create}</strong><span>{copy.createBody}</span></div></article>
        <article><Scissors aria-hidden /><div><strong>{copy.edit}</strong><span>{copy.editBody}</span></div></article>
      </section>
    </div>
  );
}
