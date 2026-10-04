import React from 'react';
import {EditorialReader} from '@/components/editorial/EditorialReader';
import type {EditorialDraft} from '@/lib/editorial/schema';
export function EditorialArticle({draft,locale,articleId,version,mediaUrl}:{draft:EditorialDraft;locale:'en'|'fr'|'es';articleId:string;version:number;mediaUrl?:(id:string)=>string}){
 const label={en:'Version preview',fr:'Aperçu de version',es:'Vista previa de versión'}[locale];
 return <EditorialReader content={{article:draft.locales[locale],assets:draft.assets,sources:draft.sources}} locale={locale} mediaUrl={mediaUrl??(id=>`/api/admin/editorial/media/${articleId}/${id}?version=${version}`)} eyebrow={`MaxVideoAI · ${label}`}/>;
}
