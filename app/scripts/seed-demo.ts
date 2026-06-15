/**
 * Seed a "demo" account with curated photos that look good on CatVTON.
 * Person photos: full-body, simple background.
 * Garment photos: flat-lay / ghost mannequin.
 *
 *   npx tsx scripts/seed-demo.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, Category } from "@prisma/client";
import { saveBuffer } from "../src/lib/storage";
import { removeBgFromUrl } from "../src/lib/rembg";

const prisma = new PrismaClient();
const EMAIL = process.env.DEMO_EMAIL ?? "demo@vcloset.local";
const PASSWORD = "demo1234";
const ROOT = path.join(process.cwd(), "demo-data");

const PERSONS = [
  { file: "person/model-full-m.png" }, // 진짜 전신 — 하의 합성용 (대표)
  { file: "person/man-full.jpg" },
  { file: "person/woman-full.jpg" },
  { file: "person/man-casual.jpg" },
];

// 이름은 반드시 실제 이미지 내용과 일치시킬 것 — VTON 모델이 텍스트 설명도
// 조건으로 쓰기 때문에, 이름이 틀리면 이미지에 없는 디테일이 생성된다.
// sweater-flat.jpg 는 옷 단독 사진이 아니라(착용 뒷모습) 참조 이미지로 부적합 → 제외.
const GARMENTS: { file: string; name: string; category: Category }[] = [
  { file: "garment/tshirt-flat.jpg",      name: "Beige cat graphic tee", category: "TOP" },
  { file: "garment/hoodie-flat.jpg",      name: "Black lettering tee",   category: "TOP" },
  { file: "garment/blue-shirt-flat.jpg",  name: "Light blue tee",        category: "TOP" },
  { file: "garment/striped-shirt.jpg",    name: "Black 705 logo tee",    category: "TOP" },
  { file: "garment/jeans-flat.jpg",       name: "Navy jeans",            category: "BOTTOM" },
];

async function ensureUser() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        name: "Demo",
        plan: "PRO",
        creditBalance: 999_999,
      },
    });
    await prisma.creditLedger.create({
      data: { userId: user.id, amount: 999_999, reason: "ADMIN", balanceAfter: 999_999 },
    });
    console.log("✓ created demo user");
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { creditBalance: 999_999, plan: "PRO" },
    });
  }
  return user;
}

async function main() {
  const user = await ensureUser();
  console.log(`\nseeding into ${EMAIL} (${user.id})\n`);

  // Wipe previous demo profiles + garments for clean re-runs
  await prisma.profileImage.deleteMany({ where: { userId: user.id } });
  await prisma.garment.deleteMany({ where: { userId: user.id } });

  /* PERSONS */
  for (const [i, p] of PERSONS.entries()) {
    const src = path.join(ROOT, p.file);
    const buf = await fs.readFile(src).catch(() => null);
    if (!buf) { console.warn(`skip ${p.file}`); continue; }
    const ext = (p.file.split(".").pop() ?? "jpg").toLowerCase();
    const key = `${user.id}/profile/${randomUUID()}.${ext}`;
    const { url } = await saveBuffer(buf, key, "image/jpeg");
    await prisma.profileImage.create({
      data: { userId: user.id, url, isPrimary: i === 0 },
    });
    console.log(`  person ✓ ${p.file}`);
  }

  /* GARMENTS */
  for (const g of GARMENTS) {
    const src = path.join(ROOT, g.file);
    const buf = await fs.readFile(src).catch(() => null);
    if (!buf) { console.warn(`skip ${g.file}`); continue; }
    process.stdout.write(`  garment ${g.name.padEnd(28)} `);
    const ext = (g.file.split(".").pop() ?? "jpg").toLowerCase();
    const key = `${user.id}/garment/${randomUUID()}.${ext}`;
    const { url: originalUrl } = await saveBuffer(buf, key, "image/jpeg");
    process.stdout.write("rembg…");
    const cleaned = await removeBgFromUrl(originalUrl, `${user.id}/garment`);
    await prisma.garment.create({
      data: {
        userId: user.id,
        url: cleaned ?? originalUrl,
        originalUrl,
        category: g.category,
        name: g.name,
      },
    });
    console.log(` ✓ ${g.category} ${cleaned ? "(bg removed)" : "(original)"}`);
  }

  console.log("\n─────────────────────────────────────");
  console.log(" Demo account ready");
  console.log("   email   :", EMAIL);
  console.log("   password:", PASSWORD);
  console.log(`   ${PERSONS.length} person photos · ${GARMENTS.length} garments`);
  console.log("─────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
