export type H3ReferenceCondition = {type:'image'|'video'|'audio';url:string};
/** Reference order is a complete permutation of owned modality slots, e.g. video1,image1.
 * No URLs enter through this scalar control. Provider reference_conditions and legacy lists
 * are mutually exclusive; start/end/middle frames remain separate conditioning inputs. */
export function orderedH3References(order: string | undefined, grouped: Record<'image'|'video'|'audio',string[]>): H3ReferenceCondition[] | undefined {
  if (!order?.trim()) return undefined;
  const slots = new Map<string,H3ReferenceCondition>();
  for (const type of ['image','video','audio'] as const) grouped[type].forEach((url,index)=>slots.set(`${type}${index+1}`,{type,url}));
  const keys = order.split(',').map(key=>key.trim().toLowerCase());
  if (keys.length!==slots.size || keys.length>12 || new Set(keys).size!==keys.length || keys.some(key=>!slots.has(key))) throw new Error('Reference order must list every reference exactly once, such as video1,image1,audio1.');
  return keys.map(key=>slots.get(key)!);
}
export function validateH3MiddleFrame(input:{mode:string;start?:string;end?:string;middle?:string;time?:number;duration:number;resolution:string}): void {
  if (!input.middle && input.time===undefined) return;
  if (input.mode!=='ref2v' || !input.start || !input.end || !input.middle || !['480P','768P'].includes(input.resolution)) throw new Error('Middle frame requires reference mode, start and end frames, and native 480P or 768P resolution.');
  const index=Math.round((input.time??NaN)*24), last=Math.round(input.duration*24)-1;
  if (!Number.isFinite(input.time) || input.time!<=0 || input.time!>=input.duration || index<=0 || index>=last) throw new Error('Middle frame time must round strictly between the first and last requested frames at 24 fps.');
}
