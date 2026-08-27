import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

function dimensions(width, height, format) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`Malformed ${format} image dimensions`);
  }
  return { width, height, format };
}

function readPngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Malformed PNG image');
  }
  if (bytes.readUInt32BE(8) !== 13) throw new Error('Malformed PNG IHDR chunk');
  const imageDimensions = dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20), 'png');
  let offset = 8;
  let foundIend = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Malformed PNG chunk');
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > bytes.length) throw new Error('Malformed PNG chunk');
    if (chunkType === 'IEND') {
      if (chunkLength !== 0 || chunkEnd !== bytes.length) throw new Error('Malformed PNG IEND chunk');
      foundIend = true;
      break;
    }
    offset = chunkEnd;
  }
  if (!foundIend) throw new Error('PNG image is missing a complete IEND chunk');
  return imageDimensions;
}

function readJpegDimensions(bytes) {
  if (bytes.length < 6 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error('Malformed JPEG image');
  }

  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error('Malformed JPEG marker');
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new Error('Malformed JPEG segment');
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) throw new Error('Malformed JPEG segment');
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 8) throw new Error('Malformed JPEG frame');
      return dimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3), 'jpeg');
    }
    offset += segmentLength;
  }
  throw new Error('JPEG image does not contain a start-of-frame segment');
}

function readWebpDimensions(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) {
    throw new Error('Malformed WebP image');
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString('ascii', offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) throw new Error('Malformed WebP chunk');

    if (chunkType === 'VP8X') {
      if (chunkLength < 10) throw new Error('Malformed WebP VP8X chunk');
      return dimensions(bytes.readUIntLE(chunkStart + 4, 3) + 1, bytes.readUIntLE(chunkStart + 7, 3) + 1, 'webp');
    }
    if (chunkType === 'VP8 ') {
      if (chunkLength < 10 || !bytes.subarray(chunkStart + 3, chunkStart + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
        throw new Error('Malformed WebP VP8 chunk');
      }
      return dimensions(bytes.readUInt16LE(chunkStart + 6) & 0x3fff, bytes.readUInt16LE(chunkStart + 8) & 0x3fff, 'webp');
    }
    if (chunkType === 'VP8L') {
      if (chunkLength < 5 || bytes[chunkStart] !== 0x2f) throw new Error('Malformed WebP VP8L chunk');
      const packed = bytes.readUInt32LE(chunkStart + 1);
      return dimensions((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1, 'webp');
    }
    offset = chunkEnd + (chunkLength % 2);
  }
  throw new Error('WebP image does not contain a supported dimensions chunk');
}

export function readImageDimensions(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Image bytes must be a Buffer');
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return readPngDimensions(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegDimensions(bytes);
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return readWebpDimensions(bytes);
  throw new Error('Unsupported image format; expected PNG, JPEG, or WebP');
}

export function describeGithubAsset(assetPath, { rootDirectory = repositoryRoot } = {}) {
  if (typeof assetPath !== 'string' || path.isAbsolute(assetPath) || assetPath.includes('\\') || assetPath.split('/').includes('..')) {
    throw new Error(`Asset path must be a safe repository-relative path: ${assetPath}`);
  }
  const absolutePath = path.resolve(rootDirectory, assetPath);
  if (!absolutePath.startsWith(`${rootDirectory}${path.sep}`)) {
    throw new Error(`Asset path escapes the repository: ${assetPath}`);
  }
  const bytes = readFileSync(absolutePath);
  const { width, height, format } = readImageDimensions(bytes);
  return {
    path: assetPath,
    width,
    height,
    format,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function runRegistration(argumentsList = process.argv.slice(2)) {
  const [assetPath, ...unsupported] = argumentsList.filter((argument) => argument !== '--');
  if (!assetPath || unsupported.length > 0) {
    throw new Error('Usage: node scripts/register-github-asset.mjs <repository-relative PNG, JPEG, or WebP path>');
  }
  process.stdout.write(`${JSON.stringify(describeGithubAsset(assetPath), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runRegistration();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
