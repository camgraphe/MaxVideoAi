import {z} from 'zod';

export const studioProjectNameSchema=z.string().trim().min(1).max(200).refine(value=>!/[\u0000-\u001f\u007f]/u.test(value),'Use a single line for the project name.');
export const normalizeStudioProjectName=(value:unknown)=>studioProjectNameSchema.parse(value);
const placeholders=new Set(['untitled project','new project','nouveau projet','projet sans titre','untitled']);
export const isUntitledStudioProject=(name:string)=>placeholders.has(name.trim().toLocaleLowerCase());

/** A local fallback: no model call, URLs or attachment identifiers in project lists. */
export function automaticStudioProjectTitle(message:string):string|null {
  let text=message.replace(/https?:\/\/\S+/giu,' ').replace(/@(?:image|video|audio|reference)\s*\d+/giu,' ')
    .replace(/[\u0000-\u001f\u007f]/gu,' ').replace(/\s+/gu,' ').trim();
  text=text.replace(/^(?:please\s+)?(?:create|make|generate)\s+(?:me\s+)?(?:an?\s+)?/iu,'')
    .replace(/^(?:je voudrais|j'aimerais|peux[- ]tu|pourrais[- ]tu)\s+/iu,'');
  const generic=/^(?:hello(?: there)?|hi(?: there)?|hey(?: there)?|bonjour(?: à tous)?|salut|hola|buenos d[ií]as|ok(?:ay)?(?:,?\s+go)?|go|oui|yes|imagine|merci(?: beaucoup)?|thanks|thank you|can you help me|peux[- ]tu m[’']aider|m[’']aider)$/iu;
  text=text.split(/[.!?](?:\s|$)/u).map(part=>part.trim().replace(/[.!?,;:]+$/u,'')).find(part=>part.length>=5&&!generic.test(part))??'';
  if(!text)return null;
  const words=text.split(' ');let title='';
  for(const word of words.slice(0,12)){const next=title?title+' '+word:word;if(next.length>80)break;title=next;}
  if(!title)return null;
  return title[0].toLocaleUpperCase()+title.slice(1);
}
