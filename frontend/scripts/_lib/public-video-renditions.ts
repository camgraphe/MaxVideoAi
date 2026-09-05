import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

import profileConfig from '../../config/public-video-rendition-profiles.json';
import type {
  PublicVideoRenditionProfile,
  PublicVideoRenditionProjection,
} from '../../lib/public-video-renditions';
import {
  activatePublishedManifestState,
  buildPublicProjectionState,
  checkPublicVideoStateFiles,
  persistActivatedStateFiles,
  validatePublishedManifestState,
} from './public-video-rendition-state';

export type PublicVideoProfileVersion = 'public-demo-v1';
export const PUBLIC_VIDEO_PROFILE_VERSION = profileConfig.version as PublicVideoProfileVersion;
export const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 120_000;
export const PROCESS_TIMEOUT_MS = 180_000;

export const PUBLIC_VIDEO_PROFILES = {
  desktop: {
    ...profileConfig.profiles.desktop,
    width: profileConfig.profiles.desktop.maxWidth,
    height: profileConfig.profiles.desktop.maxHeight,
  },
  mobile: {
    ...profileConfig.profiles.mobile,
    width: profileConfig.profiles.mobile.maxWidth,
    height: profileConfig.profiles.mobile.maxHeight,
  },
} as const;

if (
  profileConfig.schemaVersion !== 1 || profileConfig.version !== 'public-demo-v1' ||
  profileConfig.profiles.desktop.maxWidth !== 1920 || profileConfig.profiles.desktop.maxHeight !== 1080 ||
  profileConfig.profiles.desktop.crf !== 20 || profileConfig.profiles.mobile.maxWidth !== 1280 ||
  profileConfig.profiles.mobile.maxHeight !== 720 || profileConfig.profiles.mobile.crf !== 22 ||
  profileConfig.profiles.desktop.videoCodec !== 'libx264' || profileConfig.profiles.mobile.videoCodec !== 'libx264' ||
  profileConfig.profiles.desktop.preset !== 'slow' || profileConfig.profiles.mobile.preset !== 'slow' ||
  profileConfig.profiles.desktop.pixelFormat !== 'yuv420p' || profileConfig.profiles.mobile.pixelFormat !== 'yuv420p' ||
  profileConfig.profiles.desktop.gopSeconds !== 2 || profileConfig.profiles.mobile.gopSeconds !== 2 ||
  profileConfig.profiles.desktop.sceneCut || profileConfig.profiles.mobile.sceneCut ||
  profileConfig.profiles.desktop.threads !== 2 || profileConfig.profiles.mobile.threads !== 2 ||
  profileConfig.profiles.desktop.audio !== 'copy-aac' || profileConfig.profiles.mobile.audio !== 'copy-aac' ||
  !profileConfig.profiles.desktop.fastStart || !profileConfig.profiles.mobile.fastStart
) {
  throw new Error('Unsupported public video rendition profile definition');
}

export type Rational = { numerator: number; denominator: number };
export type AudioProbe = {
  codec: 'aac';
  channels: number;
  sampleRateHz: number;
  durationSeconds: number;
  startSeconds: number;
  packetPayloadSha256: string;
};
export type FrameCadenceProbe = {
  kind: 'cfr';
  firstTimestampSeconds: number;
  lastTimestampSeconds: number;
  minDeltaSeconds: number;
  maxDeltaSeconds: number;
  timestampsSha256: string;
};
export type MediaProbe = {
  width: number;
  height: number;
  durationSeconds: number;
  containerDurationSeconds: number;
  videoStartSeconds: number;
  videoFrameCount: number;
  cadence: FrameCadenceProbe;
  frameRate: Rational;
  videoCodec: 'h264';
  pixelFormat: 'yuv420p';
  sampleAspectRatio: Rational;
  colorTransfer: string | null;
  rotationDegrees: number;
  audio: AudioProbe | null;
  fastStart: boolean;
  decodeOk: boolean;
};

export type PublicVideoSource = {
  assetId: string;
  role: 'public-demo';
  url: string;
  sha256: string;
};

export type HttpCheckEvidence = {
  checkedAt: string;
  contentType: 'video/mp4';
  bytes: number;
  rangeStart: number;
  rangeEnd: number;
  totalBytes: number;
};

export type PublishedRendition = {
  profileVersion: PublicVideoProfileVersion;
  url: string;
  storageKey: string;
  sha256: string;
  bytes: number;
  probe: MediaProbe;
  visualReview: { reviewedAt: string; evidence: string } | null;
  httpCheck: HttpCheckEvidence | null;
  activatedAt: string | null;
};

