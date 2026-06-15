"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Garment = {
  id: string;
  url: string;
  category: "TOP" | "BOTTOM" | "DRESS" | "OUTER" | "SHOES" | "ACCESSORY";
  name?: string | null;
};

// VTON 합성이 지원되는 카테고리만 노출 (업로드 페이지와 동일 기준).
const CATS = ["ALL", "TOP", "BOTTOM"] as const;
const LABEL: Record<string, string> = {
  ALL: "전체", TOP: "상의", BOTTOM: "하의",
};

export default function ClosetPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");

  async function load() {
    const r = await fetch("/api/garments");
    if (r.ok) setGarments((await r.json()).garments);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => (cat === "ALL" ? garments : garments.filter((g) => g.category === cat)),
    [garments, cat]
  );

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) return;
    const r = await fetch(`/api/garments/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">옷장 <span aria-hidden>👕</span></h1>
        <Link href="/closet/upload" className="btn-primary px-4 py-2 font-medium">+ 옷 추가</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-1.5 text-sm font-medium ${cat === c ? "chip-active" : "chip"}`}
          >
            {LABEL[c]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((g) => (
          <div key={g.id} className="group relative aspect-square rounded-2xl overflow-hidden surface-card">
            <Image src={g.url} alt={g.name ?? ""} fill className="object-cover" sizes="200px" />
            <button
              onClick={() => remove(g.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-white/90 text-red-600 text-xs px-2 py-1 rounded"
            >
              삭제
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent text-white text-xs px-2 py-1">
              {LABEL[g.category]} {g.name ? `· ${g.name}` : ""}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-neutral-500 col-span-full">
            아직 옷이 없습니다. 우상단 “옷 추가”로 등록해 보세요.
          </div>
        )}
      </div>
    </div>
  );
}
