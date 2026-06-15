"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import UploadButton from "@/components/UploadButton";

// VTON 합성이 실제로 지원되는 카테고리만 노출 (CatVTON: upper/lower).
// 원피스(overall)는 모델은 지원하나 전신 데모 검증 후 오픈, 신발·액세서리는 VTON 범위 밖.
const CATS = ["TOP", "BOTTOM"] as const;
const LABEL: Record<string, string> = {
  TOP: "상의", BOTTOM: "하의",
};

export default function UploadGarmentPage() {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATS)[number]>("TOP");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!url) return;
    setSaving(true);
    const r = await fetch("/api/garments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, originalUrl: url, category, name: name || undefined }),
    });
    setSaving(false);
    if (r.ok) router.push("/closet");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">옷 추가</h1>
      <p className="mt-1 text-sm text-neutral-600">옷 사진을 업로드하고 카테고리를 선택하세요.</p>

      <div className="mt-6">
        <UploadButton subdir="garment" onUploaded={setUrl} label={url ? "다시 업로드" : "옷 사진 업로드"} />
        {url && (
          <div className="mt-4 relative w-48 aspect-square rounded-lg overflow-hidden border bg-white">
            <Image src={url} alt="preview" fill className="object-cover" sizes="192px" />
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <label className="block text-sm text-neutral-600 mb-1">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 text-sm font-medium ${category === c ? "chip-active" : "chip"}`}
              >
                {LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--ink-soft)" }}>이름 (선택)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 베이지 트렌치코트"
            className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }}
          />
        </div>

        <button
          onClick={save}
          disabled={!url || saving}
          className="btn-primary w-full py-2.5 font-semibold"
        >
          {saving ? "저장 중…" : "옷장에 추가"}
        </button>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        ※ 배경 제거(rembg)는 Week 2 작업 항목입니다. 지금은 원본 그대로 저장됩니다.
      </p>
    </div>
  );
}