export type PublishedManifest = {
  schemaVersion: 1;
  profileVersion: PublicVideoProfileVersion;
  entries: Array<{
    assetId: string;
    role: 'public-demo';
    original: { url: string; sha256: string; bytes: number; probe: MediaProbe };
    renditions: Partial<Record<PublicVideoRenditionProfile, PublishedRendition>>;
    pendingRenditions: Partial<Record<PublicVideoRenditionProfile, PublishedRendition>>;
    omissions: Array<{ profile: PublicVideoRenditionProfile; reason: string }>;
    failures: Array<{ profile: PublicVideoRenditionProfile; reason: string; retryable: true }>;
  }>;
};

export type PreparedCheckpoint = {
  schemaVersion: 1;
  assetId: string;
  role: 'public-demo';
  profileVersion: PublicVideoProfileVersion;
  original: {
    url: string;
    sha256: string;
    bytes: number;
    path: string;
    probe: MediaProbe;
  };
  renditions: Partial<Record<PublicVideoRenditionProfile, {
    profileVersion: PublicVideoProfileVersion;
    path: string;
    sha256: string;
    bytes: number;
    probe: MediaProbe;
  }>>;
  omissions: Array<{ profile: PublicVideoRenditionProfile; reason: string }>;
  failures: Array<{ profile: PublicVideoRenditionProfile; reason: string; retryable: true }>;
};

export class RenditionOmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenditionOmissionError';
  }
}

export type PublicVideoRenditionOptions = {
  mode: 'prepare' | 'publish' | 'check' | 'activate';
  workDir?: string;
  assetIds: string[];
  maxAssets: number;
  http: boolean;
  reviewEvidence?: string;
};

export function summarizePreparedCheckpoints(checkpoints: PreparedCheckpoint[]): {
  assets: number;
  acceptedProfiles: number;
  omittedProfiles: number;
  failedProfiles: number;
} {
  return checkpoints.reduce((summary, checkpoint) => {
    summary.assets += 1;
    summary.acceptedProfiles += Number(Boolean(checkpoint.renditions.desktop)) + Number(Boolean(checkpoint.renditions.mobile));
    summary.omittedProfiles += checkpoint.omissions.length;
    summary.failedProfiles += checkpoint.failures.length;
    return summary;
  }, { assets: 0, acceptedProfiles: 0, omittedProfiles: 0, failedProfiles: 0 });
}

function parsePositiveInteger(raw: string, label: string, maximum: number): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function readFlagValue(args: string[], index: number, flag: string): { value: string; consumed: number } | null {
  if (args[index] === `--${flag}`) return { value: args[index + 1] ?? '', consumed: 2 };
  const prefix = `--${flag}=`;
  if (args[index]?.startsWith(prefix)) return { value: args[index]!.slice(prefix.length), consumed: 1 };
  return null;
}

export function parsePublicVideoRenditionOptions(args: string[]): PublicVideoRenditionOptions {
  const modes = args.filter((argument) => ['prepare', 'publish', 'check', 'activate'].includes(argument));
  if (modes.length > 1) throw new Error('Provide at most one mode');
  const mode = (modes[0] ?? 'check') as PublicVideoRenditionOptions['mode'];
  let workDir: string | undefined;
  let maxAssets = 5;
  let maxProvided = false;
  let http = false;
  let reviewEvidence: string | undefined;
  const assetIds: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < args.length;) {
    const argument = args[index]!;
    if (['prepare', 'publish', 'check', 'activate'].includes(argument)) {
      index += 1;
      continue;
    }
    if (argument === '--http') {
      if (http) throw new Error('--http may only be provided once');
      http = true;
      index += 1;
      continue;
    }
    let matched = false;
    for (const flag of ['work-dir', 'asset-id', 'max-assets', 'review-evidence'] as const) {
      const found = readFlagValue(args, index, flag);
      if (!found) continue;
      if (!found.value) throw new Error(`--${flag} requires a value`);
      if (flag === 'work-dir') {
        if (workDir !== undefined) throw new Error('--work-dir may only be provided once');
        workDir = found.value;
      } else if (flag === 'asset-id') {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(found.value)) throw new Error('Invalid asset ID');
        if (seen.has(found.value)) throw new Error(`Duplicate asset ID: ${found.value}`);
        seen.add(found.value);
        assetIds.push(found.value);
      } else if (flag === 'max-assets') {
        if (maxProvided) throw new Error('--max-assets may only be provided once');
        maxProvided = true;
        maxAssets = parsePositiveInteger(found.value, 'max assets', 20);
      } else {
        if (reviewEvidence !== undefined) throw new Error('--review-evidence may only be provided once');
        reviewEvidence = found.value.trim();
        if (!reviewEvidence) throw new Error('--review-evidence requires a non-empty value');
      }
      index += found.consumed;
      matched = true;
      break;
    }
    if (!matched) throw new Error(`Unknown option: ${argument}`);
  }

  if ((mode === 'prepare' || mode === 'publish') && !workDir) {
    throw new Error('--work-dir is required for prepare and publish');
  }
  if (mode === 'check' && workDir) throw new Error('--work-dir is not valid for check');
  if (mode !== 'publish' && reviewEvidence !== undefined) throw new Error('--review-evidence is only valid for publish');
  if (mode === 'publish' && !reviewEvidence) throw new Error('--review-evidence is required for publish');
  if (mode !== 'check' && http) throw new Error('--http is only valid for check');
  return { mode, ...(workDir ? { workDir } : {}), assetIds, maxAssets, http, ...(reviewEvidence ? { reviewEvidence } : {}) };
}

