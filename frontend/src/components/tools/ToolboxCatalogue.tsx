'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';
import { TOOLBOX, type ToolMediaKind } from '@/lib/toolbox/catalogue';
import { ToolboxScene } from './ToolboxScene';
import { toolboxCopy, type ToolboxVisualId } from './toolbox-copy';
import styles from './tools-catalogue.module.css';

/** Capability projection shared with embedded tool choosers. */
export function ToolboxCatalogue({ locale, mediaKind, onSelect }: { locale: string; mediaKind?: ToolMediaKind; onSelect?: (id: string, kind?: ToolMediaKind) => void }) {
  const [filter, setFilter] = useState<ToolMediaKind | 'all'>(mediaKind ?? 'all');
  const copy = toolboxCopy(locale);
  const id = useId();
  const quick = TOOLBOX.filter(tool => tool.group === 'quick').flatMap(tool => tool.inputKinds.map(kind => ({ ...tool, mediaKind: kind, visual: (tool.id === 'upscale' ? `upscale-${kind}` : tool.id) as ToolboxVisualId }))).filter(tool => filter === 'all' || tool.mediaKind === filter);
  const workshops = TOOLBOX.filter(tool => tool.group === 'workshop' && (filter === 'all' || tool.inputKinds.includes(filter)));
  return <div className={styles.catalogue}>
    <header className={styles.heading}><h1>{copy.title}</h1></header>
    <div className={styles.sectionBar}><h2>{copy.quick}</h2><div className={styles.filters} aria-label={copy.all}>
      {(['all', 'image', 'video', 'audio'] as const).map(kind => <button type="button" key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{copy[kind]}</button>)}
    </div></div>
    {quick.length ? <ul className={styles.quickGrid}>{quick.map(tool => {
      const text = copy.tools[tool.visual];
      const content = <><div className={styles.quickArt}><ToolboxScene kind={tool.visual} /></div><div className={styles.quickCaption}><h3>{text.title}</h3></div></>;
      return <li key={tool.visual}>{onSelect ? <button type="button" className={styles.quickTool} onClick={() => onSelect(tool.id, tool.mediaKind)}>{content}</button> : <Link prefetch={false} className={styles.quickTool} href={`${tool.href}${tool.id === 'upscale' ? `?kind=${tool.mediaKind}` : ''}`} aria-label={`${text.title} — ${copy.open}`}>{content}</Link>}</li>;
    })}</ul> : <div className={styles.empty}><span aria-hidden="true" className={styles.sound}>▂ ▅ ▃ ▇ ▄ ▆ ▂</span><h3>{copy.noAudio}</h3><Link href="/app/audio" prefetch={false}>{copy.audioOpen} <span aria-hidden="true">↗</span></Link></div>}
    {workshops.length > 0 ? <section className={styles.workshopSection} aria-labelledby={`${id}-workshops`}>
      <div className={styles.sectionBar}><h2 id={`${id}-workshops`}>{copy.workshops}</h2></div>
      <ul className={styles.workshopGrid}>{workshops.map(tool => {
        const text = copy.tools[tool.id as ToolboxVisualId];
        return <li key={tool.id}><Link prefetch={false} href={tool.href} className={styles.workshop}>
          <div className={`${styles.workshopArt} ${tool.id === 'angle' ? styles.angleArt : ''}`}>
            {tool.id === 'storyboard' ? <ToolboxScene kind="storyboard" /> : tool.id === 'character-builder' ? <Image src="/assets/blog/character-builder/consistent-character-eight-panel-sheet.webp" alt="" fill sizes="(max-width: 700px) 90vw, 30vw" loading="lazy" /> : <><div className={styles.angleImage}><Image src="/assets/tools/angle-orbit-product-source.webp" alt="" fill sizes="(max-width: 700px) 45vw, 15vw" loading="lazy" /></div><div className={styles.angleImage}><Image src="/assets/tools/angle-orbit-product-45.webp" alt="" fill sizes="(max-width: 700px) 45vw, 15vw" loading="lazy" /></div><span className={styles.orbit} aria-hidden="true">↻</span></>}
          </div>
          <div className={styles.workshopCaption}><h3>{text.title}<span aria-hidden="true">↗</span></h3></div>
        </Link></li>;
      })}</ul>
    </section> : null}
  </div>;
}
