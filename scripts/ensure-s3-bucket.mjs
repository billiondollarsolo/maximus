#!/usr/bin/env node
/**
 * Ensure the Maximus uploads bucket exists (RustFS / S3).
 * Usage: node scripts/ensure-s3-bucket.mjs
 * Env: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "packages/storage/package.json"));
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const endpoint = process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";
const bucket = process.env.S3_BUCKET ?? "maximus-uploads";
const accessKeyId = process.env.S3_ACCESS_KEY ?? "maximus";
const secretAccessKey = process.env.S3_SECRET_KEY ?? "maximussecret";

const client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.info(`bucket ok: ${bucket} @ ${endpoint}`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.info(`created bucket: ${bucket} @ ${endpoint}`);
  }
  await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  console.info("list probe ok");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
