import type {EngineModeDurationCaps} from '@/types/engines';

/** Choose an allowed output length independently of the measured, billable original. */
export function editOutputSeconds(duration: EngineModeDurationCaps | undefined, max: number, source: number | null) {
  if (!duration) return undefined;
  const target = source && Number.isFinite(source) ? source : Number(duration.default);
  if ('options' in duration) {
    const allowed = duration.options.map(Number).filter(value=>Number.isInteger(value) && value>0);
    if (!allowed.length) return undefined;
    return allowed.reduce((best,value)=>Math.abs(value-target)<Math.abs(best-target)?value:best,allowed[0]);
  }
  if (!Number.isFinite(target)) return undefined;
  return Math.max(duration.min, Math.min(max, Math.round(target)));
}

/** Keep the source framing if the model offers it. Otherwise let it inherit or adapt. */
export function editSourceAspect(values:readonly string[],width:number|null,height:number|null) {
  if (width && height) {
    const exact=values.find(value=>{
      if (!/^\d+:\d+$/.test(value)) return false;
      const [w,h]=value.split(':').map(Number);
      return Math.abs(width/height-w/h)<0.001;
    });
    if (exact) return exact;
  }
  return values.includes('auto') ? 'auto' : undefined;
}
