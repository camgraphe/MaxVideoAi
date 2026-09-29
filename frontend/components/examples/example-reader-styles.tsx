import React from 'react';

// One scoped style owner for the SSR watch page and the on-demand dialog.
// Keeping it in the reader removes a separate render-blocking CSS request.
const styles = {
  media: 'video-reader-media',
  stage: 'video-reader-stage',
  renderDetails: 'video-reader-renderDetails',
  modelIdentity: 'video-reader-modelIdentity',
  modelLink: 'video-reader-modelLink',
  copyButton: 'video-reader-copyButton',
  copyFallback: 'video-reader-copyFallback',
  comparisonHeading: 'video-reader-comparisonHeading',
  quoteInfo: 'video-reader-quoteInfo',
  quotePrice: 'video-reader-quotePrice',
  quoteCta: 'video-reader-quoteCta',
  ctaFull: 'video-reader-ctaFull',
  ctaCompact: 'video-reader-ctaCompact',
  settingsStatus: 'video-reader-settingsStatus',
  shareActions: 'video-reader-shareActions',
  action: 'video-reader-action',
  backdrop: 'video-reader-backdrop',
  centerPlay: 'video-reader-centerPlay',
  close: 'video-reader-close',
  comparison: 'video-reader-comparison',
  comparisonNote: 'video-reader-comparisonNote',
  context: 'video-reader-context',
  contextGrid: 'video-reader-contextGrid',
  controlRow: 'video-reader-controlRow',
  controls: 'video-reader-controls',
  copyStatus: 'video-reader-copyStatus',
  current: 'video-reader-current',
  dialog: 'video-reader-dialog',
  editorial: 'video-reader-editorial',
  errorNavigation: 'video-reader-errorNavigation',
  expand: 'video-reader-expand',
  footnote: 'video-reader-footnote',
  frame: 'video-reader-frame',
  heading: 'video-reader-heading',
  layout: 'video-reader-layout',
  loading: 'video-reader-loading',
  meta: 'video-reader-meta',
  model: 'video-reader-model',
  navigationError: 'video-reader-navigationError',
  note: 'video-reader-note',
  player: 'video-reader-player',
  playerNavigation: 'video-reader-playerNavigation',
  playerStatus: 'video-reader-playerStatus',
  portrait: 'video-reader-portrait',
  price: 'video-reader-price',
  primary: 'video-reader-primary',
  prompt: 'video-reader-prompt',
  promptExpanded: 'video-reader-promptExpanded',
  promptHeading: 'video-reader-promptHeading',
  promptText: 'video-reader-promptText',
  quote: 'video-reader-quote',
  quotes: 'video-reader-quotes',
  recorded: 'video-reader-recorded',
  references: 'video-reader-references',
  quoteIdentity: 'video-reader-quoteIdentity',
  quoteSettings: 'video-reader-quoteSettings',
  share: 'video-reader-share',
  shareFallback: 'video-reader-shareFallback',
  shareFeedback: 'video-reader-shareFeedback',
  shareRow: 'video-reader-shareRow',
  spacer: 'video-reader-spacer',
  standalone: 'video-reader-standalone',
} as const;

