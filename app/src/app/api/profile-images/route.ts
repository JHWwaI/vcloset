import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  url: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const images = await prisma.profileImage.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ images });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const userId = session.user.id;
  const count = await prisma.profileImage.count({ where: { userId } });
  const isPrimary = parsed.data.isPrimary ?? count === 0;

  const img = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.profileImage.updateMany({ where: { userId }, data: { isPrimary: false } });
    }
    return tx.profileImage.create({
      data: { userId, url: parsed.data.url, isPrimary },
    });
  });

  return NextResponse.json({ image: img });
}
