'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Link } from '@/i18n/navigation';
import type { Nano21EditorialImage } from '@/lib/nano21-editorial-images';

const ModelEditorialImagePreview=dynamic(()=>import('./ModelEditorialImagePreview.client').then(module=>module.ModelEditorialImagePreview),{ssr:false});

export function ModelEditorialImageGallery({images,title,intro,anchorId,workspaceLabel,afterGallery,videoWorkflowLabel}:{
  images:Nano21EditorialImage[];title:string;intro:string;anchorId:string;workspaceLabel:string|null;afterGallery?:string|null;videoWorkflowLabel?:string|null;
}){
  const [selected,setSelected]=useState<Nano21EditorialImage|null>(null);
  return <section id={anchorId} className="scroll-mt-24 space-y-5">
    <div id="examples">
      <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{intro}</p>
    </div>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {images.map(image=><button key={image.id} type="button" onClick={()=>setSelected(image)}
        aria-label={image.title} className="overflow-hidden rounded-xl border border-hairline bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Image src={image.display.url} width={image.display.width} height={image.display.height} alt={image.title}
          sizes="(min-width: 1280px) 640px, (min-width: 768px) 45vw, 95vw" loading="lazy" className="h-auto w-full object-contain"/>
        <span className="block px-4 py-3 text-xs text-text-secondary">Nano Banana 2.1 · 1K · 16:9 · MEDIUM</span>
      </button>)}
    </div>
    {afterGallery?<p className="max-w-3xl text-sm leading-6 text-text-secondary">{afterGallery}</p>:null}
    {workspaceLabel?<Link href="/app/image?engine=nano-banana-2-1" prefetch={false} className="inline-flex rounded-xl border border-hairline px-4 py-3 text-sm font-semibold text-text-primary">{workspaceLabel}</Link>:null}
    {videoWorkflowLabel?<p><Link href={{pathname:'/models/[slug]',params:{slug:'kling-v4'}}} prefetch={false} className="text-sm font-semibold text-text-primary underline underline-offset-4">{videoWorkflowLabel}</Link></p>:null}
    {selected?<ModelEditorialImagePreview image={selected} onClose={()=>setSelected(null)}/>:null}
  </section>;
}
