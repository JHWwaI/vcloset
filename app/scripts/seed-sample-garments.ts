/**
 * Seed the test account closet with the sample garments under sample-garments/.
 * Copies file → storage layer → runs rembg → creates DB rows.
 *
 *   npx tsx scripts/seed-sample-garments.ts
 *   ADMIN_EMAIL=me@x.com npx tsx scripts/seed-sample-garments.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient, Category } from "@prisma/client";
import { saveBuffer } from "../src/lib/storage";
import { removeBgFromUrl } from "../src/lib/rembg";

const prisma = new PrismaClient();
const EMAIL = process.env.ADMIN_EMAIL ?? "test@vcloset.local";
const SAMPLES_DIR = path.join(process.cwd(), "sample-garments");

type Spec = { file: string; name: string; category: Category };

const SAMPLES: Spec[] = [
  { file: "white-tshirt.jpg",  name: "Plain white tee",   category: "TOP" },
  { file: "blue-shirt.jpg",    name: "Blue button-up",    category: "TOP" },
  { file: "striped-tee.jpg",   name: "Striped tee",       category: "TOP" },
  { file: "hoodie.jpg",        name: "Pullover hoodie",   category: "TOP" },
  { file: "denim-jacket.jpg",  name: "Denim jacket",      category: "OUTER" },
  { file: "cardigan.jpg",      name: "Knit cardigan",     category: "OUTER" },
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`✗ User not found: ${EMAIL}\n  Run: npx tsx scripts/seed-admin.ts`);
    process.exit(1);
  }

  console.log(`Seeding ${SAMPLES.length} garments for ${EMAIL} (${user.id})\n`);

  for (const s of SAMPLES) {
    const src = path.join(SAMPLES_DIR, s.file);
    if (!(await fs.stat(src).catch(() => null))) {
      console.warn(`  skip ${s.file} — not found`);
      continue;
    }

    process.stdout.write(`  • ${s.name.padEnd(22)} `);

    // 1) upload original to storage layer
    const buf = await fs.readFile(src);
    const ext = (s.file.split(".").pop() ?? "jpg").toLowerCase();
    const key = `${user.id}/garment/${randomUUID()}.${ext}`;
    const { url: originalUrl } = await saveBuffer(buf, key, `image/${ext === "jpg" ? "jpeg" : ext}`);

    // 2) run rembg
    process.stdout.write("rembg…");
    const cleaned = await removeBgFromUrl(originalUrl, `${user.id}/garment`);
    const finalUrl = cleaned ?? originalUrl;

    // 3) create Garment row
    await prisma.garment.create({
      data: {
        userId: user.id,
        url: finalUrl,
        originalUrl,
        category: s.category,
        name: s.name,
      },
    });
    console.log(` ✓ ${s.category}`);
  }

  const total = await prisma.garment.count({ where: { userId: user.id } });
  console.log(`\nDone. Closet now has ${total} garments for ${EMAIL}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
