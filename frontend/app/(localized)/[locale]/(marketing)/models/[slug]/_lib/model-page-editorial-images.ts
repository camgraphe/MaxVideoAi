import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {AppLocale} from '@/i18n/locales';
import klingEditorialRecords from '@/config/model-kling-image-v4-editorial-images.json';
import {listNano21EditorialImages} from '@/lib/nano21-editorial-images';
import {listGpt26EditorialImages,gpt26EditorialSources,type Gpt26EditorialImage} from '@/lib/gpt26-editorial-images';
import {listSeedreamEditorialImages} from '@/lib/seedream-editorial-images';
import { getImageEditorialPreset } from '@/lib/image/editorial-presets';
import { KLING_IMAGE_V4_ID } from '@/lib/image/kling-image-v4';
import type {ModelExamplesContent} from './model-page-examples-content';

type EditorialFile={url:string;sha256:string;width:number;height:number};
export type ModelEditorialImage={
 id:string;engineId:string;title:string;prompt:string;original:EditorialFile;display:EditorialFile;
 metadataLabel:string;workspaceHref:string;videoModelSlug?:string;
 alphaVerified?:boolean;
 illustrative?:boolean;
 source?:{label:string;original:EditorialFile};
};
const copy={
 en:{source:'Shared source',created:'Generation',edited:'Edit',planning:'Planning'},
 fr:{source:'Source commune',created:'Génération',edited:'Retouche',planning:'Planification'},
 es:{source:'Origen común',created:'Generación',edited:'Edición',planning:'Planificación'},
};
const label=(id:string)=>`GPT Image 2.6 ${id.endsWith('flare')?'Flare':'Sunburst'}`;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const klingFile = z.object({
  url: z.string().regex(/^\/assets\/model-examples\/kling-image-v4\/[a-f0-9]{64}\.(?:png|jpg|webp)$/),
  sha256: digest,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();
const klingRecord = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1),
  engineId: z.literal(KLING_IMAGE_V4_ID),
  settings: z.object({
    mode: z.enum(['t2i', 'i2i']),
    resolution: z.enum(['2K', '4K', '8K']),
    aspectRatio: z.string().min(1),
    quantity: z.number().int().min(1).max(10),
  }).strict(),
  promptSha256: digest,
  requestSha256: digest,
  receiptSha256: digest,
  sourceImageId: z.string().optional(),
  sourceOriginalSha256: digest.optional(),
  original: klingFile,
  display: klingFile.extend({ sourceSha256: digest }).strict(),
}).strict();

function listKlingEditorialImages(locale: AppLocale, titles: ModelExamplesContent['editorialImages']): ModelEditorialImage[] {
  const records = z.array(klingRecord).parse(klingEditorialRecords);
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('Duplicate Kling editorial image');
  return records.map(record => {
    const title = titles?.find(item => item.id === record.id)?.title;
    const preset = getImageEditorialPreset(record.engineId, record.recipeId);
    const { settings, original, display } = record;
    if (!preset || !title) throw new Error('Kling editorial image needs its exact recipe and localized title');
    const prompt = preset.snapshot.prompt;
    const quote = preset.quoteInput;
    if (createHash('sha256').update(prompt).digest('hex') !== record.promptSha256 ||
      quote.mode !== settings.mode || quote.resolution !== settings.resolution ||
      quote.aspectRatio !== settings.aspectRatio || quote.quantity !== settings.quantity) {
      throw new Error('Kling editorial image differs from the reviewed prompt or settings');
    }
    if (!original.url.includes(`/${original.sha256}.`) || !display.url.endsWith(`/${display.sha256}.webp`) ||
      display.sourceSha256 !== original.sha256) throw new Error('Kling image display needs its exact original');
    const source = records.find(item => item.id === record.sourceImageId);
    if (settings.mode === 'i2i'
      ? (!source || source.id === record.id || source.original.sha256 !== record.sourceOriginalSha256)
      : (record.sourceImageId || record.sourceOriginalSha256)) throw new Error('Kling image edit needs its exact source');
    const number = new Intl.NumberFormat(locale);
    const dimensions = `${number.format(original.width)} × ${number.format(original.height)} px`;
    return {
      id: record.id, engineId: record.engineId, title, prompt, original, display,
      metadataLabel: `Kling Image 4.0 · ${settings.resolution} · ${settings.aspectRatio} · ${dimensions}`,
      workspaceHref: `/app/image?engine=${record.engineId}`,
      ...(source ? { source: { label: copy[locale].source, original: source.original } } : {}),
    };
  });
}

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
 if(engineId===KLING_IMAGE_V4_ID)return listKlingEditorialImages(locale,titles);
 const seedream=listSeedreamEditorialImages(engineId);
 if(seedream.length)return seedream.map(image=>{
  const title=titles?.find(item=>item.id===image.id)?.title;
  if(!title)throw new Error('Missing localized Seedream editorial image title');
  const modelLabel=engineId==='seedream-5-5'?'Seedream 5.5':engineId==='seedream-5-0-flash'?'Seedream 5.0 Flash':'Seedream 5.0 Pro';
  const source=image.sourceImageId?seedream.find(candidate=>candidate.id===image.sourceImageId):null;
  return {...image,title,metadataLabel:`${modelLabel} · ${image.settings.mode==='i2i'?copy[locale].edited:copy[locale].created} · ${image.settings.resolution} · ${image.settings.aspectRatio} · ${image.settings.outputFormat.toUpperCase()}`,
   ...(source?{source:{label:copy[locale].source,original:source.original}}:{}),
   workspaceHref:`/app/image?engine=${engineId}`,videoModelSlug:'seedance-2-5'};
 });
 const nano=listNano21EditorialImages(engineId);
 if(nano.length)return nano.map(image=>({...image,metadataLabel:'Nano Banana 2.1 · 1K · 16:9 · MEDIUM',workspaceHref:'/app/image?engine=nano-banana-2-1',videoModelSlug:'kling-v4'}));
 const images=listGpt26EditorialImages(engineId);
 return images.length?toGpt26EditorialImages(images,locale,titles,gpt26EditorialSources()):[];
}
