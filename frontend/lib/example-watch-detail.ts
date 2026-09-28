import type { ExampleRecreationSettings } from './example-recreation';
export type ExampleComparisonQuote = {engineId:string;brandId?:string;label:string;amountCents:number;currency:string;href:string;original:boolean;settings:ExampleRecreationSettings;changed:Array<'durationSec'|'resolution'|'aspectRatio'|'audio'>};
export type ExampleWatchDetail = {
  id:string;title:string;prompt:string;videoUrl:string;posterUrl:string|null;engineLabel:string;
  watchHref:string;modelHref:string|null;recreateHref:string|null;aspectRatio:string;durationSec:number;hasAudio:boolean;
  historicalCost:{amountCents:number;currency:string}|null;
  scenario:ExampleRecreationSettings|null;quotes:ExampleComparisonQuote[];
  references:Array<{key:string;label:string;url:string;alt:string;thumbUrl?:string}>;
  context: {
    intro:string; visualContext:string|null; negativePrompt:string|null; createdAt:string;
    details:Array<{key:string;label:string;value:string}>; controls:Array<{key:string;label:string;value:string}>;
    highlights:string[]; notes:string[]; engineDescription:string; engineBadges:string[];
    compareLinks:Array<{href:string;label:string;reason:string}>;
    keyframes:{start?:string|null;middle?:string|null;end?:string|null}|null;
  };
};
