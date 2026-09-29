import { EXAMPLE_OPENING_RATIO_TOLERANCE, getAspectRatioFromDimensions, getAspectRatioNumber } from '@/lib/aspect';
type FramedVideo = {id: string; aspectRatio?: string | null; outputWidth?: number | null; outputHeight?: number | null};
export function galleryVideoRatio(video: FramedVideo, fallback=16/9): number {
  const dimensions = getAspectRatioFromDimensions(video.outputWidth,video.outputHeight);
  return dimensions ? dimensions.width/dimensions.height : getAspectRatioNumber(video.aspectRatio,fallback);
}
/** Opening selection stays inside this page. The remaining sequence never changes. */
export function buildGalleryOpening<T extends FramedVideo>(videos: T[], enabled: boolean): {opening:T[];rest:T[]} {
  if(!enabled) return {opening:[],rest:videos};
  const opening:T[]=[];
  for(const ratio of [16/9,9/16,16/9,16/9]) {
    const item=videos.find(video=>!opening.includes(video)&&Math.abs(galleryVideoRatio(video,NaN)/ratio-1)<=EXAMPLE_OPENING_RATIO_TOLERANCE);
    if(!item) return {opening:[],rest:videos};
    opening.push(item);
  }
  const ids=new Set(opening.map(video=>video.id));
  return {opening,rest:videos.filter(video=>!ids.has(video.id))};
}
export function selectPreviewIds(ids: string[], visible: ReadonlySet<string>, intent: string|null, budget: number, paused: boolean): string[] {
  if(paused) return [];
  const eligible=ids.filter(id=>visible.has(id));
  return [...(intent&&eligible.includes(intent)?[intent]:[]),...eligible.filter(id=>id!==intent)].slice(0,budget);
}
