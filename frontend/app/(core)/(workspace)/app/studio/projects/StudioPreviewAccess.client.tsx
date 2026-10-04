'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildAuthReturnTarget, buildLoginHref } from '@/lib/auth-entry-href';
import Image from 'next/image';
import Link from 'next/link';
import { Film, GitBranch, Scissors, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import styles from './studio-preview-access.module.css';

const ENGLISH_COPY = {
  eyebrow: 'Studio public beta',
  title: 'Your story starts with a conversation.',
  body: 'Develop an idea with your references, review generation quotes and assemble your media on the timeline.',
  note: 'Sign in or create a MaxVideoAI account to open Studio. Timeline editing is available; MP4 export is not yet available during the public beta.',
  previewNote: 'Open Studio to continue with your account. Timeline editing is available; MP4 export is not yet available during the public beta.',
  unavailableTitle: 'Studio is unavailable right now.',
  unavailableNote: 'We could not open Studio for your account. Try again in a moment.',
  signIn: 'Sign in to Studio',
  open: 'Open Studio',
  retry: 'Try again',
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
  eyebrow: 'Studio bêta publique',
  title: 'Votre histoire commence par une conversation.',
  body: 'Développez une idée avec vos références, vérifiez les devis de génération et assemblez vos médias sur la timeline.',
  note: 'Connectez-vous ou créez un compte MaxVideoAI pour ouvrir Studio. Le montage est disponible ; l’export MP4 ne l’est pas encore pendant la bêta publique.',
  previewNote: 'Ouvrez Studio pour continuer avec votre compte. Le montage est disponible ; l’export MP4 ne l’est pas encore pendant la bêta publique.',
  unavailableTitle: 'Studio est indisponible pour le moment.',
  unavailableNote: 'Nous n’avons pas pu ouvrir Studio pour votre compte. Réessayez dans un instant.',
  signIn: 'Se connecter à Studio',
  open: 'Ouvrir Studio',
  retry: 'Réessayer',
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
  eyebrow: 'Studio beta pública',
  title: 'Tu historia empieza con una conversación.',
  body: 'Desarrolla una idea con tus referencias, revisa los presupuestos de generación y monta tus medios en la línea de tiempo.',
  note: 'Inicia sesión o crea una cuenta de MaxVideoAI para abrir Studio. La edición está disponible; la exportación MP4 aún no lo está durante la beta pública.',
  previewNote: 'Abre Studio para continuar con tu cuenta. La edición está disponible; la exportación MP4 aún no lo está durante la beta pública.',
  unavailableTitle: 'Studio no está disponible ahora mismo.',
  unavailableNote: 'No hemos podido abrir Studio para tu cuenta. Vuelve a intentarlo en un momento.',
  signIn: 'Iniciar sesión en Studio',
  open: 'Abrir Studio',
  retry: 'Reintentar',
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

export default function StudioPreviewAccess({ visitor = false, available = false }: { visitor?: boolean; available?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const continuationParams = new URLSearchParams(searchParams.toString());
  continuationParams.delete('preview');
  const nextPath = buildAuthReturnTarget(pathname ?? '/app/studio', continuationParams);
  const unavailable = !visitor && !available;
  const { locale } = useI18n();
  const copy = locale === 'fr' ? FRENCH_COPY : locale === 'es' ? SPANISH_COPY : ENGLISH_COPY;

  return (
    <div className={styles.previewShell}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Sparkles aria-hidden />{copy.eyebrow}</span>
          <h1>{unavailable ? copy.unavailableTitle : copy.title}</h1>
          <p className={styles.intro}>{copy.body}</p>
          <div className={styles.actions}>
            {unavailable ? (
              <button type="button" onClick={() => router.refresh()}>{copy.retry}</button>
            ) : (
              <Link href={visitor ? buildLoginHref({ mode: 'signin', nextPath }) : nextPath} prefetch={false}>{visitor ? copy.signIn : copy.open}</Link>
            )}
            <Link href="/app" prefetch={false}>{copy.tools}</Link>
          </div>
          <p className={styles.note}>{unavailable ? copy.unavailableNote : visitor ? copy.note : copy.previewNote}</p>
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
