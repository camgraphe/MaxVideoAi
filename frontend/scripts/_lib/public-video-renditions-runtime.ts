import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobe from 'ffprobe-static';

import { ensureExecutableFfmpegPath } from '../../server/ffmpeg-runtime';
import {
  assertAllowedPublicMp4Url,
  buildFfmpegArguments,
  DOWNLOAD_TIMEOUT_MS,
  hashAdtsPacketPayloads,
  inspectMp4TopLevelBoxes,
  MAX_DOWNLOAD_BYTES,
  parseFfprobeJson,
  PROCESS_TIMEOUT_MS,
  PUBLIC_VIDEO_PROFILE_VERSION,
  RenditionOmissionError,
  validatePublicVideoSources,
  validatePreparedRendition,
  verifyPreparedOutputForResume,
  type MediaProbe,
  type PreparedCheckpoint,
  type PublicVideoSource,
} from './public-video-renditions';

const execFileAsync = promisify(execFile);

export async function getPublicVideoFfmpegPath(): Promise<string> {
  return ensureExecutableFfmpegPath(ffmpegInstaller.path);
}

async function atomicWrite(filePath: string, data: Buffer | string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, data);
  await rename(temporary, filePath);
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function sha256File(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

export async function downloadPublicVideoToFile(
  sourceUrl: string,
  destination: string,
  dependencies: { fetchFn?: typeof fetch; maximumBytes?: number; timeoutMs?: number } = {}
): Promise<{ bytes: number; sha256: string }> {
  const fetchFn = dependencies.fetchFn ?? fetch;
  const maximumBytes = Math.min(dependencies.maximumBytes ?? MAX_DOWNLOAD_BYTES, MAX_DOWNLOAD_BYTES);
  const timeoutMs = Math.min(dependencies.timeoutMs ?? DOWNLOAD_TIMEOUT_MS, DOWNLOAD_TIMEOUT_MS);
  let current = assertAllowedPublicMp4Url(sourceUrl).toString();
  let response: Response | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirects = 0; redirects <= 4; redirects += 1) {
      response = await fetchFn(current, { redirect: 'manual', signal: controller.signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('Public video redirect is missing a Location header');
      current = assertAllowedPublicMp4Url(new URL(location, current).toString()).toString();
      response = null;
    }
    if (!response) throw new Error('Public video exceeded the redirect limit');
    if (!response.ok) throw new Error(`Public video download failed with ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (contentType !== 'video/mp4' && contentType !== 'application/octet-stream') throw new Error('Public source is not an MP4 response');
    const declaredBytes = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) throw new Error('Public video exceeds the 64 MiB download limit');
    if (!response.body) throw new Error('Public video response has no body');

    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.partial-${process.pid}`;
    const file = await open(temporary, 'w');
    const hash = createHash('sha256');
    let bytes = 0;
    try {
      const reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maximumBytes) {
          await reader.cancel();
          throw new Error('Public video exceeds the 64 MiB streamed download limit');
        }
        hash.update(chunk.value);
        await file.write(chunk.value);
      }
      if (bytes <= 0) throw new Error('Public video response is empty');
      await file.close();
      await rename(temporary, destination);
    } catch (error) {
      await file.close().catch(() => undefined);
      await rm(temporary, { force: true });
      throw error;
    }
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    clearTimeout(timer);
  }
}

async function runExecutable(executable: string, args: string[], timeoutMs = PROCESS_TIMEOUT_MS): Promise<{ stdout: string }> {
  return execFileAsync(executable, args, {
    timeout: Math.min(timeoutMs, PROCESS_TIMEOUT_MS),
    maxBuffer: 4 * 1024 * 1024,
    encoding: 'utf8',
  });
}