function parseFinitePositive(raw: unknown, label: string): number {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
  return value;
}

function parseFinite(raw: unknown, label: string): number {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function parseRational(raw: unknown, separator: '/' | ':', label: string): Rational {
  if (typeof raw !== 'string') throw new Error(`${label} must be rational`);
  const match = raw.match(separator === '/' ? /^(\d+)\/(\d+)$/ : /^(\d+):(\d+)$/);
  if (!match) throw new Error(`${label} must be rational`);
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!numerator || !denominator) throw new Error(`${label} must be rational`);
  return { numerator, denominator };
}

type FfprobeStream = Record<string, unknown> & { codec_type?: unknown };

function buildCadenceProbe(framesInput: unknown, frameRate: Rational): FrameCadenceProbe & { frameCount: number } {
  const supported = [[24, 1], [25, 1], [30, 1]].some(
    ([numerator, denominator]) => rationalEqual(frameRate, { numerator: numerator!, denominator: denominator! })
  );
  if (!supported) throw new Error('Only constant 24, 25, or 30 fps input is supported');
  if (!Array.isArray(framesInput)) throw new Error('Bounded video frame timing evidence is required');
  const frames = (framesInput as Array<Record<string, unknown>>).filter((frame) => frame.media_type === 'video');
  if (frames.length < 2 || frames.length > 3600) throw new Error('Video frame evidence must contain 2 to 3600 frames');
  const timestamps = frames.map((frame) => parseFinite(
    frame.best_effort_timestamp_time ?? frame.pts_time ?? frame.pkt_dts_time,
    'video frame timestamp'
  ));
  const deltas = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]!);
  if (deltas.some((delta) => delta <= 0)) throw new Error('Video frame timestamps must increase');
  const expectedDelta = frameRate.denominator / frameRate.numerator;
  const tolerance = Math.max(0.0001, expectedDelta * 0.01);
  if (deltas.some((delta) => Math.abs(delta - expectedDelta) > tolerance)) {
    throw new Error('Unsupported variable frame cadence');
  }
  return {
    kind: 'cfr',
    frameCount: frames.length,
    firstTimestampSeconds: timestamps[0]!,
    lastTimestampSeconds: timestamps[timestamps.length - 1]!,
    minDeltaSeconds: Math.min(...deltas),
    maxDeltaSeconds: Math.max(...deltas),
    timestampsSha256: createHash('sha256').update(timestamps.map((value) => value.toFixed(6)).join('\n')).digest('hex'),
  };
}

