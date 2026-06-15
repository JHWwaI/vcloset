import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const SIGNUP_BONUS = 5;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, passwordHash, name, creditBalance: SIGNUP_BONUS },
    });
    await tx.creditLedger.create({
      data: {
        userId: u.id,
        amount: SIGNUP_BONUS,
        reason: "SIGNUP",
        balanceAfter: SIGNUP_BONUS,
      },
    });
    return u;
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
