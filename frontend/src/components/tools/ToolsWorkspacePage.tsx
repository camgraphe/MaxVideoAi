'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ToolCatalogueIllustration } from './ToolCatalogueIllustration';
import styles from './tools-catalogue.module.css';

const DEFAULT_TOOLS_COPY = {
  "disabledTitle": "Tools are unavailable",
  "disabledBody": "Please check back later.",
  "eyebrow": "Workspace",
  "title": "Tools",
  "subtitle": "Prepare references. Refine your images and videos.",
  "characterEyebrow": "Character consistency",
  "characterTitle": "Character Builder",
  "characterBody": "Create a consistent character across eight views.",
  "characterBadge": "Image",
  "storyboardEyebrow": "Reference boards",
  "storyboardTitle": "Storyboard",
  "storyboardBody": "Turn an idea into a visual shot sequence.",
  "storyboardBadge": "Image",
  "angleEyebrow": "Perspective control",
  "angleTitle": "Angle / Perspective",
  "angleBody": "Explore a new camera angle from one image.",
  "angleBadge": "Image",
  "open": "Open",
  "backgroundRemovalEyebrow": "Video cleanup",
  "backgroundRemovalTitle": "Background Removal",
  "backgroundRemovalBody": "Isolate a subject from its video background.",
  "backgroundRemovalBadge": "Video",
  "upscaleEyebrow": "Resolution boost",
  "upscaleTitle": "Upscale",
  "upscaleBody": "Increase the resolution of images and videos.",
  "upscaleBadge": "Image + video"
} as const;

const TOOLS = [
  { key: 'character', href: '/app/tools/character-builder', covers: ['/assets/blog/character-builder/consistent-character-eight-panel-sheet.webp'] },
  { key: 'storyboard', href: '/app/tools/storyboard', illustration: 'storyboard' },
  { key: 'angle', href: '/app/tools/angle', covers: ['/assets/tools/angle-orbit-product-source.webp', '/assets/tools/angle-orbit-product-45.webp'] },
  { key: 'upscale', href: '/app/tools/upscale', illustration: 'upscale' },
  { key: 'backgroundRemoval', href: '/app/tools/background-removal', covers: ['/assets/tools/background-removal-product-cutout.webp'] },
] as const;

export default function ToolsPage() {
  const { loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const copy = {
    ...DEFAULT_TOOLS_COPY,
    ...((t('workspace.tools') ?? {}) as Partial<typeof DEFAULT_TOOLS_COPY>),
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className={`${styles.catalogue} app-scroll-surface overflow-y-auto`} aria-busy={authLoading}>
          <header className={styles.heading}>
            <h1>{!authLoading && !FEATURES.workflows.toolsSection ? copy.disabledTitle : copy.title}</h1>
            <p>{!authLoading && !FEATURES.workflows.toolsSection ? copy.disabledBody : copy.subtitle}</p>
          </header>
          {authLoading ? (
            <div className={styles.grid} aria-hidden="true">
              {TOOLS.map(({ key }) => <div key={key} className={styles.skeleton} />)}
            </div>
          ) : FEATURES.workflows.toolsSection ? (
            <ul className={styles.grid}>
              {TOOLS.map((tool) => (
                <li key={tool.key} className={styles.item}>
                  <Link href={tool.href} prefetch={false} className={styles.tool} aria-labelledby={`${tool.key}-title ${tool.key}-open`}>
                    <div className={`${styles.cover} ${'covers' in tool && tool.covers.length > 1 ? styles.pair : ''}`}>
                      {'covers' in tool ? tool.covers.map((src) => (
                        <div key={src} className={styles.image}>
                          <Image src={src} alt="" fill loading="lazy" sizes={tool.covers.length > 1 ? '(max-width: 640px) 46vw, (max-width: 1050px) 22vw, 15vw' : '(max-width: 640px) 92vw, (max-width: 1050px) 44vw, 30vw'} />
                        </div>
                      )) : <ToolCatalogueIllustration kind={tool.illustration} />}
                    </div>
                    <div className={styles.caption}>
                      <div className={styles.titleRow}>
                        <h2 id={`${tool.key}-title`}>{copy[`${tool.key}Title`]}</h2>
                        <span className={styles.kind}>{copy[`${tool.key}Badge`]}</span>
                      </div>
                      <p>{copy[`${tool.key}Body`]}</p>
                      <span className={styles.open} id={`${tool.key}-open`}>{copy.open}<span aria-hidden="true">→</span></span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </main>
      </div>
    </div>
  );
}
