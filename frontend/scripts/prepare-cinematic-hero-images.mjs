import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'config/model-cinematic-hero-displays.json');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const originals = [
  await readJson(path.join(root, 'config/model-cinematic-flash-hero.json')),
  ...(await readJson(path.join(root, 'config/seedream-editorial-images.json'))),
  ...(await readJson(path.join(root, 'config/model-cinematic-start-frames.json'))),
  ...(await readJson(path.join(root, 'config/model-cinematic-public-proofs.json'))),
];
// This reviewed editorial profile is independent of the shared Next image optimizer.
const profile = { version: 2, format: 'avif', quality: 40, effort: 6, desktopWidths: [960, 1600, 2560], mobile: { '55-above-the-clouds': { widths: [480, 720], aspect: .5, position: .45 }, 'midnight-run': { widths: [640, 1280], aspect: 16 / 9, position: 1 }, 'sd25-hero': { widths: [640, 1280], aspect: 16 / 9, position: 0.5 }, 'fluxmax-hero': { widths: [640, 1280], aspect: 20 / 11, position: 0.5 } } };
const requestedSources = Object.fromEntries(process.argv.filter(arg => arg.startsWith('--source=')).map(arg => {
  const value = arg.slice(9); const index = value.indexOf('=');
  assert.ok(index > 0, 'Use --source=asset-id=/absolute/original');
  return [value.slice(0, index), value.slice(index + 1)];
}));
if (process.argv.includes('--write')) {
  const ids = Object.keys(requestedSources);
  assert.ok(ids.length > 0 && ids.every(id => id in profile.mobile), 'Select explicit reviewed hero sources');
  const previous = await readJson(manifestPath);
  const assets = previous.assets.filter(asset => asset.id in profile.mobile && !ids.includes(asset.id));
  for (const id of ids) {
    const original = originals.find(asset => asset.id === id)?.original;
    assert.ok(original, id);
    const bytes = await readFile(requestedSources[id]);
    assert.equal(hash(bytes), original.sha256, 'Source must be the reviewed exact original');
    const mobileProfile = profile.mobile[id];
    const cropWidth = Math.round(original.height * mobileProfile.aspect);
    const crop = { left: Math.round((original.width - cropWidth) * mobileProfile.position), top: 0, width: cropWidth, height: original.height };
    const folder = `/assets/model-examples/cinematic-heroes`;
    await mkdir(path.join(root, 'public', folder), { recursive: true });
    const render = async (width, mobile) => {
      let pipeline = sharp(bytes);
      if (mobile) pipeline = pipeline.extract(crop);
      const result = await pipeline.resize({ width, withoutEnlargement: true }).avif({ quality: profile.quality, effort: profile.effort }).toBuffer({ resolveWithObject: true });
      const sha256 = hash(result.data); const url = `${folder}/${sha256}.avif`;
      await writeFile(path.join(root, 'public', url), result.data, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      return { url, sha256, width: result.info.width, height: result.info.height, bytes: result.data.length };
    };
    const desktop = []; const mobile = [];
    for (const width of profile.desktopWidths) desktop.push(await render(width, false));
    for (const width of mobileProfile.widths) mobile.push(await render(width, true));
    assets.push({ id, originalSha256: original.sha256, crop, desktop, mobile });
  }
  await writeFile(manifestPath, JSON.stringify({ profile, assets: assets.sort((a, b) => a.id.localeCompare(b.id)) }, null, 2) + '\n');
}
const manifest = await readJson(manifestPath);
assert.deepEqual(manifest.profile, profile);
assert.deepEqual(manifest.assets.map(asset => asset.id).sort(), Object.keys(profile.mobile).sort());
for (const asset of manifest.assets) {
  assert.equal(asset.originalSha256, originals.find(original => original.id === asset.id)?.original.sha256);
  for (const file of [...asset.desktop, ...asset.mobile]) {
    const bytes = await readFile(path.join(root, 'public', file.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(hash(bytes), file.sha256); assert.equal(bytes.length, file.bytes);
    assert.equal(metadata.width, file.width); assert.equal(metadata.height, file.height);
    assert.ok(file.url.endsWith(`/${file.sha256}.avif`));
  }
}
console.log(`Cinematic hero displays verified: ${manifest.assets.length} exact originals and their immutable responsive AVIF files.`);