async function runExecutableBuffer(
  executable: string,
  args: string[],
  maximumBytes = MAX_DOWNLOAD_BYTES,
  timeoutMs = PROCESS_TIMEOUT_MS
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(Buffer.concat(stdout, stdoutBytes));
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`Media process exceeded ${Math.min(timeoutMs, PROCESS_TIMEOUT_MS)}ms`));
    }, Math.min(timeoutMs, PROCESS_TIMEOUT_MS));
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > Math.min(maximumBytes, MAX_DOWNLOAD_BYTES)) {
        child.kill('SIGKILL');
        finish(new Error('Media process output exceeded the byte limit'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const remaining = 1024 * 1024 - stderrBytes;
      if (remaining <= 0) return;
      const bounded = chunk.subarray(0, remaining);
      stderr.push(bounded);
      stderrBytes += bounded.byteLength;
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code === 0) finish();
      else finish(new Error(`Media process failed code=${code ?? 'none'} signal=${signal ?? 'none'}: ${Buffer.concat(stderr).toString('utf8')}`));
    });
  });
}

export async function probeMediaFile(filePath: string): Promise<MediaProbe> {
  const probeResult = await runExecutable(ffprobe.path, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-show_frames', filePath,
  ]);
  const rawProbe = JSON.parse(probeResult.stdout) as { streams?: Array<{ codec_type?: unknown }> };
  const hasAudio = rawProbe.streams?.some((stream) => stream.codec_type === 'audio') === true;
  const ffmpegPath = await getPublicVideoFfmpegPath();
  const audioPacketPayloadSha256 = hasAudio
    ? hashAdtsPacketPayloads(await runExecutableBuffer(ffmpegPath, [
        '-hide_banner', '-nostdin', '-v', 'error', '-i', filePath,
        '-map', '0:a:0', '-c:a', 'copy', '-f', 'adts', 'pipe:1',
      ]))
    : null;
  const parsed = parseFfprobeJson(probeResult.stdout, { audioPacketPayloadSha256 });
  const bytes = await readFile(filePath);
  const fastStart = inspectMp4TopLevelBoxes(bytes).fastStart;
  await runExecutable(ffmpegPath, [
    '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-i', filePath,
    '-map', '0:v:0', '-map', '0:a:0?', '-f', 'null', '-',
  ]);
  return { ...parsed, fastStart, decodeOk: true };
}

