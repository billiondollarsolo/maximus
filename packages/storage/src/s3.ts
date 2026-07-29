import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  forcePathStyle?: boolean;
};

export function createStorageClient(cfg: StorageConfig) {
  const client = new S3Client({
    region: cfg.region ?? "us-east-1",
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle ?? true,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });

  async function presignPut(key: string, contentType: string, expiresIn = 900) {
    const cmd = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(client, cmd, { expiresIn });
  }

  async function presignGet(key: string, expiresIn = 900) {
    const cmd = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
    return getSignedUrl(client, cmd, { expiresIn });
  }

  function attachmentKey(orgId: string, attachmentId: string) {
    return `org/${orgId}/att/${attachmentId}`;
  }

  return { client, presignPut, presignGet, attachmentKey, bucket: cfg.bucket };
}

export type Storage = ReturnType<typeof createStorageClient>;
