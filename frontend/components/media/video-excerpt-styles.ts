/** Shared selector styles kept local to the lazy dialog (also used by offline QA). */
export const videoExcerptStyles = `
.video-excerpt-layer{z-index:120;padding:12px}
.app-experience .video-excerpt-dialog{width:min(100%,720px);display:flex;flex-direction:column;gap:0;padding:24px;max-height:calc(100dvh - 24px);overflow:auto;background:var(--app-panel,#fafaf4);color:var(--app-ink,#20271f);border:1px solid var(--app-line,#c4c9bb);border-radius:20px;box-shadow:0 24px 100px #0005}
.video-excerpt-heading{padding:0;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.video-excerpt-eyebrow{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.15em;font-weight:700;color:var(--app-accent,#765020);margin-bottom:5px}
.video-excerpt-dialog h2{font-size:20px;line-height:1.3;font-weight:650;letter-spacing:-.025em;margin:0}
.video-excerpt-dialog>*,.video-excerpt-timeline>*{flex-shrink:0}.video-excerpt-dialog button{cursor:pointer;touch-action:manipulation}
.video-excerpt-close{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border:1px solid var(--app-line,#c4c9bb);border-radius:50%;background:transparent;color:var(--app-muted,#57634f)}
.video-excerpt-stage{position:relative;display:grid;place-items:center;width:100%;height:290px;flex:none;background:#151916;border:1px solid #ffffff12;border-radius:12px;overflow:hidden}
.app-experience .video-excerpt-stage video{position:absolute;inset:0;display:block;width:100%;height:100%;max-height:100%;min-height:0;object-fit:contain}
.video-excerpt-stage-mark{position:absolute;display:grid;place-items:center;width:60px;height:60px;border:1px solid #ffffff30;border-radius:50%;color:#e8eadd;pointer-events:none}
.video-excerpt-transport{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0 14px}
.video-excerpt-play{display:flex;align-items:center;gap:9px;min-height:44px;padding:8px 12px;border:1px solid var(--app-line,#c4c9bb);border-radius:8px;font-size:12px;font-weight:600;background:transparent}
.video-excerpt-time{display:flex;align-items:center;gap:7px;font-size:12px;font-variant-numeric:tabular-nums;color:var(--app-muted,#57634f)}
.video-excerpt-time strong{font-weight:600;color:var(--app-ink,#20271f)}
.video-excerpt-timeline{min-width:0}
.video-excerpt-timeline-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px}
.video-excerpt-timeline-toolbar>span{font-size:10px;letter-spacing:.13em;font-weight:700;color:var(--app-muted,#57634f)}
.video-excerpt-timeline-toolbar button{display:flex;align-items:center;gap:6px;min-height:44px;font-size:11px;color:var(--app-accent,#765020);background:transparent}
.video-excerpt-timeline-toolbar button[aria-pressed=true]{font-weight:700}
.video-excerpt-track{position:relative;height:110px;margin:0 12px;isolation:isolate}
.video-excerpt-seek{position:absolute;inset:0 0 auto;height:40px;cursor:crosshair;touch-action:none}
.video-excerpt-seek span{position:absolute;top:7px;transform:translateX(-50%);font-size:10px;line-height:1;font-variant-numeric:tabular-nums;color:var(--app-muted,#57634f);white-space:nowrap;pointer-events:none}
.video-excerpt-seek span:first-child{transform:none}.video-excerpt-seek span:last-child{transform:translateX(-100%)}
.video-excerpt-seek span:after{content:'';position:absolute;left:50%;top:18px;height:6px;border-left:1px solid var(--app-line,#c4c9bb)}
.video-excerpt-frames{position:absolute;top:40px;bottom:8px;left:0;right:0;background:repeating-linear-gradient(90deg,#777e7020 0,#777e7020 calc(10% - 1px),#777e7040 calc(10% - 1px),#777e7040 10%);border-radius:5px;overflow:hidden;pointer-events:none}
.video-excerpt-frames img{position:absolute;height:100%;object-fit:cover;max-width:none}
.video-excerpt-excluded{position:absolute;top:40px;bottom:8px;background:#111a17a6;pointer-events:none}
.video-excerpt-excluded-start{left:0}.video-excerpt-excluded-end{right:0}
.video-excerpt-selection{position:absolute;top:38px;bottom:6px;border-top:3px solid #bd8c38;border-bottom:3px solid #bd8c38;cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;min-width:0}
.video-excerpt-selection:active{cursor:grabbing}
.video-excerpt-selection>span{font-size:10px;line-height:1;font-variant-numeric:tabular-nums;padding:5px 7px;color:#faf9ef;background:#151916b8;border-radius:4px;overflow:hidden;white-space:nowrap;pointer-events:none}
.video-excerpt-handle{position:absolute;top:28px;bottom:0;width:44px;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;cursor:ew-resize;touch-action:none;z-index:3}
.video-excerpt-handle>span{display:grid;place-items:center;width:14px;height:66px;background:#bd8c38;border:1px solid #d5ac60;border-radius:4px;color:#241b0c;box-shadow:0 1px 4px #0003;pointer-events:none}
.video-excerpt-playhead{position:absolute;top:28px;bottom:0;width:2px;background:#fff;box-shadow:0 0 2px #000;transform:translateX(-50%);pointer-events:none;z-index:2}
.video-excerpt-playhead:before{content:'';position:absolute;top:-1px;left:-4px;width:10px;height:10px;background:#fff;clip-path:polygon(0 0,100% 0,100% 45%,50% 100%,0 45%);filter:drop-shadow(0 0 1px #000)}
.video-excerpt-timeline-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:44px;font-size:11px;color:var(--app-muted,#57634f)}
.video-excerpt-timeline-footer button{min-height:44px;text-decoration:underline;text-underline-offset:3px;background:transparent;white-space:nowrap}
.video-excerpt-precision{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:14px;align-items:end;border-top:1px solid var(--app-line,#c4c9bb);padding-top:14px;margin-top:2px}
.video-excerpt-precision label{display:grid;gap:5px;min-width:0}
.video-excerpt-precision label>span:first-child,.video-excerpt-duration>span{font-size:10px;color:var(--app-muted,#57634f)}
.video-excerpt-number{display:flex;align-items:center;gap:4px;border:1px solid var(--app-line,#c4c9bb);border-radius:7px;padding-right:9px;font-size:11px;color:var(--app-muted,#57634f)}
.video-excerpt-number input{width:100%;min-width:0;min-height:44px;background:transparent;padding:8px 0 8px 10px;font-size:12px;font-variant-numeric:tabular-nums;color:var(--app-ink,#20271f);border:0;outline-offset:0;border-radius:7px}
.video-excerpt-duration{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:4px;min-height:64px;text-align:right}
.video-excerpt-duration strong{font-size:20px;letter-spacing:-.03em;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.4}.video-excerpt-duration small{font-size:12px;font-weight:400}
.video-excerpt-dialog p{font-size:11px;line-height:1.5;margin:10px 0 0;color:var(--app-muted,#57634f)}
.video-excerpt-dialog .video-excerpt-limits{margin-top:9px;font-size:10px;text-align:right}
.video-excerpt-dialog [role=alert]{color:var(--color-error,#b83d3d)}
.video-excerpt-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid var(--app-line,#c4c9bb)}
.video-excerpt-actions button{min-height:44px;padding:10px 18px;border:1px solid var(--app-line,#c4c9bb);border-radius:8px;font-size:12px;font-weight:600}
.video-excerpt-actions button:last-child{background:var(--app-ink,#20271f);color:var(--app-panel,#fafaf4);border-color:transparent}
.video-excerpt-dialog button:disabled{opacity:.45;cursor:default}.video-excerpt-dialog [aria-disabled=true]{cursor:default}
.video-excerpt-dialog :focus-visible{outline:2px solid var(--app-accent,#765020);outline-offset:3px}
.video-excerpt-handle:focus-visible{outline-offset:-3px;border-radius:6px;background:#bd8c3820}
@media(max-width:600px){.app-experience .video-excerpt-dialog{padding:16px;border-radius:16px}.video-excerpt-dialog h2{font-size:18px}.video-excerpt-heading{margin-bottom:12px}.video-excerpt-stage{height:220px}.video-excerpt-precision{gap:8px;grid-template-columns:1fr 1fr 1.15fr}.video-excerpt-duration strong{font-size:17px}.video-excerpt-number input{padding-left:7px;font-size:11px}.video-excerpt-number{padding-right:6px}.video-excerpt-timeline-footer{font-size:10px}.video-excerpt-time{font-size:11px}.video-excerpt-duration>span{font-size:9px}.video-excerpt-actions{margin-top:14px}.video-excerpt-seek span{font-size:9px}}
@media(max-width:350px){.video-excerpt-stage{height:180px}.video-excerpt-dialog h2{font-size:16px}.video-excerpt-number input{font-size:10px}.video-excerpt-duration strong{font-size:15px}.video-excerpt-play{font-size:11px;padding:8px}}
@media(max-height:740px) and (min-width:601px){.video-excerpt-stage{height:210px}}
`;
