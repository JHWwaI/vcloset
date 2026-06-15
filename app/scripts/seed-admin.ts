/**
 * Create or upgrade a test/admin account with effectively unlimited credits.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts                 # uses defaults
 *   ADMIN_EMAIL=me@x.com ADMIN_PASSWORD=hunter22 npx tsx scripts/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = process.env.ADMIN_EMAIL ?? "test@vcloset.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "test1234";
const CREDITS = 999_999;

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { creditBalance: CREDITS, plan: "PRO", passwordHash },
    create: {
      email: EMAIL,
      name: "Test Admin",
      passwordHash,
      plan: "PRO",
      creditBalance: CREDITS,
    },
  });
  await prisma.creditLedger.create({
    data: {
      userId: user.id,
      amount: CREDITS,
      reason: "ADMIN",
      balanceAfter: CREDITS,
    },
  });

  console.log("──────────────────────────────────────────");
  console.log("  Test/Admin account ready");
  console.log("  email   :", EMAIL);
  console.log("  password:", PASSWORD);
  console.log("  credits :", CREDITS.toLocaleString(), "(plan PRO)");
  console.log("──────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
