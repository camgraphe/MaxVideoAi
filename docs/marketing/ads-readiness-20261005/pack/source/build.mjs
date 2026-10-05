#!/usr/bin/env node
/** Offline deterministic compositor. No network, generation, login or upload. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(dir, '../../../..');
const require = createRequire(path.join(repo, 'frontend/package.json'));
const sharp = require('sharp');
const copy = JSON.parse(await fs.readFile(path.join(dir, 'source/copy.json'), 'utf8'));
const work = path.join(dir, 'build');
const out = path.join(dir, 'exports');
const video = path.join(repo, 'frontend/public/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4');
const ffmpeg = process.env.ADS_FFMPEG || 'ffmpeg';
const ffprobe = process.env.ADS_FFPROBE || 'ffprobe';
const onlyStills = process.argv.includes('--stills-only');
const fullSvg = process.argv.includes('--standalone-svg');
for (const sub of [work, out, path.join(dir, 'source/scenes')]) await fs.mkdir(sub, { recursive: true });

const colors = { ink: '#080E1A', panel: '#121E32', line: '#30405B', white: '#F7FAFF', muted: '#B3C2DC', blue: '#497BFF', lime: '#D8EE79' };
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const assets = {
  logo: ['maxvideoai-logo.svg', 'image/svg+xml'],
  source: ['watch-source.webp', 'image/webp'],
  result: ['watch-result.webp', 'image/webp'],
  historical: ['claude-host-historical.jpg', 'image/jpeg'],
};
const assetData = {};
for (const [key, [name, mime]] of Object.entries(assets)) {
  const bytes = await fs.readFile(path.join(dir, 'assets', name));
  // librsvg cannot decode embedded WebP on every host. Keep the authored WebP
  // untouched and use a deterministic PNG buffer only for raster composition.
  const pixels = mime === 'image/webp' ? await sharp(bytes).png().toBuffer() : bytes;
  assetData[key] = `data:${mime === 'image/webp' ? 'image/png' : mime};base64,${pixels.toString('base64')}`;
}

const text = (s, x, y, size = 32, fill = colors.white, weight = 400, extra = '') => `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${escape(s)}</text>`;
const lines = (items, x, y, size, step, fill = colors.white, weight = 400) => items.map((s, i) => text(s, x, y + i * step, size, fill, weight)).join('');
const rect = (x, y, w, h, fill = colors.panel, radius = 22, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" ${extra}/>`;
const imageTag = (key, x, y, w, h) => `<image href="${assetData[key]}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
const arrow = (x, y, vertical = false) => vertical ? `<path d="M${x} ${y}v48m-11-11 11 11 11-11" fill="none" stroke="${colors.blue}" stroke-width="4"/>` : `<path d="M${x} ${y}h52m-12-12 12 12-12 12" fill="none" stroke="${colors.blue}" stroke-width="4"/>`;
const line = (x1, y1, x2, y2, color = colors.line) => `<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="${color}" stroke-width="2"/>`;

function base(w, h, category, body) {
  const v = h > w;
  const margin = v ? 72 : 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><radialGradient id="glow"><stop stop-color="#142E63"/><stop offset="1" stop-color="${colors.ink}"/></radialGradient></defs>
${rect(0, 0, w, h, colors.ink, 0)}<ellipse cx="${w * .8}" cy="${h * .3}" rx="${w * .7}" ry="${h * .65}" fill="url(#glow)" opacity=".6"/>
${imageTag('logo', margin, v ? 110 : 74, 58, 58)}${text('MaxVideoAI', margin + 76, v ? 151 : 114, 32, colors.white, 600)}
${text('CLAUDE DESKTOP', margin, v ? 239 : 197, v ? 28 : 25, colors.lime, 600, 'letter-spacing="2"')}
${rect(w - margin - 230, v ? 119 : 80, 230, 45, '#1E2D46', 22)}${text('REVIEW CUT', w - margin - 207, v ? 150 : 111, 23, colors.lime, 600, 'letter-spacing="2"')}
${body}
${line(margin, h - (v ? 191 : 136), w - margin, h - (v ? 191 : 136))}
${text(category, margin, h - (v ? 135 : 84), v ? 27 : 25, colors.lime, 600)}
${text('LOCAL REVIEW · 05 OCT 2026', margin, h - (v ? 82 : 43), v ? 23 : 21, colors.muted, 400, 'letter-spacing="1"')}
</svg>`;
}

function intro(w, h, variant) {
  const v = h > w;
  const titles = copy.headlines[variant];
  const tx = v ? 72 : 96;
  const ty = v ? 358 : 332;
  const size = v ? 86 : (variant === 'b' ? 68 : 84);
  const box = v ? { x: 72, y: 682, w: 936, h: 526 } : { x: 864, y: 268, w: 960, h: 540 };
  let body = lines(titles, tx, ty, size, size * 1.1, colors.white, 650);
  body += lines(v ? ['For the project you develop', 'in Claude Desktop.'] : ['For the project you develop', 'in Claude Desktop.'], tx, ty + size * 2.6, v ? 35 : 34, 47, colors.muted);
  body += rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4, colors.line, 0);
  body += rect(box.x, box.y, box.w, box.h, '#020712', 0);
  body += text('EXISTING PRODUCT SAMPLE', box.x, box.y + box.h + 49, v ? 28 : 27, colors.lime, 600);
  body += text('Wan 3 Prime · 6-second clip · September 2026', box.x, box.y + box.h + 94, v ? 27 : 24, colors.muted);
  const lx = v ? tx : 96;
  const ly = v ? 1450 : 721;
  body += lines(v ? ['This sample is not from', 'a new Claude session.'] : ['This sample is not from', 'a new Claude session.'], lx, ly, v ? 34 : 28, v ? 47 : 40, colors.muted);
  if (variant === 'b') body += text('Review the exact price before generation.', lx, v ? 1600 : 847, v ? 31 : 25, colors.lime, 500);
  return { svg: base(w, h, 'EXISTING SAMPLE · WORKFLOW TO VERIFY', body), box };
}

function titleBlock(scene, w, h) {
  const v = h > w;
  const x = v ? 72 : 96;
  const y = v ? 357 : 331;
  const size = v ? 82 : (scene.id === 'quote' ? 67 : 75);
  return text(scene.step, x, v ? 290 : 247, 25, colors.blue, 600, 'letter-spacing="1.5"') +
    lines(scene.title, x, y, size, size * 1.1, colors.white, 650) +
    lines(scene.subtitle, x, y + size * 2.7, v ? 34 : 30, v ? 47 : 43, colors.muted);
}

function detailPanel(scene, w, h) {
  const v = h > w;
  const px = v ? 72 : 864;
  const py = v ? 760 : 264;
  const pw = v ? 936 : 960;
  const ph = v ? 696 : 604;
  const x = px + 46;
  const y = py + 65;
  const size = v ? 36 : 32;
  let s = rect(px, py, pw, ph, colors.panel, 25, `stroke="${colors.line}" stroke-width="2"`);
  s += text('EDITORIAL DIAGRAM / NOT PRODUCT UI', x, y, v ? 23 : 22, colors.muted, 400, 'letter-spacing="1"');
  if (scene.id === 'brief') {
    s += imageTag('source', x, y + 38, pw - 92, ph - 290);
    s += text('A short product reveal', x, py + ph - 130, size, colors.white, 600);
    s += text('Format · Movement · References', x, py + ph - 70, v ? 29 : 27, colors.lime);
  } else if (scene.id === 'connect') {
    const items = [['Claude Desktop', 'Add the MaxVideoAI connector'], ['MaxVideoAI account', 'Sign in + approve access'], ['Back in Claude', 'Enable the connector + check account']];
    items.forEach(([a, b], i) => {
      const yy = y + 75 + i * (v ? 175 : 151);
      s += text(`0${i + 1}`, x, yy, 28, colors.blue, 600);
      s += text(a, x + 67, yy, size, colors.white, 550);
      s += text(b, x + 67, yy + 49, v ? 26 : 25, colors.muted);
      if (i < 2) s += arrow(x + 84, yy + 65, true);
    });
  } else if (scene.id === 'quote') {
    s += text('Your clip settings', x, y + 90, 44, colors.white, 550);
    const items = ['Model', 'Duration + format', 'Resolution + references'];
    items.forEach((a, i) => {
      const yy = y + 175 + i * 80;
      s += text(a, x, yy, size, colors.muted);
      s += `<path d="M${px + pw - 105} ${yy - 18}l10 10 19-24" fill="none" stroke="${colors.lime}" stroke-width="4"/>`;
    });
    s += line(x, y + 394, px + pw - 46, y + 394);
    s += text('Exact quote', x, y + 455, 44, colors.lime, 600);
    s += text('Review in the connected account', x, y + 510, v ? 27 : 25, colors.muted);
    if (v) s += text('No current price is shown in this illustration.', x, y + 579, 23, colors.muted);
  } else if (scene.id === 'approval') {
    s += text('Review the exact quote', x, y + 120, 43, colors.white, 550);
    s += lines(['Prompt + settings + price', 'Check them before you confirm.'], x, y + 190, size, 57, colors.muted);
    s += arrow(x + 60, y + 285, true);
    s += text('Your explicit approval', x, y + 399, 43, colors.lime, 600);
    s += text('A recommendation does not start a job.', x, y + 470, v ? 27 : 26, colors.muted);
  } else if (scene.id === 'wait') {
    const items = [['Submit once', 'Use the accepted job'], ['Follow status', 'Recover progress without a duplicate'], ['Retrieve when complete', 'Find the media in your Library']];
    items.forEach(([a, b], i) => {
      const yy = y + 105 + i * (v ? 174 : 151);
      s += text(`0${i + 1}`, x, yy, 28, colors.blue, 600);
      s += text(a, x + 67, yy, size, colors.white, 550);
      s += text(b, x + 67, yy + 49, v ? 25 : 24, colors.muted);
      if (i < 2) s += arrow(x + 84, yy + 65, true);
    });
  }
  return s;
}

function middle(scene, w, h) {
  const v = h > w;
  let body = titleBlock(scene, w, h) + detailPanel(scene, w, h);
  body += lines(v ? ['The sequence is illustrative.', 'A fresh end-to-end capture is still pending.'] : ['The sequence is illustrative.', 'Fresh end-to-end capture pending.'], v ? 72 : 96, v ? 1560 : 754, v ? 29 : 27, 43, colors.muted);
  return { svg: base(w, h, scene.label, body), box: null };
}

function historical(w, h) {
  const scene = copy.scenes.find((s) => s.id === 'historical');
  const v = h > w;
  let body = titleBlock(scene, w, h);
  const box = v ? { x: 72, y: 744, w: 936, h: 624 } : { x: 864, y: 227, w: 960, h: 640 };
  body += imageTag('historical', box.x, box.y, box.w, box.h);
  body += lines(v ? ['The $0.95 on screen is historical.', 'This is a separate result, not the watch job.', 'Host rendering + library handoff only.'] : ['The $0.95 on screen is historical.', 'Separate result, not the watch job.', 'Host rendering + library handoff only.'], v ? 72 : 96, v ? 1490 : 745, v ? 29 : 25, v ? 48 : 42, colors.muted);
  return { svg: base(w, h, 'HISTORICAL CAPTURE · CONTROLLED STAGING', body), box: null };
}

function cta(w, h) {
  const scene = copy.scenes.find((s) => s.id === 'cta');
  const v = h > w;
  let body = titleBlock(scene, w, h);
  const box = v ? { x: 72, y: 744, w: 936, h: 526 } : { x: 864, y: 280, w: 960, h: 540 };
  body += rect(box.x, box.y, box.w, box.h, '#030814', 0);
  body += text('Existing September product sample', box.x, box.y + box.h + 47, v ? 27 : 24, colors.muted);
  body += rect(v ? 72 : 96, v ? 1410 : 698, v ? 936 : 716, v ? 93 : 78, colors.blue, 20);
  body += text('See the Claude Desktop setup', v ? 104 : 123, v ? 1471 : 749, v ? 39 : 34, colors.white, 600);
  body += text('maxvideoai.com/integrations/claude', v ? 72 : 96, v ? 1570 : 838, v ? 33 : 28, colors.lime, 500);
  body += text('Assistant requirements and host behavior vary.', v ? 72 : 96, v ? 1634 : 891, v ? 26 : 24, colors.muted);
  return { svg: base(w, h, 'SETUP GUIDE · NOT A FREE GENERATION OFFER', body), box };
}

async function saveSvg(name, svg) {
  // Source SVGs reference companion assets to avoid duplicating embedded pixels.
  let editable = svg;
  for (const [key, [name]] of Object.entries(assets)) editable = editable.replaceAll(assetData[key], `../../assets/${name}`);
  const svgPath = path.join(dir, 'source/scenes', `${name}.svg`);
  await fs.writeFile(svgPath, editable);
  const png = path.join(work, `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(png);
  if (fullSvg) await fs.writeFile(path.join(out, `${name}.standalone.svg`), svg);
  return png;
}

function run(binary, args) {
  const p = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (p.status !== 0) throw new Error(`${binary} ${args.join(' ')}\n${p.stderr}`);
  return p.stdout;
}

function encode(png, result, filename) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', png];
  if (result.box) {
    args.push('-i', video, '-filter_complex', `[1:v]scale=${result.box.w}:${result.box.h}:flags=lanczos,setsar=1[v];[0:v][v]overlay=${result.box.x}:${result.box.y}:shortest=1,format=yuv420p[out]`, '-map', '[out]');
  } else args.push('-vf', 'format=yuv420p', '-map', '0:v:0');
  args.push('-t', '6', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-g', '60', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-map_metadata', '-1', filename);
  run(ffmpeg, args);
}

const formats = [{ id: 'horizontal', w: 1920, h: 1080 }, { id: 'vertical', w: 1080, h: 1920 }];
const generated = [];
for (const format of formats) {
  const common = [];
  for (const scene of copy.scenes.slice(1)) {
    const result = scene.id === 'historical' ? historical(format.w, format.h) : scene.id === 'cta' ? cta(format.w, format.h) : middle(scene, format.w, format.h);
    const name = `${format.id}-${scene.id}`;
    const png = await saveSvg(name, result.svg);
    if (!onlyStills) {
      const clip = path.join(work, `${name}.mp4`);
      encode(png, result, clip);
      common.push(clip);
    }
  }
  for (const variant of ['a', 'b']) {
    const result = intro(format.w, format.h, variant);
    const name = `opening-${variant}-${format.id}`;
    const png = await saveSvg(name, result.svg);
    // A genuine composed poster: the same existing result frame in the motion window.
    const withPoster = await sharp(png).composite([{ input: await sharp(path.join(dir, 'assets/watch-result.webp')).resize(result.box.w, result.box.h).png().toBuffer(), left: result.box.x, top: result.box.y }]).png().toBuffer();
    await fs.writeFile(path.join(out, `${name}-poster.png`), withPoster);
    if (!onlyStills) {
      const first = path.join(work, `${name}.mp4`);
      encode(png, result, first);
      const list = path.join(work, `${name}.txt`);
      const seq = [first, ...common];
      await fs.writeFile(list, seq.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
      const final = path.join(out, `claude-clip-${variant}-${format.id}-review.mp4`);
      run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-an', '-movflags', '+faststart', '-map_metadata', '-1', final]);
      const record = async (file) => {
        const properties = JSON.parse(run(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt:format=duration,size', '-of', 'json', file]));
        const bytes = await fs.readFile(file);
        generated.push({ path: path.relative(dir, file), sha256: createHash('sha256').update(bytes).digest('hex'), ...properties });
        console.log(`Built ${path.basename(file)} (${bytes.length} bytes)`);
      };
      await record(final);
      // Short edit: opening 4s, five workflow scenes 3s each, CTA 5s = 24s.
      // Keep the genuine motion at normal speed; omit historical still evidence.
      const shortSeq = [first, ...common.slice(0, 5), common.at(-1)];
      const shortDurations = [4, 3, 3, 3, 3, 3, 5];
      const shortList = path.join(work, `${name}-short24.txt`);
      const shortClips = [];
      for (let i = 0; i < shortSeq.length; i++) {
        const piece = path.join(work, `${name}-short-${i}.mp4`);
        run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', shortSeq[i], '-t', String(shortDurations[i]), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-movflags', '+faststart', '-map_metadata', '-1', piece]);
        shortClips.push(piece);
      }
      await fs.writeFile(shortList, shortClips.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
      const shortFinal = path.join(out, `claude-clip-${variant}-${format.id}-short24-review.mp4`);
      run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', shortList, '-c', 'copy', '-an', '-movflags', '+faststart', '-map_metadata', '-1', shortFinal]);
      await record(shortFinal);
    }
  }
}

function thumbnail(variant) {
  const w = 1280, h = 720;
  const headlines = copy.headlines[variant];
  let body = rect(0, 0, w, h, colors.ink, 0);
  body += rect(630, 0, 650, 720, '#102449', 0);
  body += imageTag('logo', 54, 48, 46, 46) + text('MaxVideoAI', 116, 81, 27, colors.white, 600);
  body += text('FOR CLAUDE DESKTOP', 54, 160, 23, colors.lime, 600, 'letter-spacing="1.5"');
  body += lines(headlines, 54, 267, variant === 'b' ? 49 : 65, 75, colors.white, 650);
  body += lines(variant === 'a' ? ['From project brief', 'to a quoted clip.'] : ['Review the exact price.', 'Approve before generation.'], 54, 441, 28, 42, colors.muted);
  body += imageTag('result', 630, 182, 650, 366);
  body += text('Existing September 2026 sample', 661, 590, 25, colors.muted);
  body += rect(54, 570, 525, 56, colors.blue, 13) + text('See the Claude Desktop setup', 75, 608, 28, colors.white, 600);
  body += text('REVIEW · ILLUSTRATED WORKFLOW', 54, 686, 22, colors.lime, 500);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
for (const variant of ['a', 'b']) {
  const svg = thumbnail(variant);
  let editable = svg;
  for (const [key, [name]] of Object.entries(assets)) editable = editable.replaceAll(assetData[key], `../assets/${name}`);
  await fs.writeFile(path.join(out, `thumbnail-${variant}.svg`), editable);
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, `thumbnail-${variant}.png`));
}

const time = (s, comma = false) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}${comma ? ',' : '.'}000`;
for (const variant of ['a', 'b']) {
  const captions = [
    [0, 6, copy.headlines[variant].join(' ') + '\nExisting September sample. Not a new Claude session.'],
    [6, 12, 'Describe the clip for your project.\nWorkflow illustration; fresh capture pending.'],
    [12, 18, 'Connect and authorize your MaxVideoAI account.\nThen return to Claude Desktop.'],
    [18, 24, 'Choose the model and review the exact quote.\nCheck the clip settings and price.'],
    [24, 30, 'Review prompt, settings and price.\nApprove the exact quote before generation.'],
    [30, 36, 'Generation takes time. Follow the accepted job.\nThis montage omits the wait.'],
    [36, 42, 'Historical Claude Desktop test, August 2026.\nSeparate result. The $0.95 shown is historical.'],
    [42, 48, 'See the Claude Desktop setup.\nAccount, connector and generation credits required.'],
  ];
  for (const format of formats) {
    const basename = `claude-clip-${variant}-${format.id}-review`;
    await fs.writeFile(path.join(out, `${basename}.srt`), captions.map(([a,b,s],i) => `${i+1}\n${time(a,true)} --> ${time(b,true)}\n${s}\n`).join('\n'));
    await fs.writeFile(path.join(out, `${basename}.vtt`), 'WEBVTT\n\n' + captions.map(([a,b,s]) => `${time(a)} --> ${time(b)}\n${s}\n`).join('\n'));
    const short = [
      [0, 4, copy.headlines[variant].join(' ') + '\nExisting sample, not a new Claude session.'],
      [4, 7, 'Describe your project clip.\nWorkflow illustration.'],
      [7, 10, 'Connect and authorize.\nMaxVideoAI account required.'],
      [10, 13, 'Choose the model.\nReview the exact quote.'],
      [13, 16, 'Approve before generation.\nGeneration uses credits.'],
      [16, 19, 'Follow the job; retrieve when complete.\nGeneration wait omitted.'],
      [19, 24, 'See the Claude Desktop setup.\nAccount and connector required.'],
    ];
    const shortName = `claude-clip-${variant}-${format.id}-short24-review`;
    await fs.writeFile(path.join(out, `${shortName}.srt`), short.map(([a,b,s],i) => `${i+1}\n${time(a,true)} --> ${time(b,true)}\n${s}\n`).join('\n'));
    await fs.writeFile(path.join(out, `${shortName}.vtt`), 'WEBVTT\n\n' + short.map(([a,b,s]) => `${time(a)} --> ${time(b)}\n${s}\n`).join('\n'));
  }
}
await fs.writeFile(path.join(dir, 'verification.json'), JSON.stringify({ builtAt: new Date().toISOString(), mode: onlyStills ? 'stills-only' : 'all', ffmpegVersion: run(ffmpeg, ['-version']).split('\n')[0], sharpVersion: sharp.versions.sharp, outputs: generated }, null, 2) + '\n');
console.log('Stills, editable SVGs and captions complete.');
