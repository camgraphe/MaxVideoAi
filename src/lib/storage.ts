export interface StorageUploadInput {
  key: string;
  buffer: ArrayBuffer | Uint8Array;
  contentType: string;
}

export interface StorageUploadResult {
  url: string;
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  getSignedUrl(key: string): Promise<string>;
}

class PassthroughStorage implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    console.info("[storage] Passthrough upload", input.key);
    return { url: `https://example.com/${input.key}` };
  }

  async getSignedUrl(key: string): Promise<string> {
    return `https://example.com/${key}`;
  }
}

let adapter: StorageAdapter = new PassthroughStorage();

export function getStorageAdapter(): StorageAdapter {
  return adapter;
}

export function setStorageAdapter(nextAdapter: StorageAdapter) {
  adapter = nextAdapter;
}