const readerCss = String.raw`
.video-reader-backdrop{position:fixed;inset:0;z-index:100;background:#101511bf;backdrop-filter:blur(6px);display:grid;place-items:center;padding:24px}
.video-reader-dialog{--ink:#f1f0e9;--muted:#b2b7ad;--canvas:#181a1a;--panel:#222524;--line:#3b3f3b;--gold:#e6bf76;container-type:inline-size;position:relative;background:var(--canvas);color:var(--ink);color-scheme:dark;border:1px solid var(--line);border-radius:18px;padding:26px;width:min(1380px,100%);max-height:calc(100dvh - 48px);overflow:auto;overscroll-behavior:contain;box-shadow:0 30px 120px #0008}
.video-reader-dialog :is(button,a,input,select,textarea):focus-visible{outline:2px solid var(--gold);outline-offset:3px}
.video-reader-dialog button{cursor:pointer;font:inherit}.video-reader-dialog button:disabled{cursor:default;opacity:.35}.video-reader-dialog a{text-decoration:none}.video-reader-dialog button,.video-reader-dialog a{transition:background .15s,color .15s,border-color .15s}
.video-reader-close{position:absolute;top:13px;right:13px;z-index:4;display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--muted)}.video-reader-close:hover{border-color:var(--gold);color:var(--ink)}
.video-reader-playerNavigation{position:sticky;top:-26px;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-26px -26px 20px;padding:12px 26px;background:var(--canvas);border-bottom:1px solid var(--line);min-height:68px}.video-reader-playerNavigation>span{font-size:13px;font-weight:550;color:var(--muted)}.video-reader-playerNavigation>div{display:flex;gap:8px}
.video-reader-playerNavigation button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font-size:12px;color:var(--ink)}.video-reader-playerNavigation button:hover:not(:disabled){border-color:var(--gold)}
.video-reader-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:26px 24px;align-items:start}
.video-reader-media{min-width:0}.video-reader-player{position:relative;min-width:0}.video-reader-stage{overflow:hidden;background:#101211;border:1px solid #ffffff20;border-radius:12px}
.video-reader-frame{position:relative;width:100%;aspect-ratio:var(--ratio);background:#101211;overflow:hidden;isolation:isolate;margin:auto}.video-reader-frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.video-reader-centerPlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:70px;height:70px;border:1px solid #fff6;border-radius:50%;background:#181a1a9c;backdrop-filter:blur(8px);color:#fff}.video-reader-centerPlay:hover{background:#181a1acc}
.video-reader-controls{padding:6px 10px;background:#151916;display:grid;gap:2px}.video-reader-controls input{width:100%;height:12px;accent-color:var(--gold);cursor:pointer}.video-reader-controlRow{display:flex;align-items:center;gap:5px}.video-reader-controlRow button{display:grid;place-items:center;width:40px;min-height:40px;flex-shrink:0;border-radius:6px}.video-reader-controlRow button:hover{background:var(--panel)}.video-reader-controlRow span{font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}.video-reader-spacer{flex:1}.video-reader-controlRow select{font-size:11px;background:var(--canvas);border:1px solid var(--line);border-radius:6px;min-height:36px;padding:4px 7px;max-width:95px}
.video-reader-playerStatus{position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);background:#151916e8;padding:10px 14px;border-radius:8px;font-size:12px;text-align:center;pointer-events:none;max-width:90%}
.video-reader-stage:fullscreen{display:grid;grid-template-rows:minmax(0,1fr) auto;height:100%;width:100%;border:0;border-radius:0}.video-reader-stage:fullscreen .video-reader-frame{height:100%;width:100%;aspect-ratio:auto}
.video-reader-heading{margin-top:16px}.video-reader-heading :is(h1,h2){font-size:clamp(23px,2.5vw,30px);font-weight:580;line-height:1.22;letter-spacing:-.035em;margin:0 0 12px;overflow-wrap:anywhere}
.video-reader-renderDetails{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px}.video-reader-meta{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--muted)}.video-reader-meta>span{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:4px 9px;border:1px solid var(--line);border-radius:7px;white-space:nowrap}
.video-reader-recorded{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:11px;color:var(--muted)}.video-reader-recorded strong{font-size:14px;font-weight:550;color:var(--ink);font-variant-numeric:tabular-nums}
.video-reader-editorial{min-width:0;display:grid;gap:14px}.video-reader-action{padding:16px;background:var(--panel);border:1px solid var(--line);border-radius:12px}.video-reader-modelIdentity{display:flex;align-items:center;gap:12px;min-width:0}.video-reader-modelIdentity>div:last-child{min-width:0}.video-reader-model{font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
.video-reader-modelLink{display:inline-flex;align-items:center;gap:6px;min-height:36px;margin-top:4px;padding:5px 9px;border:1px solid var(--line);border-radius:7px;font-size:11px;color:var(--muted)}.video-reader-modelLink:hover{color:var(--ink);border-color:var(--gold)}
.video-reader-primary{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;background:var(--gold);color:#231c12;border:1px solid var(--gold);min-height:46px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:650;line-height:1.4;text-align:center}.video-reader-primary svg{flex-shrink:0}.video-reader-primary:hover{background:#f3d394}
.video-reader-note{font-size:12px;line-height:1.6;color:var(--muted);margin-top:5px}
.video-reader-prompt{padding:16px;border:1px solid var(--line);border-radius:12px;background:#1d201f}.video-reader-promptHeading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px}.video-reader-promptHeading :is(h2,h3),.video-reader-references :is(h2,h3){font-size:14px;font-weight:600}
.video-reader-copyButton{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;flex-shrink:0;border:1px solid var(--line);border-radius:7px;padding:7px 10px;font-size:11px!important;background:var(--panel);color:var(--ink)}.video-reader-copyButton:hover{border-color:var(--gold)}
.video-reader-promptText,.video-reader-promptExpanded{font-size:13px;line-height:1.7;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}.video-reader-promptText{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}.video-reader-promptExpanded{max-height:360px;overflow:auto}
.video-reader-expand{display:flex;align-items:center;gap:7px;min-height:40px;margin-top:6px;padding:6px 0;color:var(--gold);font-size:12px!important}.video-reader-expand[aria-expanded=true] svg{transform:rotate(180deg)}
.video-reader-copyStatus{font-size:12px;line-height:1.6;color:var(--gold);margin-top:6px}.video-reader-copyFallback{display:block;width:100%;min-height:100px;margin-top:10px;padding:10px;background:var(--canvas);border:1px solid var(--line);border-radius:7px;font-size:12px;color:var(--ink)}
.video-reader-references>div{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.video-reader-references img{width:64px;height:64px;object-fit:cover;border:1px solid var(--line);border-radius:8px}
.video-reader-comparison{grid-column:1/-1;min-width:0;border-top:1px solid var(--line);padding-top:22px}.video-reader-comparisonHeading{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:16px}.video-reader-comparisonHeading :is(h2,h3){font-size:22px;line-height:1.3;letter-spacing:-.025em;font-weight:580}
.video-reader-comparisonNote{max-width:290px;color:var(--muted);font-size:11px;line-height:1.6;text-align:right}
.video-reader-quotes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.video-reader-quote{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 8px;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);min-width:0;align-content:start}.video-reader-quote[data-original]{border-color:#e6bf7666}
.video-reader-quoteInfo{grid-column:1/-1;min-width:0}.video-reader-quoteIdentity{display:flex;align-items:center;gap:10px;min-width:0;min-height:42px}.video-reader-quoteIdentity>div:last-child{min-width:0}.video-reader-quoteIdentity :is(h3,h4){font-size:14px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}.video-reader-current{font-size:10px;color:var(--gold);margin-top:3px}
.video-reader-quoteSettings{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px;font-size:11px;line-height:1.5;color:var(--muted)}.video-reader-quoteSettings>span{padding:3px 6px;border:1px solid #ffffff12;border-radius:5px;background:#ffffff04}.video-reader-quoteSettings [data-adjusted]{color:var(--gold);border-color:#e6bf7655;background:#e6bf760c}
.video-reader-settingsStatus{font-size:10px;line-height:1.5;color:var(--muted);margin-top:5px}.video-reader-settingsStatus[data-adjusted]{color:var(--gold)}
.video-reader-quotePrice{display:flex;flex-direction:column;gap:2px;align-self:center}.video-reader-price{font-size:27px;letter-spacing:-.04em;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}.video-reader-quotePrice>span{font-size:10px;color:var(--muted)}
.video-reader-quoteCta{display:flex;align-items:center;justify-content:center;gap:7px;grid-column:2;align-self:center;min-height:44px;padding:8px 12px;border:1px solid #e6bf7677;border-radius:8px;color:var(--gold);font-size:12px;font-weight:600;line-height:1.3;text-align:center}.video-reader-quoteCta svg{flex-shrink:0}.video-reader-quoteCta:hover{background:#e6bf7615;border-color:var(--gold)}.video-reader-quote[data-original] .video-reader-quoteCta{background:var(--gold);color:#231c12;border-color:var(--gold)}.video-reader-quote[data-original] .video-reader-quoteCta:hover{background:#f3d394}
.video-reader-ctaCompact{display:none}.video-reader-footnote{font-size:11px;line-height:1.6;color:var(--muted);margin-top:12px}
.video-reader-portrait{grid-template-columns:minmax(260px,360px) minmax(0,1fr);grid-template-rows:auto 1fr}.video-reader-portrait .video-reader-media{grid-column:1;grid-row:1/3}.video-reader-portrait .video-reader-editorial{grid-column:2;grid-row:1}.video-reader-portrait .video-reader-comparison{grid-column:2;grid-row:2}.video-reader-portrait .video-reader-frame{width:min(100%,calc(64dvh * var(--ratio)),360px)}
.video-reader-share{min-width:0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#1d201f}.video-reader-shareRow{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;min-height:44px}.video-reader-shareRow>span{font-size:12px;font-weight:550}.video-reader-shareActions{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.video-reader-shareActions :is(button,a){display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink);font-size:11px;font-weight:550;white-space:nowrap}.video-reader-shareActions a{width:40px;padding:8px}.video-reader-shareActions svg{flex-shrink:0}.video-reader-shareActions :is(button,a):hover{border-color:var(--gold);background:#2b2c27}.video-reader-shareActions button[data-copied]{color:var(--gold);border-color:#e6bf7666}
.video-reader-shareFeedback{color:var(--gold);font-size:12px;line-height:1.6;margin:8px 0}.video-reader-shareFallback{display:block;width:100%;min-width:0;min-height:40px;background:var(--panel);border:1px solid var(--line);border-radius:7px;color:var(--ink);font-size:12px;padding:8px 10px}
.video-reader-loading{min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-size:14px;color:var(--muted)}.video-reader-loading button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:8px;color:var(--ink)}.video-reader-errorNavigation{display:flex;gap:12px}.video-reader-errorNavigation button{display:flex;align-items:center;gap:8px}.video-reader-navigationError{margin:20px 0 0;color:var(--gold);font-size:12px}
.video-reader-context{margin-top:24px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.75}.video-reader-context>p{max-width:85ch}.video-reader-context details{margin-top:8px}.video-reader-context summary{color:var(--ink);font-weight:550;cursor:pointer;padding:8px 0;min-height:40px}.video-reader-contextGrid{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:8px 0}.video-reader-context h3{color:var(--ink);font-size:14px;font-weight:550;margin:18px 0 8px}.video-reader-context ul{list-style:disc;padding-left:18px}.video-reader-context li{margin:6px 0}.video-reader-context a{color:var(--gold)}.video-reader-context a:hover{text-decoration:underline}.video-reader-context dl>div{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding:7px 0}.video-reader-context dd{text-align:right}
@container(max-width:960px){
 .video-reader-layout,.video-reader-portrait{grid-template-columns:minmax(0,1fr);grid-template-rows:none;gap:20px}
 .video-reader-portrait .video-reader-media,.video-reader-portrait .video-reader-editorial{grid-column:auto;grid-row:auto}.video-reader-portrait .video-reader-comparison{grid-column:1/-1;grid-row:auto}.video-reader-portrait .video-reader-stage{max-width:360px;margin:auto}
 .video-reader-editorial{gap:12px}.video-reader-action{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0;border:0;background:none}.video-reader-primary{margin:0;min-width:230px}.video-reader-modelLink{min-height:40px}
 .video-reader-prompt{padding:14px 16px}.video-reader-promptText{-webkit-line-clamp:3}.video-reader-share{padding:8px 14px}
 .video-reader-comparisonHeading{flex-wrap:wrap;gap:8px}.video-reader-comparisonNote{max-width:none;text-align:left}
 .video-reader-quote{grid-template-columns:minmax(0,1fr);gap:12px;padding:14px}.video-reader-quotePrice{grid-column:1;flex-direction:row;align-items:baseline;gap:7px}.video-reader-quoteCta{grid-column:1;width:100%}
}
@container(max-width:600px){
 .video-reader-action{display:block}.video-reader-modelIdentity{margin-bottom:12px}.video-reader-primary{min-width:0;width:100%;min-height:48px}
 .video-reader-heading :is(h1,h2){font-size:22px}.video-reader-renderDetails{gap:10px}.video-reader-recorded{width:100%}
 .video-reader-portrait .video-reader-frame{width:min(100%,calc(52dvh * var(--ratio)),280px)}
 .video-reader-quotes{grid-template-columns:1fr;gap:8px}.video-reader-quote{grid-template-columns:minmax(0,1fr) 104px;gap:5px 12px;padding:12px}
 .video-reader-quoteInfo{grid-area:1/1/3/2}.video-reader-quoteIdentity{gap:8px}.video-reader-quoteIdentity :is(h3,h4){font-size:12px}
 .video-reader-quoteSettings{gap:3px 7px;margin-top:7px;font-size:10px}.video-reader-quoteSettings>span{padding:0;border:0;background:none}.video-reader-quoteSettings [data-adjusted]{text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
 .video-reader-quotePrice{grid-area:1/2;display:flex;flex-direction:column;align-items:flex-end;gap:2px}.video-reader-price{font-size:23px}.video-reader-quoteCta{grid-area:2/2;min-height:44px;padding:8px}
 .video-reader-ctaFull{display:none}.video-reader-ctaCompact{display:inline}.video-reader-comparisonHeading :is(h2,h3){font-size:21px}
 .video-reader-controlRow button{width:44px;min-height:44px}.video-reader-controlRow select{max-width:76px}
 .video-reader-playerNavigation button{width:44px;padding:8px}.video-reader-playerNavigation button span{display:none}
 .video-reader-contextGrid{grid-template-columns:1fr;gap:0}.video-reader-shareActions :is(button,a){min-height:44px}.video-reader-shareActions a{width:44px}
 .video-reader-copyButton{min-height:44px}.video-reader-expand{min-height:44px}
}
@media(max-width:760px){
 .video-reader-backdrop{padding:0}.video-reader-dialog{padding:max(16px,env(safe-area-inset-top)) 16px max(22px,env(safe-area-inset-bottom));border-radius:0;border:0;width:100%;height:100dvh;max-height:100dvh}
 .video-reader-close{top:max(13px,env(safe-area-inset-top));right:14px}.video-reader-playerNavigation{top:calc(-1 * max(16px,env(safe-area-inset-top)));margin:calc(-1 * max(16px,env(safe-area-inset-top))) -16px 16px;padding:max(10px,env(safe-area-inset-top)) 16px 10px}
 .video-reader-loading{min-height:70dvh}.video-reader-errorNavigation{flex-direction:column}
}
@media(prefers-reduced-motion:reduce){.video-reader-dialog *{transition:none!important}}
.video-reader-standalone{width:100%;height:auto;max-height:none;overflow:visible;box-shadow:none}
`;

export function ExampleReaderStyles() {
  // Authored static CSS only; preserve combinators in both React SSR runtimes.
  return <style data-video-reader-styles dangerouslySetInnerHTML={{ __html: readerCss }} />;
}

export default styles;
