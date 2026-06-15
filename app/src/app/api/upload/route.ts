import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const subdir = (form.get("subdir") as string) || "misc";

  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Unsupported type" }, { status: 415 });

  const userDir = `${session.user.id}/${subdir}`;
  const { url } = await saveUpload(file, userDir);
  return NextResponse.json({ url });
}
