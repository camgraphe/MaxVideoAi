import React from 'react';
import Image from 'next/image';
import type {PublicEditorialArticle} from '@/lib/editorial/public-article';
import {EditorialReader} from './EditorialReader';

export function PublicEditorialArticleView({article,byline}:{article:PublicEditorialArticle;byline?:React.ReactNode}){
 return <div data-editorial-digest={article.publication.digest}><EditorialReader content={article} locale={article.article.locale} eyebrow="MaxVideoAI · Creative workflows" byline={byline}
 mediaUrl={id=>article.assets.find(a=>a.id===id)!.url}
 renderImage={p=><Image src={p.src} alt={p.alt} width={p.width} height={p.height} priority={p.priority} fetchPriority={p.priority?'high':undefined} sizes="(min-width: 984px) 920px, (min-width: 701px) calc(100vw - 64px), calc(100vw - 36px)" style={{width:'100%',height:'auto',...p.style}}/>}/></div>;
}
