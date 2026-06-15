"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Sess = {
  id: string;
  resultUrl: string | null;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  createdAt: string;
  garment: { id: string; url: string; name: string | null; category: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기", PROCESSING: "합성 중", DONE: "완료", FAILED: "실패",
};

export default function LookbookPage() {
  const [sessions, setSessions] = useState<Sess[]>([]);

  async function load() {
    const r = await fetch("/api/try-on/sessions");
    if (r.ok) setSessions((await r.json()).sessions);
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">룩북</h1>
        <Link href="/try-on" className="px-4 py-2 rounded bg-black text-white">새로 입어보기</Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">지금까지 합성한 결과 모음.</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white overflow-hidden">
            <div className="relative aspect-[3/4] bg-neutral-100">
              {s.resultUrl ? (
                <Image src={s.resultUrl} alt="result" fill className="object-cover" sizes="240px" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                  {STATUS_LABEL[s.status]}
                </div>
              )}
            </div>
            <div className="p-2 text-xs text-neutral-600 flex items-center justify-between">
              <span className="truncate">{s.garment?.name ?? s.garment?.category ?? "-"}</span>
              <span className={s.status === "FAILED" ? "text-red-500" : ""}>{STATUS_LABEL[s.status]}</span>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-sm text-neutral-500 col-span-full">아직 결과가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
