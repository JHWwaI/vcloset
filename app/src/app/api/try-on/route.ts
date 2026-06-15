import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readAssetBytes, saveBuffer } from "@/lib/storage";
import { runReplicateTryOn } from "@/lib/replicate-vton";

const schema = z.object({
  profileImageId: z.string().min(1),
  garmentId: z.string().min(1),
});

const COLAB_TIMEOUT_MS = 180_000;

async function readAsBase64(publicUrlOrKey: string): Promise<string> {
  const buf = await readAssetBytes(publicUrlOrKey);
  return buf.toString("base64");
}

async function saveResult(userId: string, buf: Buffer): Promise<string> {
  const key = `${userId}/results/${randomUUID()}.png`;
  const { url } = await saveBuffer(buf, key, "image/png");
  return url;
}

function saveBase64Result(userId: string, b64: string) {
  const clean = b64.replace(/^data:image\/\w+;base64,/, "");
  return saveResult(userId, Buffer.from(clean, "base64"));
}

type InferenceMode = "replicate" | "modal" | "colab" | "placeholder";

function pickMode(): InferenceMode {
  if (process.env.REPLICATE_API_TOKEN?.trim()) return "replicate";
  if (process.env.INFERENCE_URL?.trim()) {
    return process.env.INFERENCE_MODE?.trim() === "modal" ? "modal" : "colab";
  }
  return "placeholder";
}

// Replicate IDM-VTON accepts: upper_body / lower_body / dresses
const CLOTH_TYPE_REPLICATE: Record<string, string> = {
  TOP: "upper_body",
  OUTER: "upper_body",
  BOTTOM: "lower_body",
  DRESS: "dresses",
  SHOES: "upper_body",
  ACCESSORY: "upper_body",
};

// CatVTON accepts: upper / lower / overall / inner / outer
// We map OUTER → upper (cardigans/jackets land on the chest region,
// otherwise CatVTON's "outer" mask is empty when the model isn't already wearing outerwear).
const CLOTH_TYPE_COLAB: Record<string, string> = {
  TOP: "upper",
  OUTER: "upper",
  BOTTOM: "lower",
  DRESS: "overall",
  SHOES: "upper",
  ACCESSORY: "upper",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const userId = session.user.id;
  const { profileImageId, garmentId } = parsed.data;

  const [user, profile, garment] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profileImage.findUnique({ where: { id: profileImageId } }),
    prisma.garment.findUnique({ where: { id: garmentId } }),
  ]);

  if (!user || !profile || !garment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (profile.userId !== userId || garment.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.creditBalance < 1) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // Cache (same person + garment) → reuse latest DONE
  const cached = await prisma.tryOnSession.findFirst({
    where: { userId, profileImageId, garmentId, status: "DONE" },
    orderBy: { createdAt: "desc" },
  });

  const mode = pickMode();
  const t0 = Date.now();

  // 1) Create session row + deduct credit
  const sessionRow = await prisma.$transaction(async (tx) => {
    const s = await tx.tryOnSession.create({
      data: {
        userId,
        profileImageId,
        garmentId,
        status: cached || mode === "placeholder" ? "DONE" : "PROCESSING",
        cost: 1,
        cacheHit: !!cached,
        resultUrl: cached?.resultUrl ?? (mode === "placeholder" ? garment.url : null),
        completedAt: cached || mode === "placeholder" ? new Date() : null,
      },
    });
    const u = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: 1 } },
    });
    await tx.creditLedger.create({
      data: {
        userId, amount: -1, reason: "TRY_ON",
        refType: "TryOnSession", refId: s.id, balanceAfter: u.creditBalance,
      },
    });
    return { s, balance: u.creditBalance };
  });

  if (cached || mode === "placeholder") {
    return NextResponse.json({
      session: sessionRow.s,
      creditBalance: sessionRow.balance,
      cached: !!cached,
      mode,
    });
  }

  // 2) Run inference
  try {
    const [personB64, garmentB64] = await Promise.all([
      readAsBase64(profile.url),
      readAsBase64(garment.url),
    ]);

    let resultUrl: string;

    if (mode === "replicate") {
      const buf = await runReplicateTryOn({
        personB64,
        garmentB64,
        category: garment.category,
        garmentDesc: garment.name ?? `a ${garment.category.toLowerCase()} garment`,
      });
      resultUrl = await saveResult(userId, buf);
    } else {
      // colab / modal — both speak the same JSON in/out, only URL shape differs
      const base = process.env.INFERENCE_URL!.trim().replace(/\/$/, "");
      const endpoint = mode === "modal" ? base : `${base}/try-on`;
      const isModal = mode === "modal";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), COLAB_TIMEOUT_MS);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          person_b64: personB64,
          garment_b64: garmentB64,
          cloth_type: isModal
            ? CLOTH_TYPE_REPLICATE[garment.category] ?? "upper_body"
            : CLOTH_TYPE_COLAB[garment.category] ?? "upper",
          garment_desc: garment.name ?? `a ${garment.category.toLowerCase()} garment`,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${isModal ? "Modal" : "Colab"} HTTP ${res.status}`);
      const data = (await res.json()) as { result_b64?: string; error?: string };
      if (!data.result_b64) throw new Error(data.error ?? "No result");
      resultUrl = await saveBase64Result(userId, data.result_b64);
    }

    const done = await prisma.tryOnSession.update({
      where: { id: sessionRow.s.id },
      data: {
        status: "DONE",
        resultUrl,
        durationMs: Date.now() - t0,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      session: done,
      creditBalance: sessionRow.balance,
      mode,
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Inference failed";
    const refunded = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: 1 } },
      });
      await tx.creditLedger.create({
        data: {
          userId, amount: +1, reason: "REFUND",
          refType: "TryOnSession", refId: sessionRow.s.id, balanceAfter: u.creditBalance,
        },
      });
      await tx.tryOnSession.update({
        where: { id: sessionRow.s.id },
        data: { status: "FAILED", errorMessage: msg, durationMs: Date.now() - t0 },
      });
      return u.creditBalance;
    });

    return NextResponse.json({ error: msg, creditBalance: refunded }, { status: 502 });
  }
}