export async function encodePublicVideoRendition(
  sourcePath: string,
  outputPath: string,
  sourceProbe: MediaProbe,
  profile: 'desktop' | 'mobile'
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.partial-${process.pid}.mp4`;
  const ffmpegPath = await getPublicVideoFfmpegPath();
  try {
    await runExecutable(ffmpegPath, buildFfmpegArguments(sourcePath, temporary, sourceProbe, profile));
    await rename(temporary, outputPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function preparePublicVideoRenditions(
  input: { workDir: string; sources: PublicVideoSource[]; assetIds: string[]; maxAssets: number },
  dependencies: {
    download?: typeof downloadPublicVideoToFile;
    probe?: typeof probeMediaFile;
    encode?: typeof encodePublicVideoRendition;
  } = {}
): Promise<PreparedCheckpoint[]> {
  validatePublicVideoSources(input.sources);
  const download = dependencies.download ?? downloadPublicVideoToFile;
  const probe = dependencies.probe ?? probeMediaFile;
  const encode = dependencies.encode ?? encodePublicVideoRendition;
  const requested = input.assetIds.length ? new Set(input.assetIds) : null;
  if (requested) {
    for (const id of requested) if (!input.sources.some((source) => source.assetId === id)) throw new Error(`Unknown asset ID: ${id}`);
  }
  const selected = input.sources.filter((source) => !requested || requested.has(source.assetId)).slice(0, input.maxAssets);
  const checkpoints: PreparedCheckpoint[] = [];
  for (const source of selected) {
    const assetDir = path.join(input.workDir, source.assetId);
    const sourcePath = path.join(assetDir, 'source.mp4');
    const checkpointPath = path.join(assetDir, 'checkpoint.json');
    await mkdir(assetDir, { recursive: true });
    let sourceBytes = 0;
    let sourceHash = '';
    try {
      const sourceStat = await stat(sourcePath);
      sourceBytes = sourceStat.size;
      sourceHash = await sha256File(sourcePath);
    } catch {
      // Download below.
    }
    if (sourceHash !== source.sha256 || sourceBytes <= 0) {
      const downloaded = await download(source.url, sourcePath);
      sourceBytes = downloaded.bytes;
      sourceHash = downloaded.sha256;
    }
    if (sourceHash !== source.sha256) throw new Error(`Source hash mismatch for ${source.assetId}`);
    const sourceProbe = await probe(sourcePath);
    let checkpoint: PreparedCheckpoint = {
      schemaVersion: 1,
      assetId: source.assetId,
      role: source.role,
      profileVersion: PUBLIC_VIDEO_PROFILE_VERSION,
      original: { url: source.url, sha256: source.sha256, bytes: sourceBytes, path: sourcePath, probe: sourceProbe },
      renditions: {},
      omissions: [],
      failures: [],
    };
    try {
      const prior = JSON.parse(await readFile(checkpointPath, 'utf8')) as PreparedCheckpoint;
      if (prior.assetId === source.assetId && prior.profileVersion === PUBLIC_VIDEO_PROFILE_VERSION && prior.original.sha256 === source.sha256) {
        checkpoint = {
          ...checkpoint,
          renditions: prior.renditions ?? {},
          omissions: prior.omissions ?? [],
          failures: prior.failures ?? [],
        };
      }
    } catch {
      // A missing or malformed checkpoint is rebuilt from verified files.
    }
    for (const profile of ['desktop', 'mobile'] as const) {
      const outputPath = path.join(assetDir, `${profile}.mp4`);
      const prior = checkpoint.renditions[profile];
      if (prior && await verifyPreparedOutputForResume({
        outputPath,
        expectedBytes: prior.bytes,
        expectedSha256: prior.sha256,
        expectedProbe: prior.probe,
      }, { probeFile: probe })) continue;
      if (checkpoint.omissions.some((omission) => omission.profile === profile)) continue;
      delete checkpoint.renditions[profile];
      checkpoint.omissions = checkpoint.omissions.filter((omission) => omission.profile !== profile);
      checkpoint.failures = checkpoint.failures.filter((failure) => failure.profile !== profile);
      try {
        await encode(sourcePath, outputPath, sourceProbe, profile);
        const outputStat = await stat(outputPath);
        const outputHash = await sha256File(outputPath);
        const outputProbe = await probe(outputPath);
        validatePreparedRendition({ sourceBytes, outputBytes: outputStat.size, sourceProbe, outputProbe }, profile);
        checkpoint.renditions[profile] = {
          profileVersion: PUBLIC_VIDEO_PROFILE_VERSION,
          path: outputPath,
          sha256: outputHash,
          bytes: outputStat.size,
          probe: outputProbe,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (error instanceof RenditionOmissionError) checkpoint.omissions.push({ profile, reason });
        else checkpoint.failures.push({ profile, reason, retryable: true });
        await rm(outputPath, { force: true });
      }
      await atomicWriteJson(checkpointPath, checkpoint);
    }
    checkpoints.push(checkpoint);
  }
  return checkpoints;
}

export async function readRemoteBytes(
  url: string,
  maximumBytes = MAX_DOWNLOAD_BYTES,
  fetchFn: typeof fetch = fetch
): Promise<Buffer> {
  assertAllowedPublicMp4Url(url);
  maximumBytes = Math.min(maximumBytes, MAX_DOWNLOAD_BYTES);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Remote object verification failed with ${response.status}`);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('Remote object exceeds verification byte limit');
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error('Remote object exceeds streamed verification byte limit');
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
  } finally {
    clearTimeout(timer);
  }
}
