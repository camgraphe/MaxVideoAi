import type { ExampleRecreationSettings } from './example-recreation';
export type ExampleComparisonQuote = {engineId:string;label:string;amountCents:number;currency:string;href:string;original:boolean};
export type ExampleWatchDetail = {
  id:string;title:string;prompt:string;videoUrl:string;posterUrl:string|null;engineLabel:string;
  watchHref:string;modelHref:string|null;recreateHref:string|null;aspectRatio:string;durationSec:number;hasAudio:boolean;
  historicalCost:{amountCents:number;currency:string}|null;
  scenario:ExampleRecreationSettings|null;quotes:ExampleComparisonQuote[];
  references:Array<{key:string;label:string;url:string;alt:string}>;
};
