import { randomUUID } from "node:crypto";
import { readAssetBytes, saveBuffer } from "@/lib/storage";

/**
 * Background removal. Reads the asset (local or S3), runs ONNX model on CPU,
 * uploads the cleaned PNG back via the storage abstraction.
 * Returns the new public URL, or null on failure.
 */
export async function removeBgFromUrl(
  publicUrlOrKey: string,
  subdir: string,
): Promise<string | null> {
  try {
    const { removeBackground } = await import("@imgly/background-removal-node");
    const inputBuf = await readAssetBytes(publicUrlOrKey);
    // imgly rembg requires a mime type — infer from URL extension.
    const ext = (publicUrlOrKey.split(".").pop() ?? "").toLowerCase();
    const mime =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      "image/jpeg";
    const blob = new Blob([new Uint8Array(inputBuf)], { type: mime });
    const result = await removeBackground(blob);
    const outBuf = Buffer.from(await result.arrayBuffer());

    const key = `${subdir}/${randomUUID()}.png`;
    const saved = await saveBuffer(outBuf, key, "image/png");
    return saved.url;
  } catch (err) {
    console.error("[rembg] failed:", (err as Error).message);
    return null;
  }
}