export function parseFfprobeJson(
  input: string | unknown,
  options: { audioPacketPayloadSha256?: string | null } = {}
): MediaProbe {
  let parsed: { streams?: unknown; format?: unknown; frames?: unknown };
  try {
    parsed = (typeof input === 'string' ? JSON.parse(input) : input) as { streams?: unknown; format?: unknown; frames?: unknown };
  } catch {
    throw new Error('Expected valid ffprobe JSON');
  }
  if (!parsed || !Array.isArray(parsed.streams) || !parsed.format || typeof parsed.format !== 'object') {
    throw new Error('Expected valid ffprobe JSON with streams and format');
  }
  const streams = parsed.streams as FfprobeStream[];
  const videos = streams.filter((stream) => stream.codec_type === 'video');
  if (videos.length !== 1) throw new Error('Expected exactly one video stream');
  const video = videos[0]!;
  if (video.codec_name !== 'h264') throw new Error('Only H.264 input is supported');
  if (video.pix_fmt !== 'yuv420p') throw new Error('Only yuv420p input is supported');
  if ([video.color_primaries, video.color_space].some((value) => typeof value === 'string' && value.toLowerCase().includes('bt2020'))) {
    throw new Error('HDR color characteristics are unsupported');
  }
  const width = parsePositiveInteger(String(video.width), 'video width', 16_384);
  const height = parsePositiveInteger(String(video.height), 'video height', 16_384);
  const frameRate = parseRational(video.avg_frame_rate ?? video.r_frame_rate, '/', 'frame rate');
  const sampleAspectRatio = parseRational(video.sample_aspect_ratio ?? '1:1', ':', 'sample aspect ratio');
  if (sampleAspectRatio.numerator !== sampleAspectRatio.denominator) throw new Error('Only square pixels are supported');
  const colorTransfer = typeof video.color_transfer === 'string' ? video.color_transfer : null;
  if (colorTransfer && !['bt709', 'unknown'].includes(colorTransfer)) throw new Error('HDR transfer characteristics are unsupported');
  const tags = video.tags && typeof video.tags === 'object' ? video.tags as Record<string, unknown> : {};
  const sideData = Array.isArray(video.side_data_list) ? video.side_data_list as Array<Record<string, unknown>> : [];
  const rotationDegrees = Number(tags.rotate ?? sideData.find((entry) => entry.rotation !== undefined)?.rotation ?? 0);
  if (!Number.isFinite(rotationDegrees) || rotationDegrees !== 0) throw new Error('Rotated input is unsupported');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  if (audioStreams.length > 1) throw new Error('Only zero or one audio stream is supported');
  if (audioStreams[0]?.codec_name !== undefined && audioStreams[0].codec_name !== 'aac') {
    throw new Error('Only AAC input audio is supported');
  }
  const cadence = buildCadenceProbe(parsed.frames, frameRate);
  let audio: AudioProbe | null = null;
  if (audioStreams.length === 1) {
    const stream = audioStreams[0]!;
    if (!options.audioPacketPayloadSha256 || !/^[a-f0-9]{64}$/.test(options.audioPacketPayloadSha256)) {
      throw new Error('AAC packet payload measurement is required');
    }
    audio = {
      codec: 'aac',
      channels: parsePositiveInteger(String(stream.channels), 'audio channels', 32),
      sampleRateHz: parsePositiveInteger(String(stream.sample_rate), 'audio sample rate', 384_000),
      durationSeconds: parseFinitePositive(stream.duration ?? (parsed.format as Record<string, unknown>).duration, 'audio duration'),
      startSeconds: parseFinite(stream.start_time ?? 0, 'audio start time'),
      packetPayloadSha256: options.audioPacketPayloadSha256,
    };
  }
  const durationSeconds = parseFinitePositive(video.duration, 'video stream duration');
  if (durationSeconds > 60) throw new Error('Video duration exceeds the 60-second measurement limit');
  return {
    width,
    height,
    durationSeconds,
    containerDurationSeconds: parseFinitePositive((parsed.format as Record<string, unknown>).duration, 'container duration'),
    videoStartSeconds: parseFinite(video.start_time ?? cadence.firstTimestampSeconds, 'video start time'),
    videoFrameCount: cadence.frameCount,
    cadence,
    frameRate,
    videoCodec: 'h264',
    pixelFormat: 'yuv420p',
    sampleAspectRatio,
    colorTransfer,
    rotationDegrees,
    audio,
    fastStart: false,
    decodeOk: false,
  };
}

function rationalEqual(left: Rational, right: Rational): boolean {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}

