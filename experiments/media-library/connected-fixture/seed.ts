import { readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { sha, storageEnvironment } from './s3-signature';
import type { startStorage } from './s3-service';
export const owners = { a: '10000000-0000-4000-8000-000000000003', b: '10000000-0000-4000-8000-000000000001', empty: '10000000-0000-4000-8000-000000000002' };
export async function prepareSeed(root: string, storage: Awaited<ReturnType<typeof startStorage>>, destination: string) {
    const sharp = createRequire(join(root, 'frontend/package.json'))('sharp');
    const corpus = JSON.parse(await readFile(join(root, 'experiments/media-library/prototype/fixtures-notes.json'), 'utf8'));
    const assets: any[] = [];
    const outputs: any[] = [];
    const legacy: any[] = [];
    const physical: any[] = [];
    for (const entry of corpus.provenance) {
        const path = join(root, 'experiments/media-library/prototype/public', entry.original);
        const bytes = await readFile(path);
        let facts: any;
        if (entry.kind === 'image') {
            const metadata = await sharp(bytes).metadata();
            facts = { width: metadata.width, height: metadata.height };
        }
        else {
            const video = entry.originalFacts.streams.find((s: any) => s.codec_type === 'video');
            facts = { width: video?.width ?? null, height: video?.height ?? null, durationSec: Number(entry.originalFacts.format.duration) };
        }
        physical.push({ entry, bytes, facts, sha256: sha(bytes) });
    }
    // 132 ordinary source identities, 3 foreign rows and 3 independent legacy rows.
    for (let i = 0; i < 135; i++) {
        const p = physical[i % physical.length], userId = i < 132 ? owners.a : owners.b;
        const id = `fixture-${String(i).padStart(3, '0')}`, kind = p.entry.kind, ext = extname(p.entry.original);
        const key = `user-assets/${userId}/${id}${ext}`;
        const mime = kind === 'image' ? (ext === '.png' ? 'image/png' : 'image/webp') : kind === 'video' ? 'video/mp4' : 'audio/wav';
        await storage.put(key, p.bytes, mime, 'original');
        const url = `${storageEnvironment.S3_PUBLIC_BASE_URL}/${key}`;
        const metadata: any = { fileName: `${String(i).padStart(3, '0')} ${p.entry.slug}${ext}`, durationSec: p.facts.durationSec ?? null };
        let thumbUrl = null, previewUrl = null;
        if (kind !== 'audio' && i !== 10) {
            const source = join(root, 'experiments/media-library/prototype/public', p.entry.versions.thumb.url);
            const thumb = await readFile(source);
            const thumbKey = `user-asset-thumbs/${userId}/${id}.webp`;
            await storage.put(thumbKey, thumb, 'image/webp', 'thumbnail');
            thumbUrl = `${storageEnvironment.S3_PUBLIC_BASE_URL}/${thumbKey}`;
        }
        if (kind === 'image' && i !== 10) {
            const display = await sharp(p.bytes).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
            if (display.data.length < p.bytes.length) {
                const displayKey = `user-asset-thumbs/${userId}/${id}-display-v1.webp`;
                await storage.put(displayKey, display.data, 'image/webp', 'display');
                previewUrl = `${storageEnvironment.S3_PUBLIC_BASE_URL}/${displayKey}`;
                metadata.imageDisplay = { version: 1, profile: 'image-display-v1', sourceUrl: url, sourceSha256: p.sha256, url: previewUrl, mimeType: 'image/webp', width: display.info.width, height: display.info.height, sizeBytes: display.data.length };
            }
        }
        const row = { id, publicId: `ma_${sha(id).slice(0, 32)}`, userId, kind, url, thumbUrl, previewUrl, mimeType: mime, ...p.facts, sizeBytes: p.bytes.length, metadata, createdAt: new Date(Date.UTC(2026, 10, 8, 12, 0, 0) - Math.floor(i / 2) * 60000).toISOString() };
        if (i >= 96 && i < 132) {
            outputs.push({ ...row, jobId: `fixture-job-${Math.floor((i - 96) / 3)}`, position: (i - 96) % 3 });
            if (i % 3 === 0)
                assets.push({ ...row, source: 'saved_job_output', sourceOutputId: id, sourceJobId: `fixture-job-${Math.floor((i - 96) / 3)}` });
        }
        else
            assets.push({ ...row, source: 'upload' });
    }
    // Two distinct outputs intentionally share an exact original; neither is saved.
    const first = outputs.find(o => o.id === 'fixture-097'), second = outputs.find(o => o.id === 'fixture-098');
    second.url = first.url;
    second.thumbUrl = first.thumbUrl;
    second.sizeBytes = first.sizeBytes;
    second.durationSec = first.durationSec;
    second.kind = first.kind;
    second.mimeType = first.mimeType;
    second.width = first.width;
    second.height = first.height;
    second.previewUrl = first.previewUrl;
    second.metadata = { ...first.metadata, fileName: '098 distinct same-url output' };
    // Proven canonical/legacy mirror; independent legacy identities have distinct URLs.
    legacy.push({ ...assets[0], assetId: assets[0].id });
    for (let i = 0; i < 3; i++) {
        const base = assets[i + 1], key = `user-assets/${owners.a}/legacy-${i}${extname(new URL(base.url).pathname)}`;
        const original = storage.objects.get(new URL(base.url).pathname.slice('/fixture-bucket/'.length))!;
        await storage.put(key, await readFile(original.path), base.mimeType, 'original');
        legacy.push({ ...base, assetId: `fixture-legacy-${i}`, url: `${storageEnvironment.S3_PUBLIC_BASE_URL}/${key}`, metadata: { ...base.metadata, fileName: `Legacy ${i}` } });
    }
    const seed = { version: 1, owners, assets, outputs, legacy, physical: physical.map(p => ({ slug: p.entry.slug, sha256: p.sha256, facts: p.facts, bytes: p.bytes.length })), limitations: corpus.limitations };
    await writeFile(destination, JSON.stringify(seed, null, 2));
    return { seed, sha256: sha(JSON.stringify(seed)), physicalCount: physical.length };
}
