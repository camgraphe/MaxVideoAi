#!/usr/bin/env node
/** Media-artifact checks, not application tests. No remote access. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(dir, '../../../..');
const require = createRequire(path.join(repo, 'frontend/package.json'));
const sharp = require('sharp');
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const ffmpeg = process.env.ADS_FFMPEG || 'ffmpeg';
const ffprobe = process.env.ADS_FFPROBE || 'ffprobe';
function run(binary, args) {
  const p = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (p.status !== 0) throw new Error(`${binary} failed: ${p.stderr}`);
  return p.stdout;
}
function check(value, label) { if (!value) throw new Error(label); }
const results = [];
for (const asset of manifest.assets) {
  const file = path.resolve(dir, asset.path);
  const bytes = await fs.readFile(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  check(hash === asset.sha256, `Source asset changed: ${asset.id}`);
  if (asset.originalRepositoryPath) {
    const original = await fs.readFile(path.join(repo, asset.originalRepositoryPath));
    check(bytes.equals(original), `Copied asset differs: ${asset.id}`);
  }
  results.push({ check: 'preserved_source', asset: asset.id, sha256: hash, passed: true });
}
function topAtoms(bytes) {
  const atoms = [];
  for (let p = 0; p + 8 <= bytes.length;) {
    let size = bytes.readUInt32BE(p);
    const type = bytes.toString('ascii', p + 4, p + 8);
    if (size === 1) size = Number(bytes.readBigUInt64BE(p + 8));
    if (size === 0) size = bytes.length - p;
    check(size >= 8 && p + size <= bytes.length, 'Invalid MP4 atom');
    atoms.push({ type, offset: p, size });
    p += size;
  }
  return atoms;
}
for (const variant of ['a', 'b']) for (const format of ['horizontal', 'vertical']) for (const duration of [48, 24]) {
  const stem = `claude-clip-${variant}-${format}${duration === 24 ? '-short24' : ''}-review`;
  const file = path.join(dir, 'exports', `${stem}.mp4`);
  const report = JSON.parse(run(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration,size', '-of', 'json', file]));
  const stream = report.streams.find((s) => s.codec_type === 'video');
  check(report.streams.length === 1 && stream, `${stem}: unexpected audio/stream count`);
  check(stream.codec_name === 'h264' && stream.pix_fmt === 'yuv420p' && stream.r_frame_rate === '30/1', `${stem}: invalid playback encoding`);
  check(stream.width === (format === 'horizontal' ? 1920 : 1080) && stream.height === (format === 'horizontal' ? 1080 : 1920), `${stem}: wrong dimensions`);
  check(Math.abs(Number(report.format.duration) - duration) <= 0.05, `${stem}: wrong duration`);
  run(ffmpeg, ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-']);
  const bytes = await fs.readFile(file);
  const atoms = topAtoms(bytes);
  check(atoms.find((a) => a.type === 'moov')?.offset < atoms.find((a) => a.type === 'mdat')?.offset, `${stem}: missing faststart`);
  for (const extension of ['srt', 'vtt']) {
    const caption = await fs.readFile(path.join(dir, 'exports', `${stem}.${extension}`), 'utf8');
    const final = `00:00:${duration}${extension === 'srt' ? ',' : '.'}000`;
    check(caption.includes(final), `${stem}: captions do not cover full duration`);
    if (extension === 'vtt') check(caption.startsWith('WEBVTT\n'), `${stem}: invalid VTT header`);
  }
  results.push({ check: 'video_artifact', file: path.relative(dir, file), passed: true, fullyDecoded: true, faststart: true, sha256: createHash('sha256').update(bytes).digest('hex'), ...report });
  // Review snapshots at genuine motion, quote, wait/retrieval and CTA points.
  if (variant === 'a') {
    const points = duration === 48 ? [0, 2.5, 19, 31, 37, 43] : [0, 2.5, 11, 17, 20];
    const frameDir = path.join(dir, 'exports', `${stem}-frames`);
    await fs.mkdir(frameDir, { recursive: true });
    for (const t of points) run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', path.join(frameDir, `at-${t}.png`)]);
  }
}
for (const variant of ['a', 'b']) {
  const file = path.join(dir, 'exports', `thumbnail-${variant}.png`);
  const meta = await sharp(file).metadata();
  check(meta.width === 1280 && meta.height === 720, 'Thumbnail dimensions');
  results.push({ check: 'thumbnail_dimensions', file: path.relative(dir, file), passed: true, width: meta.width, height: meta.height });
}
const qa = { verifiedAt: new Date().toISOString(), outcome: 'passed', publicationState: 'local_review_only', checks: results, manualVisualReview: 'See creative.md; proof labels and image fidelity checked from opening posters, scene frames and exported MP4 snapshots. No live exact-host test performed.' };
await fs.writeFile(path.join(dir, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
console.log(`PASS: ${results.length} artifact/source checks; 8 MP4s fully decoded, faststart, dimensions, fps, duration and captions verified.`);
