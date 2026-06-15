"use client";
import { useRef, useState } from "react";

type Props = {
  subdir: string;
  onUploaded: (url: string) => void;
  label?: string;
  accept?: string;
};

export default function UploadButton({ subdir, onUploaded, label = "이미지 업로드", accept = "image/*" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("subdir", subdir);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setLoading(false);
    if (ref.current) ref.current.value = "";
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "업로드 실패");
      return;
    }
    const { url } = await res.json();
    onUploaded(url);
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={() => ref.current?.click()}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? "업로드 중…" : label}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
    </div>
  );
}
