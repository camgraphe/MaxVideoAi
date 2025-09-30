import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_REGION,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PUBLIC_BASE_URL,
  S3_FORCE_PATH_STYLE,
} = process.env;

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!cachedClient) {
    if (!S3_REGION) {
      throw new Error("S3_REGION is not configured");
    }
    cachedClient = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: S3_FORCE_PATH_STYLE === "true",
      credentials:
        S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: S3_ACCESS_KEY_ID,
              secretAccessKey: S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return cachedClient;
}

function resolveObjectUrl(key: string): string {
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  if (S3_ENDPOINT && S3_BUCKET) {
    return `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  }

  if (S3_BUCKET && S3_REGION) {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }

  return key;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-z0-9_.-]+/gi, "-").replace(/-+/g, "-");
}

export interface ArchiveJobMediaParams {
  jobId: string;
  sourceUrl: string;
  contentType?: string;
  filename?: string;
}

export interface ArchiveJobMediaResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export async function archiveJobMedia(
  params: ArchiveJobMediaParams,
): Promise<ArchiveJobMediaResult | null> {
  if (!S3_BUCKET) {
    console.warn("[storage] Skipping archive upload: S3_BUCKET is not set.");
    return null;
  }

  const response = await fetch(params.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download asset for archival (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const body = Buffer.from(arrayBuffer);
  const inferredContentType = params.contentType ?? response.headers.get("content-type") ?? "application/octet-stream";

  const fileNameFromUrl = (() => {
    try {
      const url = new URL(params.sourceUrl);
      const lastSegment = url.pathname.split("/").filter(Boolean).pop();
      return lastSegment ?? "output.mp4";
    } catch {
      return "output.mp4";
    }
  })();

  const key = `jobs/${params.jobId}/${Date.now()}-${sanitizeFilename(
    params.filename ?? fileNameFromUrl,
  )}`;

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: inferredContentType,
    }),
  );

  return {
    key,
    url: resolveObjectUrl(key),
    sizeBytes: body.byteLength,
  };
}
