import Replicate from "replicate";

// IDM-VTON on Replicate. Pinned a known-working version of cuuupid/idm-vton.
// Override at runtime via REPLICATE_IDM_VERSION if needed.
const DEFAULT_VERSION =
  "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4";

const CATEGORY_MAP: Record<string, "upper_body" | "lower_body" | "dresses"> = {
  TOP: "upper_body",
  OUTER: "upper_body",
  BOTTOM: "lower_body",
  DRESS: "dresses",
  SHOES: "upper_body",
  ACCESSORY: "upper_body",
};

export type ReplicateInput = {
  personB64: string;        // raw base64 without data: prefix
  garmentB64: string;
  category: string;         // our Prisma Category enum value
  garmentDesc?: string;
  steps?: number;
  guidance?: number;
  seed?: number;
};

function toDataUri(b64: string, mime = "image/jpeg"): string {
  const clean = b64.replace(/^data:image\/\w+;base64,/, "");
  return `data:${mime};base64,${clean}`;
}

export async function runReplicateTryOn(input: ReplicateInput): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");

  const replicate = new Replicate({ auth: token });
  const version = process.env.REPLICATE_IDM_VERSION ?? DEFAULT_VERSION;

  const category = CATEGORY_MAP[input.category] ?? "upper_body";
  const output = (await replicate.run(version as `${string}/${string}:${string}`, {
    input: {
      human_img: toDataUri(input.personB64),
      garm_img: toDataUri(input.garmentB64),
      garment_des: input.garmentDesc ?? "a fashion garment",
      category,
      crop: false,
      seed: input.seed ?? 42,
      steps: input.steps ?? 30,
      // optional: force_dc / mask_only / etc. — defaults are fine
    },
  })) as unknown;

  // Replicate returns either a string URL, an array of URLs, or a FileOutput.
  const url = await resolveOutputToUrl(output);
  if (!url) throw new Error("Replicate returned no image");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download result: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function resolveOutputToUrl(output: unknown): Promise<string | null> {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof (first as { url?: () => URL }).url === "function") {
      return String((first as { url: () => URL }).url());
    }
  }
  if (output && typeof (output as { url?: () => URL }).url === "function") {
    return String((output as { url: () => URL }).url());
  }
  return null;
}
