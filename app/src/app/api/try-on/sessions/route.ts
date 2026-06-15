import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.tryOnSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      garment: { select: { id: true, url: true, name: true, category: true } },
    },
  });
  return NextResponse.json({ sessions });
}
