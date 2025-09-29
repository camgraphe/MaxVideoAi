import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost, type PresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";

const {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_REGION,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PUBLIC_BASE_URL,
  S3_FORCE_PATH_STYLE,
} = process.env;

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_REGION || !S3_BUCKET) {
  console.warn("[storage] S3 environment variables missing. Uploads will likely fail.");
}

let client: S3Client | undefined;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
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
  return client;
}

export interface GenerateUploadParams {
  filename: string;
  contentType: string;
  folder?: string;
  expiresIn?: number;
}

export interface GeneratedUpload {
  key: string;
  post: PresignedPost;
  fileUrl: string;
}

function buildKey(filename: string, folder?: string) {
  const extension = filename.includes(".") ? filename.split(".").pop() : undefined;
  const keyBase = `${randomUUID()}${extension ? `.${extension}` : ""}`;
  return folder ? `${folder.replace(/\/$/, "")}/${keyBase}` : keyBase;
}

function resolvePublicUrl(key: string, postUrl: string) {
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  if (postUrl.includes(S3_BUCKET ?? "")) {
    return `${postUrl.replace(/\/$/, "")}/${key}`;
  }

  return key;
}

export async function generatePresignedUpload(params: GenerateUploadParams): Promise<GeneratedUpload> {
  if (!S3_BUCKET) {
    throw new Error("S3_BUCKET is not configured");
  }

  const key = buildKey(params.filename, params.folder ?? "uploads");
  const client = getClient();

  const post = await createPresignedPost(client, {
    Bucket: S3_BUCKET,
    Key: key,
    Conditions: [["content-length-range", 1, 25 * 1024 * 1024]],
    Expires: params.expiresIn ?? 300,
    Fields: {
      "Content-Type": params.contentType,
      "success_action_status": "201",
    },
  });

  const fileUrl = resolvePublicUrl(key, post.url);

  return {
    key,
    post,
    fileUrl,
  };
}
