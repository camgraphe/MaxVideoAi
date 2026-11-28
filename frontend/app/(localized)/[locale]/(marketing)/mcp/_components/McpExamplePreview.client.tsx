'use client';

import Image from 'next/image';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  kind: 'video' | 'image' | 'audio';
  src: string;
  poster: string;
  captions?: string;
  title: string;
  alt: string;
  close: string;
};

export function McpExamplePreview({ children, kind, src, poster, captions, title, alt, close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  function openPreview(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.current?.showModal) return;
    event.preventDefault();
    setOpen(true);
    dialog.current.showModal();
  }
  return <>
    <a href={src} onClick={openPreview}>{children}</a>
    <dialog ref={dialog} className="hub-media-dialog" aria-label={title} onClose={() => setOpen(false)} onClick={event => {
      if (event.target === dialog.current) dialog.current?.close();
    }}>
      <div className="hub-dialog-panel">
        <div className="hub-dialog-bar"><h3>{title}</h3><button type="button" onClick={() => dialog.current?.close()}>{close} ×</button></div>
        {open && (kind === 'video'
          ? <video aria-label={title} src={src} poster={poster} controls playsInline autoPlay>{captions && <track kind="captions" src={captions} srcLang="en" label="English"/>}</video>
          : kind === 'audio' ? <audio aria-label={title} controls autoPlay src={src}/> : <Image src={src} alt={alt} width={960} height={540} sizes="85vw"/>)}
      </div>
    </dialog>
  </>;
}
