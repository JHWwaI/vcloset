import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeBgFromUrl } from "@/lib/rembg";

const CATS = ["TOP", "BOTTOM", "DRESS", "OUTER", "SHOES", "ACCESSORY"] as const;

const createSchema = z.object({
  url: z.string().min(1),
  originalUrl: z.string().min(1),
  category: z.enum(CATS).default("TOP"),
  name: z.string().max(80).optional(),
  color: z.string().max(40).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const garments = await prisma.garment.findMany({
    where: {
      userId: session.user.id,
      ...(category && CATS.includes(category as (typeof CATS)[number])
        ? { category: category as (typeof CATS)[number] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ garments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Run background removal — fall back to original URL on failure.
  const cleaned = await removeBgFromUrl(parsed.data.originalUrl, `${session.user.id}/garment`);
  const finalUrl = cleaned ?? parsed.data.url;

  const g = await prisma.garment.create({
    data: { ...parsed.data, url: finalUrl, userId: session.user.id },
  });
  return NextResponse.json({ garment: g, backgroundRemoved: !!cleaned });
}
