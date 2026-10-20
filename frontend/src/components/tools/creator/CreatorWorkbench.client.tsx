'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Image as ImageIcon, Lightbulb } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { CreatorArtwork } from '../creator-marketing/CreatorArtwork';
import { creatorExperienceCopy, type CreatorExperienceId } from './creator-experience-copy';
import styles from './creator-workspace.module.css';

export function CreatorWorkbench({ locale, toolId, title, activeStep, source, settings, preview, recent, children }: {
  locale: string; toolId: CreatorExperienceId; title: string; activeStep: number;
  source: ReactNode; settings: ReactNode; preview: ReactNode; recent?: ReactNode; children?: ReactNode;
}) {
  const copy = creatorExperienceCopy(locale);
  const steps = toolId === 'subtitles' ? [copy.importStep, copy.editStep, copy.exportStep] : [copy.input, copy.direction, copy.result];
  return <div className="flex min-h-screen flex-col bg-bg"><HeaderBar />
    <div className="flex min-w-0 flex-1 flex-col md:flex-row"><AppSidebar />
      <main className="app-scroll-surface min-w-0 flex-1 overflow-y-auto">
        <div className={styles.workbench}>
          <header className={styles.header}>
            <Link href="/app/tools" prefetch={false}><ArrowLeft size={16} aria-hidden="true" />{copy.back}</Link>
            <h1>{title}</h1><p>{copy.descriptions[toolId]}</p>
            <ol className={styles.steps} aria-label={title}>{steps.map((step,index) => <li key={step} aria-current={activeStep === index ? 'step' : undefined} data-complete={activeStep > index}>
              <span aria-hidden="true">{activeStep > index ? <Check size={16} /> : index + 1}</span>{step}
            </li>)}</ol>
          </header>
          {children}
          <div className={styles.workbenchLayout}>
            <section className={styles.sourcePanel}>{source}</section>
            <section className={styles.previewPanel}>{preview}</section>
            <section className={styles.settingsPanel}>{settings}</section>
          </div>
          {recent ? <section className={styles.recent}>{recent}</section> : null}
        </div>
      </main>
    </div>
  </div>;
}

export function CreatorInspiration({ locale, toolId }: {locale:string;toolId:CreatorExperienceId}) {
  const copy = creatorExperienceCopy(locale);
  return <div className={styles.inspiration}>
    <div className={styles.inspirationHeading}><span><Lightbulb size={17} aria-hidden="true" />{copy.inspiration}</span><span><ImageIcon size={16} aria-hidden="true" />{copy.presentation}</span></div>
    <CreatorArtwork id={toolId} alt={`${copy.presentation} — ${copy.headlines[toolId]}`} priority className={styles.artwork} sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 60vw, 65vw" />
    <div className={styles.inspirationCaption}><h2>{copy.headlines[toolId]}</h2><p>{copy.artHints[toolId]}</p></div>
  </div>;
}
