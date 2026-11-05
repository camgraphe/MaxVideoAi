import type {AppLocale} from '@/i18n/locales';
import {listNano21EditorialImages} from '@/lib/nano21-editorial-images';
import {listGpt26EditorialImages,gpt26EditorialSources,type Gpt26EditorialImage} from '@/lib/gpt26-editorial-images';
import type {ModelExamplesContent} from './model-page-examples-content';

type EditorialFile={url:string;sha256:string;width:number;height:number};
export type ModelEditorialImage={
 id:string;engineId:string;title:string;prompt:string;original:EditorialFile;display:EditorialFile;
 metadataLabel:string;workspaceHref:string;videoModelSlug?:string;
 source?:{label:string;original:EditorialFile};
};
const copy={
 en:{source:'Shared source',created:'Generation',edited:'Edit',planning:'Planning'},
 fr:{source:'Source commune',created:'Génération',edited:'Retouche',planning:'Planification'},
 es:{source:'Origen común',created:'Generación',edited:'Edición',planning:'Planificación'},
};
const label=(id:string)=>`GPT Image 2.6 ${id.endsWith('flare')?'Flare':'Sunburst'}`;

export function toGpt26EditorialImages(images:readonly Gpt26EditorialImage[],locale:AppLocale,titles:ModelExamplesContent['editorialImages'],sources:readonly Gpt26EditorialImage[]=images):ModelEditorialImage[]{
 const text=copy[locale];
 return images.map(image=>{
  const source=image.sourceImageId?sources.find(candidate=>candidate.id===image.sourceImageId):null;
  if(image.sourceImageId&&!source)throw new Error('Missing public edit source');
  const title=titles?.find(item=>item.id===image.id)?.title;
  if(!title)throw new Error('Missing localized editorial image title');
  return {id:image.id,engineId:image.engineId,title,prompt:image.prompt,
   original:image.original,display:image.display,workspaceHref:`/app/image?engine=${image.engineId}`,
   metadataLabel:`${label(image.engineId)} · ${image.settings.mode==='t2i'?text.created:text.edited} · 1024×1024 · HIGH · ${text.planning}: HIGH`,
   ...(source?{source:{label:`${text.source} · ${label(source.engineId)}`,original:source.original}}:{}),
  };
 });
}

export function listModelEditorialImages(engineId:string,locale:AppLocale,titles?:ModelExamplesContent['editorialImages']):ModelEditorialImage[]{
 const nano=listNano21EditorialImages(engineId);
 if(nano.length)return nano.map(image=>({...image,metadataLabel:'Nano Banana 2.1 · 1K · 16:9 · MEDIUM',workspaceHref:'/app/image?engine=nano-banana-2-1',videoModelSlug:'kling-v4'}));
 const images=listGpt26EditorialImages(engineId);
 return images.length?toGpt26EditorialImages(images,locale,titles,gpt26EditorialSources()):[];
}
