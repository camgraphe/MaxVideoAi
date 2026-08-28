import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import * as referenceFileImportModule from '../frontend/src/server/agent-api/reference-file-import';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'reference-file-owner',
  clientId: 'chatgpt-plugin',
  emailVerified: true,
  authMethod: 'oauth',
};

type ReferenceFile = {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
};

type ImportService = (
  input: { files: ReferenceFile[] },
  principal: AgentPrincipal,
) => Promise<{
  assets: Array<{
    index: number;
    assetId: string;
    kind: 'image' | 'video' | 'audio';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  failures: Array<{ index: number; fileName: string | null; code: string }>;
  library: { type: 'open_url'; purpose: 'media_library'; label: string; url: string };
}>;

type CreateImportService = (dependencies: {
  baseUrl: string;
  downloadReferenceFile(file: ReferenceFile): Promise<{
    bytes: Buffer;
    fileName: string;
    mimeType: string;
  }>;
  storeReferenceFile(input: {
    userId: string;
    bytes: Buffer;
    fileName: string;
    mimeType: string;
    kind: 'image' | 'video' | 'audio';
  }): Promise<{
    assetId: string;
    kind: 'image' | 'video' | 'audio';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}) => ImportService;

test('operational MCP accepts a bounded array of ChatGPT file parameters and returns private asset IDs', async (t) => {
  const received: Array<{ input: { files: ReferenceFile[] }; principal: AgentPrincipal }> = [];
  const expected = {
    assets: [
      {
        index: 0,
        assetId: 'ma_11111111111111111111111111111111',
        kind: 'image' as const,
        fileName: 'portrait.png',
        mimeType: 'image/png',
        sizeBytes: 1234,
      },
      {
        index: 1,
        assetId: 'ma_22222222222222222222222222222222',
        kind: 'image' as const,
        fileName: 'location.webp',
        mimeType: 'image/webp',
        sizeBytes: 2345,
      },
    ],
    failures: [],
    library: {
      type: 'open_url' as const,
      purpose: 'media_library' as const,
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
  };
  const importReferenceFiles: ImportService = async (input, receivedPrincipal) => {
    received.push({ input, principal: receivedPrincipal });
    return expected;
  };
  const services = {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async getModelDetails() { throw new Error('unused'); },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' as const }; },
    async listMedia() { return { items: [], nextCursor: null, hasMore: false }; },
    async createReferenceUploadLink() { throw new Error('unused'); },
    importReferenceFiles,
  } as MaxVideoAiMcpServices & { importReferenceFiles: ImportService };

  const server = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: true,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'reference-file-import-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tool = (await client.listTools()).tools.find(
    (candidate) => candidate.name === 'import_reference_files',
  );
  assert.ok(tool, 'reference uploads should expose the direct private-file import tool');
  assert.deepEqual(tool._meta?.['openai/fileParams'], ['files']);
  assert.deepEqual(tool.inputSchema.required, ['files']);
  assert.equal(tool.inputSchema.additionalProperties, false);
  const filesSchema = tool.inputSchema.properties?.files as Record<string, unknown>;
  assert.equal(filesSchema.type, 'array');
  assert.equal(filesSchema.minItems, 1);
  assert.equal(filesSchema.maxItems, 8);
  const fileSchema = filesSchema.items as Record<string, unknown>;
  assert.equal(fileSchema.type, 'object');
  assert.deepEqual(fileSchema.required, ['download_url', 'file_id']);
  assert.deepEqual(Object.keys(fileSchema.properties as Record<string, unknown>), [
    'download_url',
    'file_id',
    'mime_type',
    'file_name',
  ]);
  assert.deepEqual(tool.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });

  const files: ReferenceFile[] = [
    {
      download_url: 'https://files.openai.example/private/portrait',
      file_id: 'file_portrait',
      mime_type: 'image/png',
      file_name: 'portrait.png',
    },
    {
      download_url: 'https://files.openai.example/private/location',
      file_id: 'file_location',
      mime_type: 'image/webp',
      file_name: 'location.webp',
    },
  ];
  const result = await client.callTool({
    name: 'import_reference_files',
    arguments: { files },
  });

  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, expected);
  assert.deepEqual(received, [{ input: { files }, principal }]);
});