export function buildFfmpegArguments(
  inputPath: string,
  outputPath: string,
  source: MediaProbe,
  profile: PublicVideoRenditionProfile
): string[] {
  const definition = PUBLIC_VIDEO_PROFILES[profile];
  const gop = Math.max(1, Math.round(definition.gopSeconds * source.frameRate.numerator / source.frameRate.denominator));
  return [
    '-hide_banner', '-nostdin', '-i', inputPath, '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `scale='min(${definition.width},iw)':'min(${definition.height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v', definition.videoCodec, '-preset', definition.preset, '-crf', String(definition.crf), '-pix_fmt', definition.pixelFormat,
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', definition.sceneCut ? '40' : '0',
    '-threads', String(definition.threads), '-c:a', 'copy',
    '-movflags', '+faststart', '-y', outputPath,
  ];
}

export function validatePreparedRendition(
  value: { sourceBytes: number; outputBytes: number; sourceProbe: MediaProbe; outputProbe: MediaProbe },
  profile: PublicVideoRenditionProfile
): void {
  const { sourceBytes, outputBytes, sourceProbe: source, outputProbe: output } = value;
  const bounds = PUBLIC_VIDEO_PROFILES[profile];
  if (!Number.isSafeInteger(sourceBytes) || sourceBytes <= 0 || !Number.isSafeInteger(outputBytes) || outputBytes <= 0) {
    throw new Error('Source and output byte sizes must be positive integers');
  }
  if (outputBytes > Math.floor(sourceBytes * 0.85)) throw new RenditionOmissionError('Rendition must save at least 15% of source bytes');
  if (output.width > source.width || output.height > source.height) throw new Error('Rendition must not upscale');
  if (output.width > bounds.width || output.height > bounds.height || output.width % 2 || output.height % 2) {
    throw new Error('Rendition dimensions violate profile bounds');
  }
  const sourceRatio = source.width / source.height;
  const outputRatio = output.width / output.height;
  if (Math.abs(sourceRatio - outputRatio) > 2 / Math.min(output.width, output.height)) {
    throw new Error('Rendition aspect ratio changed');
  }
  if (!rationalEqual(source.frameRate, output.frameRate)) throw new Error('Rendition cadence changed');
  if (
    source.videoFrameCount !== output.videoFrameCount ||
    source.cadence.timestampsSha256 !== output.cadence.timestampsSha256 ||
    Math.abs(source.videoStartSeconds - output.videoStartSeconds) > 0.001
  ) throw new Error('Rendition frame timeline changed');
  if (Math.abs(source.durationSeconds - output.durationSeconds) > 0.15) throw new Error('Rendition duration changed');
  if (source.videoCodec !== output.videoCodec || output.videoCodec !== 'h264' || output.pixelFormat !== 'yuv420p') {
    throw new Error('Rendition video format is unsupported');
  }
  if (!output.decodeOk) throw new Error('Rendition decode check failed');
  if (!output.fastStart) throw new Error('Rendition is not faststart');
  if (source.audio === null !== (output.audio === null)) throw new Error('Rendition audio presence changed');
  if (source.audio && output.audio && (
    output.audio.codec !== 'aac' || source.audio.channels !== output.audio.channels ||
    source.audio.sampleRateHz !== output.audio.sampleRateHz ||
    Math.abs(source.audio.durationSeconds - output.audio.durationSeconds) > 0.001 ||
    Math.abs(source.audio.startSeconds - output.audio.startSeconds) > 0.001 ||
    source.audio.packetPayloadSha256 !== output.audio.packetPayloadSha256
  )) throw new Error('Rendition audio changed');
}

export function inspectMp4TopLevelBoxes(bytes: Buffer): { fastStart: boolean; boxes: Array<{ type: string; offset: number; size: number }> } {
  const boxes: Array<{ type: string; offset: number; size: number }> = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes.length - offset < 8) throw new Error('MP4 box header exceeds bounds');
    const compactSize = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    let size: number;
    if (compactSize === 1) {
      if (bytes.length - offset < 16) throw new Error('Extended MP4 box header exceeds bounds');
      const extended = bytes.readBigUInt64BE(offset + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Extended MP4 box size exceeds finite bounds');
      size = Number(extended);
      headerSize = 16;
    } else if (compactSize === 0) {
      size = bytes.length - offset;
    } else {
      size = compactSize;
    }
    if (size < headerSize || size > bytes.length - offset) throw new Error(`MP4 box ${type} exceeds bounds`);
    boxes.push({ type, offset, size });
    offset += size;
  }
  const moov = boxes.findIndex((box) => box.type === 'moov');
  const mdat = boxes.findIndex((box) => box.type === 'mdat');
  return { fastStart: moov >= 0 && (mdat < 0 || moov < mdat), boxes };
}

export function hashAdtsPacketPayloads(input: Buffer): string {
  const hash = createHash('sha256');
  let offset = 0;
  let packets = 0;
  while (offset < input.length) {
    if (offset + 7 > input.length || input[offset] !== 0xff || (input[offset + 1]! & 0xf6) !== 0xf0) {
      throw new Error('Invalid bounded ADTS packet stream');
    }
    const headerBytes = (input[offset + 1]! & 0x01) === 1 ? 7 : 9;
    const packetBytes = ((input[offset + 3]! & 0x03) << 11) | (input[offset + 4]! << 3) | (input[offset + 5]! >> 5);
    if (packetBytes < headerBytes || offset + packetBytes > input.length) throw new Error('Invalid bounded ADTS packet length');
    const payloadBytes = packetBytes - headerBytes;
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(payloadBytes);
    hash.update(length);
    hash.update(input.subarray(offset + headerBytes, offset + packetBytes));
    packets += 1;
    offset += packetBytes;
  }
  if (packets === 0) throw new Error('AAC stream has no packet payloads');
  return hash.digest('hex');
}

const ALLOWED_PUBLIC_VIDEO_ORIGINS = new Set([
  'https://media.maxvideoai.com',
  'https://videohub-uploads-us.s3.amazonaws.com',
]);

export function assertAllowedPublicMp4Url(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Expected an allowed public media URL'); }
  if (!ALLOWED_PUBLIC_VIDEO_ORIGINS.has(url.origin) || url.username || url.password || url.search || url.hash) {
    throw new Error('Expected an allowed public media URL without credentials, query, or fragment');
  }
  if (!url.pathname.toLowerCase().endsWith('.mp4') || url.pathname.includes('/../') || url.pathname.includes('/./')) {
    throw new Error('Expected an immutable MP4 path');
  }
  return url;
}

export function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA256`);
}

export function validatePublicVideoSources(sources: PublicVideoSource[]): void {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('Public video source list must not be empty');
  const ids = new Set<string>();
  const urls = new Set<string>();
  const hashes = new Set<string>();
  for (const source of sources) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.assetId)) throw new Error(`Invalid public video asset ID: ${source.assetId}`);
    if (source.role !== 'public-demo') throw new Error(`Invalid public video role for ${source.assetId}`);
    assertAllowedPublicMp4Url(source.url);
    assertSha256(source.sha256, 'Source hash');
    if (ids.has(source.assetId)) throw new Error(`Duplicate source asset ID: ${source.assetId}`);
    if (urls.has(source.url)) throw new Error(`Duplicate source URL: ${source.url}`);
    if (hashes.has(source.sha256)) throw new Error(`Duplicate source SHA256: ${source.sha256}`);
    ids.add(source.assetId);
    urls.add(source.url);
    hashes.add(source.sha256);
  }
}

export function assertProbeShape(probe: MediaProbe): void {
  if (!probe || probe.videoCodec !== 'h264' || probe.pixelFormat !== 'yuv420p') throw new Error('Invalid measured probe');
  if (![probe.width, probe.height, probe.durationSeconds, probe.containerDurationSeconds, probe.videoFrameCount, probe.frameRate?.numerator, probe.frameRate?.denominator].every((value) => Number.isFinite(value) && Number(value) > 0)) {
    throw new Error('Invalid measured probe values');
  }
  if (probe.sampleAspectRatio?.numerator !== probe.sampleAspectRatio?.denominator || probe.rotationDegrees !== 0) {
    throw new Error('Invalid measured display geometry');
  }
  if (typeof probe.fastStart !== 'boolean' || typeof probe.decodeOk !== 'boolean' || !probe.decodeOk) {
    throw new Error('Invalid measured decode or faststart status');
  }
  if (
    probe.cadence?.kind !== 'cfr' || !/^[a-f0-9]{64}$/.test(probe.cadence.timestampsSha256) ||
    !Number.isFinite(probe.videoStartSeconds)
  ) throw new Error('Invalid measured frame timeline');
  if (probe.audio && (
    probe.audio.codec !== 'aac' || !Number.isSafeInteger(probe.audio.channels) || probe.audio.channels <= 0 ||
    !Number.isSafeInteger(probe.audio.sampleRateHz) || probe.audio.sampleRateHz <= 0 ||
    !Number.isFinite(probe.audio.durationSeconds) || probe.audio.durationSeconds <= 0 ||
    !Number.isFinite(probe.audio.startSeconds) || !/^[a-f0-9]{64}$/.test(probe.audio.packetPayloadSha256)
  )) throw new Error('Invalid measured audio probe');
}

export function validatePublishedManifest(manifest: PublishedManifest, sources: PublicVideoSource[]): void {
  validatePublishedManifestState(manifest, sources);
}

export function buildPublicProjection(manifest: PublishedManifest): PublicVideoRenditionProjection {
  return buildPublicProjectionState(manifest);
}

export function checkPublicVideoState(input: {
  sources: PublicVideoSource[];
  manifest: PublishedManifest;
  projection: PublicVideoRenditionProjection;
}): void {
  checkPublicVideoStateFiles(input);
}

export async function activatePublishedManifest(
  manifest: PublishedManifest,
  sources: PublicVideoSource[],
  dependencies: {
    verifyHttp: (url: string, expectedBytes: number) => Promise<HttpCheckEvidence>;
    now?: () => Date;
    assetIds?: ReadonlySet<string>;
  }
): Promise<{ manifest: PublishedManifest; projection: PublicVideoRenditionProjection }> {
  return activatePublishedManifestState(manifest, sources, dependencies);
}

export async function persistActivatedState(
  manifest: PublishedManifest,
  _currentProjection: PublicVideoRenditionProjection,
  sources: PublicVideoSource[],
  dependencies: {
    verifyHttp: (url: string, expectedBytes: number) => Promise<HttpCheckEvidence>;
    writeManifest: (manifest: PublishedManifest) => Promise<void>;
    writeProjection: (projection: PublicVideoRenditionProjection) => Promise<void>;
    now?: () => Date;
    assetIds?: ReadonlySet<string>;
  }
): Promise<{ manifest: PublishedManifest; projection: PublicVideoRenditionProjection }> {
  return persistActivatedStateFiles(manifest, sources, dependencies);
}

function isPreconditionConflict(error: unknown): boolean {
  return (error as { context?: { code?: unknown } } | null)?.context?.code === 'precondition-conflict';
}

async function verifyMeasuredFile(
  filePath: string,
  expectedBytes: number,
  expectedSha256: string,
  expectedProbe: MediaProbe,
  label: string,
  measureFile: (filePath: string) => Promise<MediaProbe>
): Promise<void> {
  let metadata;
  try {
    metadata = await stat(filePath);
  } catch {
    throw new Error(`${label} file is missing`);
  }
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_DOWNLOAD_BYTES) {
    throw new Error(`${label} file has invalid bounded size`);
  }
  if (metadata.size !== expectedBytes) throw new Error(`${label} file byte size differs from checkpoint`);
  const bytes = await readFile(filePath);
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    throw new Error(`${label} file hash differs from checkpoint`);
  }
  const measured = await measureFile(filePath);
  if (!probesEqual(measured, expectedProbe)) throw new Error(`${label} measured probe differs from checkpoint`);
}

export async function publishPreparedCheckpoints(
  checkpoints: PreparedCheckpoint[],
  existingManifest: PublishedManifest,
  reviewEvidence: string,
  dependencies: {
    upload: (input: {
      key: string;
      data: Buffer;
      mime: 'video/mp4';
      cacheControl: string;
      acl: null;
      conditionalCreate: true;
      signal: AbortSignal;
    }) => Promise<{ key: string; url: string }>;
    readRemote: (url: string, maximumBytes: number) => Promise<Buffer>;
    measureFile: (filePath: string) => Promise<MediaProbe>;
    now?: () => Date;
    uploadTimeoutMs?: number;
  }
): Promise<PublishedManifest> {
  if (!reviewEvidence.trim()) throw new Error('Publishing requires explicit visual review evidence');
  if (existingManifest.schemaVersion !== 1 || existingManifest.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION) {
    throw new Error('Cannot publish into a stale manifest');
  }
  const manifest = structuredClone(existingManifest);
  const reviewTime = (dependencies.now ?? (() => new Date()))().toISOString();
  const checkpointIds = new Set<string>();
  for (const checkpoint of checkpoints) {
    if (checkpointIds.has(checkpoint.assetId)) throw new Error(`Duplicate prepared asset ID: ${checkpoint.assetId}`);
    checkpointIds.add(checkpoint.assetId);
  }
  // Complete bounded local remeasurement for every selected record before the first upload.
  for (const checkpoint of checkpoints) {
    if (checkpoint.schemaVersion !== 1 || checkpoint.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION || checkpoint.role !== 'public-demo') {
      throw new Error(`Stale or invalid prepared checkpoint for ${checkpoint.assetId}`);
    }
    assertAllowedPublicMp4Url(checkpoint.original.url);
    assertSha256(checkpoint.original.sha256, 'Prepared source hash');
    assertProbeShape(checkpoint.original.probe);
    await verifyMeasuredFile(
      checkpoint.original.path, checkpoint.original.bytes, checkpoint.original.sha256,
      checkpoint.original.probe, `${checkpoint.assetId} source`, dependencies.measureFile
    );
    for (const profile of ['desktop', 'mobile'] as const) {
      const prepared = checkpoint.renditions[profile];
      if (!prepared) continue;
      if (prepared.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION) throw new Error(`Stale prepared ${profile} profile`);
      assertSha256(prepared.sha256, 'Prepared rendition hash');
      assertProbeShape(prepared.probe);
      await verifyMeasuredFile(
        prepared.path, prepared.bytes, prepared.sha256, prepared.probe,
        `${checkpoint.assetId} ${profile}`, dependencies.measureFile
      );
      validatePreparedRendition({
        sourceBytes: checkpoint.original.bytes,
        outputBytes: prepared.bytes,
        sourceProbe: checkpoint.original.probe,
        outputProbe: prepared.probe,
      }, profile);
    }
  }
  for (const checkpoint of checkpoints) {
    const existingIndex = manifest.entries.findIndex((entry) => entry.assetId === checkpoint.assetId);
    const previous = existingIndex >= 0 ? manifest.entries[existingIndex]! : null;
    const activeRenditions = structuredClone(previous?.renditions ?? {});
    const pendingRenditions = structuredClone(previous?.pendingRenditions ?? {});
    for (const profile of ['desktop', 'mobile'] as const) {
      const prepared = checkpoint.renditions[profile];
      if (!prepared) {
        if (checkpoint.omissions.some((omission) => omission.profile === profile)) delete pendingRenditions[profile];
        continue;
      }
      const active = activeRenditions[profile];
      if (active?.sha256 === prepared.sha256 && active.bytes === prepared.bytes && probesEqual(active.probe, prepared.probe)) {
        delete pendingRenditions[profile];
        continue;
      }
      const pending = pendingRenditions[profile];
      if (pending?.sha256 === prepared.sha256 && pending.bytes === prepared.bytes && probesEqual(pending.probe, prepared.probe)) {
        continue;
      }
      const data = await readFile(prepared.path);
      const actualHash = createHash('sha256').update(data).digest('hex');
      if (data.byteLength !== prepared.bytes || actualHash !== prepared.sha256) {
        throw new Error(`Prepared ${checkpoint.assetId} ${profile} file differs from checkpoint`);
      }
      const key = `marketing/video-renditions/${checkpoint.original.sha256}/${PUBLIC_VIDEO_PROFILE_VERSION}/${profile}/${prepared.sha256}.mp4`;
      const url = `https://media.maxvideoai.com/${key}`;
      const controller = new AbortController();
      const timeoutMs = Math.min(dependencies.uploadTimeoutMs ?? 120_000, 180_000);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const uploaded = await dependencies.upload({
          key, data, mime: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable',
          acl: null, conditionalCreate: true, signal: controller.signal,
        });
        if (uploaded.key !== key) throw new Error('Storage returned a conflicting immutable identity');
      } catch (error) {
        if (!isPreconditionConflict(error)) throw error;
        const remote = await dependencies.readRemote(url, MAX_DOWNLOAD_BYTES);
        const remoteHash = createHash('sha256').update(remote).digest('hex');
        if (remote.byteLength !== prepared.bytes || remoteHash !== prepared.sha256) {
          throw new Error(`Existing remote object differs for ${checkpoint.assetId} ${profile}`);
        }
      } finally {
        clearTimeout(timer);
      }
      pendingRenditions[profile] = {
        profileVersion: PUBLIC_VIDEO_PROFILE_VERSION,
        url,
        storageKey: key,
        sha256: prepared.sha256,
        bytes: prepared.bytes,
        probe: prepared.probe,
        visualReview: { reviewedAt: reviewTime, evidence: reviewEvidence.trim() },
        httpCheck: null,
        activatedAt: null,
      };
    }
    const nextEntry: PublishedManifest['entries'][number] = {
      assetId: checkpoint.assetId,
      role: checkpoint.role,
      original: {
        url: checkpoint.original.url,
        sha256: checkpoint.original.sha256,
        bytes: checkpoint.original.bytes,
        probe: checkpoint.original.probe,
      },
      renditions: activeRenditions,
      pendingRenditions,
      omissions: checkpoint.omissions,
      failures: checkpoint.failures,
    };
    if (existingIndex >= 0) manifest.entries[existingIndex] = nextEntry;
    else manifest.entries.push(nextEntry);
  }
  return manifest;
}

