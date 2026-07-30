import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
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

  async function getObjectBuffer(key: string): Promise<{
    body: Buffer;
    contentType?: string;
  }> {
    const out = await client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    const stream = out.Body;
    if (!stream) throw new Error(`Empty object body for key ${key}`);
    const bytes = await stream.transformToByteArray();
    return {
      body: Buffer.from(bytes),
      contentType: out.ContentType,
    };
  }

  async function putObjectBuffer(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  function attachmentKey(orgId: string, attachmentId: string) {
    return `org/${orgId}/att/${attachmentId}`;
  }

  /** Cheap connectivity probe — list at most one object; no body download. */
  async function probeBucket(): Promise<void> {
    await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        MaxKeys: 1,
      }),
    );
  }

  return {
    client,
    presignPut,
    presignGet,
    getObjectBuffer,
    putObjectBuffer,
    probeBucket,
    attachmentKey,
    bucket: cfg.bucket,
  };
}

export type Storage = ReturnType<typeof createStorageClient>;
