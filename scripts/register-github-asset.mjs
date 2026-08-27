import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegStartOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function dimensions(width, height, format) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error(`Malformed ${format} image dimensions`);
  return { width, height, format };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readPngDimensions(bytes) {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(pngSignature)) throw new Error('Malformed PNG image');
  let offset = 8;
  let imageDimensions = null;
  let foundIdat = false;
  let foundIend = false;
  let foundPlte = false;
  let idatEnded = false;
  let colorType = null;
  const idatChunks = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Malformed PNG chunk');
    const chunkLength = bytes.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.length) throw new Error('Malformed PNG chunk boundary');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(dataStart, dataEnd);
    if (bytes.readUInt32BE(dataEnd) !== crc32(bytes.subarray(offset + 4, dataEnd))) throw new Error('Malformed PNG CRC');
    if (imageDimensions === null) {
      if (type !== 'IHDR' || chunkLength !== 13) throw new Error('Malformed PNG IHDR ordering');
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      const allowedBitDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!allowedBitDepths[colorType]?.includes(bitDepth) || data[10] !== 0 || data[11] !== 0 || ![0, 1].includes(data[12])) {
        throw new Error('Malformed PNG IHDR data');
      }
      imageDimensions = dimensions(width, height, 'png');
    } else if (type === 'IHDR') {
      throw new Error('Malformed PNG duplicate IHDR');
    } else if (type === 'PLTE') {
      if (foundIdat || foundPlte || chunkLength === 0 || chunkLength % 3 !== 0 || colorType === 0 || colorType === 4) throw new Error('Malformed PNG PLTE ordering');
      foundPlte = true;
    } else if (type === 'IDAT') {
      if (foundIend || idatEnded || (colorType === 3 && !foundPlte)) throw new Error('Malformed PNG IDAT ordering');
      foundIdat = true;
      idatChunks.push(data);
    } else if (type === 'IEND') {
      if (chunkLength !== 0 || !foundIdat || (colorType === 3 && !foundPlte) || chunkEnd !== bytes.length) throw new Error('Malformed PNG IEND');
      foundIend = true;
      break;
    } else if (foundIdat) {
      idatEnded = true;
    }
    offset = chunkEnd;
  }
  if (!imageDimensions || !foundIend) throw new Error('Malformed PNG image structure');
  try {
    inflateSync(Buffer.concat(idatChunks));
  } catch {
    throw new Error('Malformed PNG IDAT data');
  }
  return imageDimensions;
}

function readJpegDimensions(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Malformed JPEG image');
  let offset = 2;
  let imageDimensions = null;
  let foundSos = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Malformed JPEG marker');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) throw new Error('Malformed JPEG missing SOS scan');
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) throw new Error('Malformed JPEG marker');
    if (offset + 2 > bytes.length) throw new Error('Malformed JPEG segment');
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) throw new Error('Malformed JPEG segment boundary');
    if (jpegStartOfFrameMarkers.has(marker)) {
      if (segmentLength < 8) throw new Error('Malformed JPEG frame');
      imageDimensions = dimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3), 'jpeg');
    }
    offset += segmentLength;
    if (marker !== 0xda) continue;
    if (!imageDimensions || segmentLength < 6) throw new Error('Malformed JPEG SOS');
    foundSos = true;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      if (byte !== 0xff) continue;
      if (offset >= bytes.length) throw new Error('Malformed JPEG scan');
      const scanMarker = bytes[offset++];
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) continue;
      if (scanMarker === 0xd9 && offset === bytes.length) return imageDimensions;
      throw new Error('Malformed JPEG scan marker');
    }
  }
  if (!foundSos) throw new Error('Malformed JPEG missing SOS scan');
  throw new Error('Malformed JPEG missing terminal EOI');
}

