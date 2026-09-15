export const clamp = (v, lo=0, hi=1) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const ease = t => {t=clamp(t);return t*t*(3-2*t);};
export const phase = (p,a,b) => ease((p-a)/(b-a));
export const mix = (a,b,t) => a+(b-a)*t;
export function sampleTimeline(value,mobile=false){
 const p=clamp(value),open=phase(p,0,.23),emerge=phase(p,.20,.46),assemble=phase(p,.43,.73),orbit=phase(p,.73,1);
 return {p,act:p<.24?0:p<.45?1:p<.73?2:3,open,emerge,assemble,orbit,
  lidAngle:mix(1.40,-.14,open),laptopX:mix(0,-3.4,emerge),laptopY:mix(-.6,-.5,emerge),laptopZ:mix(-.7,-3.7,emerge),laptopScale:mix(1,.47,emerge),laptopAngle:mix(-.10,.15,emerge),
  shoeX:mix(0,mobile?0:.65,emerge),shoeY:mix(.40,.74,emerge),shoeZ:mix(-1.68,.65,emerge),shoeScale:mix(.52,1,emerge),shoeAngle:mix(-.10,.32,emerge)+orbit*Math.PI*2,shoeTilt:mix(0,-.07,emerge),
  cameraAzimuth:mix(.47,.20,assemble)+orbit*.42,cameraHeight:mobile?3.9:3.8,cameraDistance:mobile?17:10.2,
  darkness:phase(p,.38,.82),lightShift:assemble};
}
