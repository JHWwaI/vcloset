/**
 * Storage abstraction — switches between local FS (dev) and S3-compatible
 * object storage (Cloudflare R2, AWS S3, Backblaze B2) based on env.
 *
 * Set these env vars to enable R2/S3 mode:
 *   STORAGE_DRIVER=s3
 *   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
 *   S3_REGION=auto                          # R2 uses "auto"
 *   S3_BUCKET=vcloset
 *   S3_ACCESS_KEY_ID=...
 *   S3_SECRET_ACCESS_KEY=...
 *   S3_PUBLIC_BASE_URL=https://pub-xxx.r2.dev   # or your custom domain
 *
 * Without them, falls back to local public/uploads (dev only — does NOT
 * survive Vercel deploys since serverless filesystem is read-only).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

type Driver = "local" | "s3";

const driver: Driver = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return s3Client;
}

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

function extOf(name: string, fallback = "bin"): string {
  const ext = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || fallback;
}

export type SavedAsset = { url: string; key: string };

export async function saveUpload(file: File, subdir: string): Promise<SavedAsset> {
  const key = `${subdir}/${randomUUID()}.${extOf(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  return saveBuffer(buf, key, file.type || "application/octet-stream");
}

export async function saveBuffer(
  buf: Buffer,
  key: string,
  contentType = "image/png",
): Promise<SavedAsset> {
  if (driver === "s3") {
    const bucket = process.env.S3_BUCKET!;
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "");
    return { url: `${base}/${key}`, key };
  }
  const abs = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
  return { url: `/uploads/${key}`, key };
}

export async function deleteAsset(keyOrUrl: string): Promise<void> {
  const key = keyOrUrl.startsWith("/uploads/")
    ? keyOrUrl.slice("/uploads/".length)
    : keyOrUrl;
  if (driver === "s3") {
    await getS3().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    );
  } else {
    await fs.unlink(path.join(LOCAL_ROOT, key)).catch(() => {});
  }
}

/**
 * Read raw bytes for inference / rembg. Handles both local files and S3 URLs.
 */
export async function readAssetBytes(urlOrKey: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(urlOrKey)) {
    const res = await fetch(urlOrKey);
    if (!res.ok) throw new Error(`Fetch asset failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const key = urlOrKey.startsWith("/uploads/") ? urlOrKey.slice("/uploads/".length) : urlOrKey;
  return fs.readFile(path.join(LOCAL_ROOT, key));
}

export function publicPathFromUrl(url: string): string {
  // Legacy local helper.
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

export function currentDriver(): Driver {
  return driver;
}