function readWebpDimensions(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Malformed WebP image');
  let offset = 12;
  let imageDimensions = null;
  let payloadDimensions = null;
  let foundImagePayload = false;
  let foundExtendedHeader = false;
  let foundPayloadAfterExtendedHeader = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Malformed WebP chunk');
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const paddedEnd = dataEnd + (length % 2);
    if (dataEnd < dataStart || paddedEnd > bytes.length) throw new Error('Malformed WebP chunk boundary');
    if (type === 'VP8X') {
      if (foundExtendedHeader || foundImagePayload || length !== 10 || (bytes[dataStart] & 0xc1) !== 0 || bytes[dataStart + 1] !== 0 || bytes[dataStart + 2] !== 0 || bytes[dataStart + 3] !== 0) throw new Error('Malformed WebP VP8X chunk');
      imageDimensions = dimensions(bytes.readUIntLE(dataStart + 4, 3) + 1, bytes.readUIntLE(dataStart + 7, 3) + 1, 'webp');
      foundExtendedHeader = true;
    } else if (type === 'VP8 ') {
      if (foundImagePayload) throw new Error('Unsupported WebP multiple image payloads');
      if (length <= 10 || !bytes.subarray(dataStart + 3, dataStart + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) throw new Error('Malformed WebP VP8 chunk');
      const frameTag = bytes.readUIntLE(dataStart, 3);
      const firstPartitionSize = frameTag >>> 5;
      if ((frameTag & 1) !== 0 || ((frameTag >>> 1) & 7) > 3 || (frameTag & 0x10) === 0 || firstPartitionSize === 0 || firstPartitionSize >= length - 10) throw new Error('Malformed WebP VP8 frame header');
      payloadDimensions = dimensions(bytes.readUInt16LE(dataStart + 6) & 0x3fff, bytes.readUInt16LE(dataStart + 8) & 0x3fff, 'webp');
      imageDimensions ??= payloadDimensions;
      foundImagePayload = true;
      if (foundExtendedHeader) foundPayloadAfterExtendedHeader = true;
    } else if (type === 'VP8L') {
      if (foundImagePayload) throw new Error('Unsupported WebP multiple image payloads');
      if (length < 17 || bytes[dataStart] !== 0x2f) throw new Error('Malformed WebP VP8L chunk');
      const packed = bytes.readUInt32LE(dataStart + 1);
      if ((packed >>> 29) !== 0) throw new Error('Malformed WebP VP8L header');
      const compressedPayload = bytes.subarray(dataStart + 5, dataEnd);
      if (!compressedPayload.some((byte) => byte !== 0)) throw new Error('Malformed WebP VP8L payload');
      payloadDimensions = dimensions((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1, 'webp');
      imageDimensions ??= payloadDimensions;
      foundImagePayload = true;
      if (foundExtendedHeader) foundPayloadAfterExtendedHeader = true;
    }
    offset = paddedEnd;
  }
  if (offset !== bytes.length || !imageDimensions || !foundImagePayload || (foundExtendedHeader && !foundPayloadAfterExtendedHeader)) throw new Error('Malformed WebP image structure');
  if (foundExtendedHeader && (imageDimensions.width !== payloadDimensions.width || imageDimensions.height !== payloadDimensions.height)) throw new Error('Malformed WebP VP8X canvas dimensions');
  return imageDimensions;
}

export function readImageDimensions(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Image bytes must be a Buffer');
  if (bytes.subarray(0, 8).equals(pngSignature)) return readPngDimensions(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegDimensions(bytes);
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return readWebpDimensions(bytes);
  throw new Error('Unsupported image format; expected PNG, JPEG, or WebP');
}

export function describeGithubAsset(assetPath, { rootDirectory = repositoryRoot } = {}) {
  if (typeof assetPath !== 'string' || path.isAbsolute(assetPath) || assetPath.includes('\\') || assetPath.split('/').includes('..')) throw new Error(`Asset path must be a safe repository-relative path: ${assetPath}`);
  const absolutePath = path.resolve(rootDirectory, assetPath);
  if (!absolutePath.startsWith(`${rootDirectory}${path.sep}`)) throw new Error(`Asset path escapes the repository: ${assetPath}`);
  const bytes = readFileSync(absolutePath);
  const { width, height, format } = readImageDimensions(bytes);
  return { path: assetPath, width, height, format, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function runRegistration(argumentsList = process.argv.slice(2)) {
  const [assetPath, ...unsupported] = argumentsList.filter((argument) => argument !== '--');
  if (!assetPath || unsupported.length > 0) throw new Error('Usage: node scripts/register-github-asset.mjs <repository-relative PNG, JPEG, or WebP path>');
  process.stdout.write(`${JSON.stringify(describeGithubAsset(assetPath), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runRegistration(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