async function responseWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchFn(url, { ...init, redirect: 'error', signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function readExactRangeBody(response: Response, expectedBytes: number): Promise<Buffer> {
  if (!response.body) throw new Error('Public rendition Range response has no body');
  const reader = response.body.getReader();
  const output = Buffer.alloc(expectedBytes);
  let offset = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (offset + chunk.value.byteLength > expectedBytes) {
      await reader.cancel('Range response exceeded the byte limit');
      throw new Error(`Public rendition Range body exceeds ${expectedBytes} bytes`);
    }
    output.set(chunk.value, offset);
    offset += chunk.value.byteLength;
  }
  if (offset !== expectedBytes) throw new Error('Public rendition Range body has invalid length');
  return output;
}

export async function verifyPublicHttpRendition(
  url: string,
  expectedBytes: number,
  dependencies: { fetchFn?: typeof fetch; now?: () => Date; timeoutMs?: number } = {}
): Promise<HttpCheckEvidence> {
  assertAllowedPublicMp4Url(url);
  const fetchFn = dependencies.fetchFn ?? fetch;
  const timeoutMs = Math.min(dependencies.timeoutMs ?? 15_000, 120_000);
  const head = await responseWithTimeout(fetchFn, url, { method: 'HEAD' }, timeoutMs);
  if (!head.ok) throw new Error(`Public rendition HEAD failed with ${head.status}`);
  if (head.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'video/mp4') throw new Error('Public rendition must be video/mp4');
  if (Number(head.headers.get('content-length')) !== expectedBytes) throw new Error('Public rendition content length differs from manifest');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const range = await fetchFn(url, { method: 'GET', headers: { Range: 'bytes=0-31' }, redirect: 'error', signal: controller.signal });
    if (range.status !== 206) throw new Error('Public rendition must support Range requests');
    if (range.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'video/mp4') {
      throw new Error('Public rendition Range response must be video/mp4');
    }
    const match = range.headers.get('content-range')?.match(/^bytes 0-31\/(\d+)$/);
    if (!match || Number(match[1]) !== expectedBytes) throw new Error('Public rendition returned an invalid Content-Range');
    if (Number(range.headers.get('content-length')) !== 32) throw new Error('Public rendition Range response has invalid length');
    const body = await readExactRangeBody(range, 32);
    if (body.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Public rendition Range body is not an MP4 prefix');
  } finally {
    clearTimeout(timer);
  }
  return {
    checkedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    contentType: 'video/mp4',
    bytes: expectedBytes,
    rangeStart: 0,
    rangeEnd: 31,
    totalBytes: expectedBytes,
  };
}

function probesEqual(left: MediaProbe, right: MediaProbe): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function verifyPreparedOutputForResume(
  record: { outputPath: string; expectedBytes: number; expectedSha256: string; expectedProbe: MediaProbe },
  dependencies: { probeFile: (filePath: string) => Promise<MediaProbe> }
): Promise<boolean> {
  try {
    const metadata = await stat(record.outputPath);
    if (!metadata.isFile() || metadata.size !== record.expectedBytes) return false;
    const bytes = await readFile(record.outputPath);
    if (createHash('sha256').update(bytes).digest('hex') !== record.expectedSha256) return false;
    const probe = await dependencies.probeFile(record.outputPath);
    return probe.decodeOk && probesEqual(probe, record.expectedProbe);
  } catch {
    return false;
  }
}