test('reference file import stores each authorized host file in order and returns canonical private assets', async () => {
  const createImport = (referenceFileImportModule as typeof referenceFileImportModule & {
    createReferenceFileImportService?: CreateImportService;
  }).createReferenceFileImportService;
  assert.equal(
    typeof createImport,
    'function',
    'the reference-file service should own download-to-private-library orchestration',
  );

  const events: string[] = [];
  const importFiles = createImport!({
    baseUrl: 'https://maxvideoai.com/account/connections',
    async downloadReferenceFile(file) {
      events.push(`download:${file.file_id}`);
      if (file.file_id === 'file_portrait') {
        return {
          bytes: Buffer.from('portrait-bytes'),
          fileName: 'portrait.png',
          mimeType: 'image/png',
        };
      }
      return {
        bytes: Buffer.from('voice-bytes'),
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
      };
    },
    async storeReferenceFile(input) {
      events.push(`store:${input.kind}:${input.fileName}:${input.userId}`);
      return {
        assetId: input.kind === 'image'
          ? 'ma_33333333333333333333333333333333'
          : 'ma_44444444444444444444444444444444',
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.length,
      };
    },
  });

  const result = await importFiles({
    files: [
      {
        download_url: 'https://files.openai.example/private/portrait',
        file_id: 'file_portrait',
        mime_type: 'image/png',
        file_name: 'portrait.png',
      },
      {
        download_url: 'https://files.openai.example/private/voice',
        file_id: 'file_voice',
      },
    ],
  }, principal);

  assert.deepEqual(events, [
    'download:file_portrait',
    'store:image:portrait.png:reference-file-owner',
    'download:file_voice',
    'store:audio:voice.wav:reference-file-owner',
  ]);
  assert.deepEqual(result, {
    assets: [
      {
        index: 0,
        assetId: 'ma_33333333333333333333333333333333',
        kind: 'image',
        fileName: 'portrait.png',
        mimeType: 'image/png',
        sizeBytes: 14,
      },
      {
        index: 1,
        assetId: 'ma_44444444444444444444444444444444',
        kind: 'audio',
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
        sizeBytes: 11,
      },
    ],
    failures: [],
    library: {
      type: 'open_url',
      purpose: 'media_library',
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
  });
});

test('one rejected host file does not hide the asset IDs imported from the rest of the batch', async () => {
  const createImport = (referenceFileImportModule as typeof referenceFileImportModule & {
    createReferenceFileImportService?: CreateImportService;
  }).createReferenceFileImportService;
  assert.equal(typeof createImport, 'function');

  const importFiles = createImport!({
    baseUrl: 'https://maxvideoai.com/account/connections',
    async downloadReferenceFile(file) {
      if (file.file_id === 'file_rejected') {
        throw new AgentApiError('REFERENCE_INVALID', 'The host file is unsupported.');
      }
      return {
        bytes: Buffer.from(file.file_id),
        fileName: `${file.file_id}.png`,
        mimeType: 'image/png',
      };
    },
    async storeReferenceFile(input) {
      const suffix = input.fileName.includes('first') ? '5' : '6';
      return {
        assetId: `ma_${suffix.repeat(32)}`,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.length,
      };
    },
  });

  const result = await importFiles({
    files: [
      { download_url: 'https://files.example/first', file_id: 'file_first' },
      {
        download_url: 'https://files.example/rejected',
        file_id: 'file_rejected',
        file_name: 'unsupported.svg',
      },
      { download_url: 'https://files.example/last', file_id: 'file_last' },
    ],
  }, principal);

  assert.deepEqual(result.assets.map(({ index, assetId }) => ({ index, assetId })), [
    { index: 0, assetId: 'ma_55555555555555555555555555555555' },
    { index: 2, assetId: 'ma_66666666666666666666666666666666' },
  ]);
  assert.deepEqual(result.failures, [{
    index: 1,
    fileName: 'unsupported.svg',
    code: 'REFERENCE_INVALID',
  }]);
});

test('reference file downloads reject a hostname resolved to private infrastructure before opening a connection', async () => {
  const moduleUrl = pathToFileURL(resolve(
    'frontend/src/server/agent-api/reference-file-download.ts',
  )).href;
  const downloadModule = await import(moduleUrl).catch(() => null) as null | {
    createReferenceFileDownloader?: (dependencies: {
      lookupHost(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>>;
      openPinnedHttps(): Promise<never>;
    }) => (file: ReferenceFile) => Promise<unknown>;
  };
  assert.ok(downloadModule, 'the private-file downloader should exist');
  assert.equal(typeof downloadModule.createReferenceFileDownloader, 'function');

  let opened = false;
  const download = downloadModule.createReferenceFileDownloader!({
    async lookupHost(hostname) {
      assert.equal(hostname, 'metadata.internal.example');
      return [{ address: '169.254.169.254', family: 4 }];
    },
    async openPinnedHttps() {
      opened = true;
      throw new Error('the connection must not be opened');
    },
  });

  await assert.rejects(
    () => download({
      download_url: 'https://metadata.internal.example/latest/user-data',
      file_id: 'file_private_target',
      mime_type: 'image/png',
      file_name: 'portrait.png',
    }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_INVALID',
  );
  assert.equal(opened, false);
});

test('reference file downloads pin a public address and bound the streamed bytes before storage', async () => {
  const moduleUrl = pathToFileURL(resolve(
    'frontend/src/server/agent-api/reference-file-download.ts',
  )).href;
  const downloadModule = await import(moduleUrl) as {
    createReferenceFileDownloader(dependencies: {
      lookupHost(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>>;
      openPinnedHttps(
        url: URL,
        address: { address: string; family: 4 | 6 },
      ): Promise<{
        statusCode: number;
        headers: Record<string, string>;
        body: AsyncIterable<Uint8Array>;
      }>;
    }): (file: ReferenceFile) => Promise<{ bytes: Buffer; fileName: string; mimeType: string }>;
  };
  const opened: Array<{ url: string; address: string }> = [];
  let cancelled = 0;
  const download = downloadModule.createReferenceFileDownloader({
    async lookupHost(hostname) {
      assert.equal(hostname, 'files.openai.example');
      return [{ address: '93.184.216.34', family: 4 }];
    },
    async openPinnedHttps(url, address) {
      opened.push({ url: url.toString(), address: address.address });
      return {
        statusCode: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '6',
        },
        body: (async function* body() {
          yield new Uint8Array([1, 2, 3]);
          yield new Uint8Array([4, 5, 6]);
        }()),
        cancel() { cancelled += 1; },
      };
    },
  } as never);

  const result = await download({
    download_url: 'https://files.openai.example/private/portrait',
    file_id: 'file_portrait',
    mime_type: 'image/png',
    file_name: 'portrait.png',
  });

  assert.deepEqual(opened, [{
    url: 'https://files.openai.example/private/portrait',
    address: '93.184.216.34',
  }]);
  assert.deepEqual(result, {
    bytes: Buffer.from([1, 2, 3, 4, 5, 6]),
    fileName: 'portrait.png',
    mimeType: 'image/png',
  });
  assert.equal(cancelled, 1);
});

test('reference file redirects are revalidated and cannot pivot from a public host to a private address', async () => {
  const moduleUrl = pathToFileURL(resolve(
    'frontend/src/server/agent-api/reference-file-download.ts',
  )).href;
  const downloadModule = await import(moduleUrl) as {
    createReferenceFileDownloader(dependencies: {
      lookupHost(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>>;
      openPinnedHttps(
        url: URL,
        address: { address: string; family: 4 | 6 },
      ): Promise<{
        statusCode: number;
        headers: Record<string, string>;
        body: AsyncIterable<Uint8Array>;
      }>;
    }): (file: ReferenceFile) => Promise<unknown>;
  };
  const lookups: string[] = [];
  const opened: string[] = [];
  let cancelled = 0;
  const download = downloadModule.createReferenceFileDownloader({
    async lookupHost(hostname) {
      lookups.push(hostname);
      return hostname === 'public-files.example'
        ? [{ address: '93.184.216.34', family: 4 }]
        : [{ address: '127.0.0.1', family: 4 }];
    },
    async openPinnedHttps(url) {
      opened.push(url.hostname);
      return {
        statusCode: 302,
        headers: { location: 'https://private-target.example/secret.png' },
        body: (async function* empty() {})(),
        cancel() { cancelled += 1; },
      };
    },
  });

  await assert.rejects(
    () => download({
      download_url: 'https://public-files.example/start',
      file_id: 'file_redirect',
      mime_type: 'image/png',
      file_name: 'redirect.png',
    }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_INVALID',
  );
  assert.deepEqual(lookups, ['public-files.example', 'private-target.example']);
  assert.deepEqual(opened, ['public-files.example']);
  assert.equal(cancelled, 1);
});

test('reference downloads reject NAT64-encoded private destinations before opening a connection', async () => {
  const moduleUrl = pathToFileURL(resolve(
    'frontend/src/server/agent-api/reference-file-download.ts',
  )).href;
  const downloadModule = await import(moduleUrl) as {
    createReferenceFileDownloader(dependencies: {
      lookupHost(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>>;
      openPinnedHttps(): Promise<never>;
    }): (file: ReferenceFile) => Promise<unknown>;
  };
  const encoded = new Map([
    ['loopback.example', '64:ff9b::7f00:1'],
    ['private.example', '64:ff9b::a00:1'],
    ['metadata.example', '64:ff9b:1::a9fe:a9fe'],
  ]);
  let opened = 0;
  const download = downloadModule.createReferenceFileDownloader({
    async lookupHost(hostname) {
      return [{ address: encoded.get(hostname)!, family: 6 }];
    },
    async openPinnedHttps() {
      opened += 1;
      throw new Error('blocked NAT64 destinations must not open');
    },
  });

  for (const hostname of encoded.keys()) {
    await assert.rejects(
      () => download({
        download_url: `https://${hostname}/private.png`,
        file_id: `file_${hostname}`,
        mime_type: 'image/png',
      }),
      (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_INVALID',
    );
  }
  assert.equal(opened, 0);
});

test('reference downloads still accept a public IPv6 address and dispose rejected bodies', async () => {
  const moduleUrl = pathToFileURL(resolve(
    'frontend/src/server/agent-api/reference-file-download.ts',
  )).href;
  const downloadModule = await import(moduleUrl) as {
    createReferenceFileDownloader(dependencies: {
      lookupHost(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>>;
      openPinnedHttps(): Promise<{
        statusCode: number;
        headers: Record<string, string>;
        body: AsyncIterable<Uint8Array>;
        cancel(): void;
      }>;
    }): (file: ReferenceFile) => Promise<unknown>;
  };
  let opened = 0;
  let cancelled = 0;
  const download = downloadModule.createReferenceFileDownloader({
    async lookupHost() {
      return [{ address: '2606:4700:4700::1111', family: 6 }];
    },
    async openPinnedHttps() {
      opened += 1;
      return {
        statusCode: 200,
        headers: { 'content-type': 'image/png', 'content-length': String(25 * 1024 * 1024 + 1) },
        body: (async function* empty() {})(),
        cancel() { cancelled += 1; },
      };
    },
  });

  await assert.rejects(
    () => download({
      download_url: 'https://public-v6.example/large.png',
      file_id: 'file_public_v6',
      mime_type: 'image/png',
    }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_INVALID',
  );
  assert.equal(opened, 1);
  assert.equal(cancelled, 1);
});

test('default reference import persists images and media through the canonical private library owners', async () => {
  const createDefaultImport = (referenceFileImportModule as typeof referenceFileImportModule & {
    createDefaultReferenceFileImportService?: (
      baseUrl: string,
      overrides: Record<string, unknown>,
    ) => ImportService;
  }).createDefaultReferenceFileImportService;
  assert.equal(
    typeof createDefaultImport,
    'function',
    'the production import service should compose the established image and media stores',
  );

  const events: string[] = [];
  const importFiles = createDefaultImport!('https://maxvideoai.com/account/connections', {
    async downloadReferenceFile(file: ReferenceFile) {
      return file.file_id === 'file_image'
        ? { bytes: Buffer.from('image'), fileName: 'image.png', mimeType: 'image/png' }
        : { bytes: Buffer.from('video'), fileName: 'video.mp4', mimeType: 'video/mp4' };
    },
    async storeImageUpload(input: {
      userId: string;
      fileName: string;
      storageAcl?: string | null;
      storageCacheControl?: string;
    }) {
      assert.equal(input.storageAcl, null);
      assert.equal(input.storageCacheControl, 'private, no-store');
      events.push(`store-image:${input.userId}:${input.fileName}`);
      return {
        assetId: 'ua_image_legacy',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
        sizeBytes: 5,
        previewUrl: null,
      };
    },
    async loadStoredImageUploadRouteAsset() {
      events.push('load-image');
      return {
        assetId: 'ua_image_legacy',
        url: 'https://cdn.maxvideoai.com/user-assets/image.png',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
        sizeBytes: 5,
        thumbUrl: null,
      };
    },
    async ensureReusableAsset() {
      events.push('mirror-image');
      return { publicId: 'ma_77777777777777777777777777777777' };
    },
    async storeVideoUpload(input: {
      userId: string;
      fileName: string;
      storageAcl?: string | null;
      storageCacheControl?: string;
    }) {
      assert.equal(input.storageAcl, null);
      assert.equal(input.storageCacheControl, 'private, no-store');
      events.push(`store-video:${input.userId}:${input.fileName}`);
      return {
        assetId: 'ma_88888888888888888888888888888888',
        mimeType: 'video/mp4',
        sizeBytes: 5,
      };
    },
  });

  const result = await importFiles({ files: [
    { download_url: 'https://files.example/image', file_id: 'file_image' },
    { download_url: 'https://files.example/video', file_id: 'file_video' },
  ] }, principal);

  assert.deepEqual(events, [
    'store-image:reference-file-owner:image.png',
    'load-image',
    'mirror-image',
    'store-video:reference-file-owner:video.mp4',
  ]);
  assert.deepEqual(result.assets.map(({ assetId, kind }) => ({ assetId, kind })), [
    { assetId: 'ma_77777777777777777777777777777777', kind: 'image' },
    { assetId: 'ma_88888888888888888888888888888888', kind: 'video' },
  ]);
  assert.deepEqual(result.failures, []);
});
