// Extracted unchanged from Studio timeline-frames.ts; parity is verified against that source.
export const MIN_CLIP_DURATION_SEC = 1;
export function secondsToTimelineFrame(seconds:number,fps:number):number { return Math.round(Math.max(0,seconds)*Math.max(1,fps)); }
export function timelineFrameToSeconds(frame:number,fps:number):number { return Math.round(Math.max(0,frame)/Math.max(1,fps)*1_000_000)/1_000_000; }
