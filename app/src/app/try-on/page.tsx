"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type ProfileImage = { id: string; url: string; isPrimary: boolean };
type Garment = { id: string; url: string; name?: string | null };
type Session = { id: string; resultUrl: string | null; status: string };

export default function TryOnPage() {
  const [profiles, setProfiles] = useState<ProfileImage[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [result, setResult] = useState<Session | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [uploadingGarment, setUploadingGarment] = useState(false);
  const [previewGarment, setPreviewGarment] = useState<Garment | null>(null);

  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        fetch("/api/profile-images").then((r) => r.json()),
        fetch("/api/garments").then((r) => r.json()),
        fetch("/api/try-on/sessions").then((r) => r.json()).catch(() => ({ sessions: [] })),
      ]);
      setProfiles(a.images ?? []);
      setGarments(b.garments ?? []);

      // 마지막 완료 세션 복원 — result 가 메모리 상태에만 있으면 새로고침/리로드 시
      // 결과 패널이 초기화되므로, 서버에 저장된 최근 결과로 되살린다.
      const last = c.sessions?.find(
        (s: Session & { profileImageId?: string; garmentId?: string }) =>
          s.status === "DONE" && s.resultUrl,
      );
      if (last) {
        setResult(last);
        setProfileId(last.profileImageId ?? null);
        setGarmentId(last.garmentId ?? null);
      }
      if (!last || !last.profileImageId) {
        setProfileId(
          a.images?.find((x: ProfileImage) => x.isPrimary)?.id ?? a.images?.[0]?.id ?? null,
        );
      }
    })();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId],
  );
  const selectedGarment = useMemo(
    () => garments.find((g) => g.id === garmentId) ?? null,
    [garments, garmentId],
  );

  /* ─── 업로드 ─── */
  const upload = useCallback(async (file: File, subdir: string) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("subdir", subdir);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    return r.ok ? ((await r.json()).url as string) : null;
  }, []);

  const onPersonFile = useCallback(async (file: File) => {
    setUploadingPerson(true);
    const url = await upload(file, "profile");
    if (url) {
      const r = await fetch("/api/profile-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, isPrimary: profiles.length === 0 }),
      });
      if (r.ok) {
        const { image } = await r.json();
        setProfiles((prev) => [image, ...prev]);
        setProfileId(image.id);
      }
    }
    setUploadingPerson(false);
  }, [upload, profiles.length]);

  const onGarmentFile = useCallback(async (file: File) => {
    setUploadingGarment(true);
    const url = await upload(file, "garment");
    if (url) {
      const r = await fetch("/api/garments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, originalUrl: url, category: "TOP" }),
      });
      if (r.ok) {
        const { garment } = await r.json();
        setGarments((prev) => [garment, ...prev]);
        setGarmentId(garment.id);
      }
    }
    setUploadingGarment(false);
  }, [upload]);

  async function run() {
    if (!profileId || !garmentId) return;
    setRunning(true);
    setErr(null);
    setResult(null);
    const r = await fetch("/api/try-on", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileImageId: profileId, garmentId }),
    });
    setRunning(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "실패");
      return;
    }
    const data = await r.json();
    setResult(data.session);
    setCreditBalance(data.creditBalance);
  }

  const canRun = !!selectedProfile && !!selectedGarment && !running;

  return (
    <div className="pb-32 sm:pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">가상 피팅</h1>
        {creditBalance !== null && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-900 text-white">
            크레딧 {creditBalance}
          </span>
        )}
      </div>

      {/* 메인 캔버스 — Before / After */}
      <div className="mt-3 grid grid-cols-2 gap-2 max-w-3xl">
        <Canvas
          label="원본"
          url={selectedProfile?.url}
          aspect={3 / 4}
          uploading={uploadingPerson}
          onDrop={onPersonFile}
          onPick={() => personInputRef.current?.click()}
          emptyTitle="내 사진 올리기"
          emptyHint="전신 또는 반신 사진 한 장"
        />
        <Canvas
          label={result?.resultUrl ? "결과" : "결과 미리보기"}
          url={result?.resultUrl ?? undefined}
          aspect={3 / 4}
          loading={running}
          emptyTitle={
            !selectedProfile
              ? "사진을 먼저 올려주세요"
              : !selectedGarment
              ? "옷을 골라주세요"
              : "‘입어보기’를 누르세요"
          }
          emptyHint=""
        />
      </div>
      {err && <div className="mt-3 text-sm text-red-600">⚠ {err}</div>}

      {/* 옷 선택 바 */}
      <div className="mt-4 max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-neutral-700">옷</h2>
          <span className="text-xs text-neutral-400">{garments.length}개</span>
        </div>

        {/* 현재 선택된 옷 표시 */}
        {selectedGarment && (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-black text-white px-3 py-2">
            <div
              className="relative rounded-md overflow-hidden bg-white shrink-0"
              style={{ width: 44, height: 44 }}
            >
              <Image
                src={selectedGarment.url}
                alt={selectedGarment.name ?? ""}
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-white/60">선택된 옷</div>
              <div className="text-sm font-semibold truncate">
                {selectedGarment.name ?? "이름 없음"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGarmentId(null)}
              className="text-xs text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              aria-label="선택 해제"
            >
              해제
            </button>
          </div>
        )}

        <StripPicker
          onAddClick={() => garmentInputRef.current?.click()}
          uploading={uploadingGarment}
          items={garments.map((g) => ({
            id: g.id, src: g.url, caption: g.name ?? undefined,
          }))}
          selectedId={garmentId}
          onSelect={(id) => {
            const g = garments.find((x) => x.id === id);
            if (g) setPreviewGarment(g);
          }}
          tileShape="square"
        />
      </div>

      {/* 내 사진 추가 옵션 (사진이 2장 이상일 때만 picker 노출) */}
      {profiles.length > 1 && (
        <div className="mt-3 max-w-3xl">
          <h2 className="text-sm font-semibold text-neutral-700 mb-2">내 사진 ({profiles.length}장)</h2>
          <StripPicker
            onAddClick={() => personInputRef.current?.click()}
            uploading={uploadingPerson}
            items={profiles.map((p) => ({ id: p.id, src: p.url }))}
            selectedId={profileId}
            onSelect={setProfileId}
            tileShape="portrait"
          />
        </div>
      )}

      {/* 숨겨진 file inputs */}
      <input
        ref={personInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPersonFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={garmentInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onGarmentFile(f);
          e.target.value = "";
        }}
      />

      {/* 옷 미리보기 모달 */}
      {previewGarment && (
        <GarmentPreviewModal
          garment={previewGarment}
          isCurrentSelection={previewGarment.id === garmentId}
          onConfirm={() => {
            setGarmentId(previewGarment.id);
            setPreviewGarment(null);
          }}
          onClose={() => setPreviewGarment(null)}
        />
      )}

      {/* 고정 하단 CTA */}
      <div className="glass-bar fixed bottom-0 inset-x-0 z-10" style={{ borderTop: "1px solid var(--line)", borderBottom: "none" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            {!selectedProfile ? (
              <>1단계 <span className="font-semibold" style={{ color: "var(--ink)" }}>내 사진 올리기</span></>
            ) : !selectedGarment ? (
              <>2단계 <span className="font-semibold" style={{ color: "var(--ink)" }}>옷 선택</span></>
            ) : running ? (
              <>🌊 합성 중 · 첫 호출은 30~60초</>
            ) : (
              <>준비 완료. 입어보기를 눌러주세요.</>
            )}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="btn-primary px-6 py-2.5 font-semibold"
          >
            {running ? "합성 중…" : "입어보기 · 1 크레딧"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── components ─────────── */

function Canvas({
  label, url, aspect, uploading, loading, onDrop, onPick, emptyTitle, emptyHint,
}: {
  label: string;
  url?: string;
  aspect: number;
  uploading?: boolean;
  loading?: boolean;
  onDrop?: (f: File) => void;
  onPick?: () => void;
  emptyTitle: string;
  emptyHint: string;
}) {
  const [drag, setDrag] = useState(false);
  const isInteractive = !!onPick;
  return (
    <div>
      <div className="text-[11px] tracking-wider uppercase text-neutral-500 mb-1.5">{label}</div>
      <div
        onClick={isInteractive ? onPick : undefined}
        onDragOver={isInteractive ? (e) => { e.preventDefault(); setDrag(true); } : undefined}
        onDragLeave={() => setDrag(false)}
        onDrop={
          isInteractive && onDrop
            ? (e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onDrop(f);
              }
            : undefined
        }
        className={`relative w-full rounded-2xl overflow-hidden border-2 bg-neutral-50 transition-all ${
          drag ? "border-black bg-neutral-100" : "border-neutral-200"
        } ${isInteractive ? "cursor-pointer hover:border-neutral-400" : ""}`}
        style={{ aspectRatio: `${aspect}` }}
      >
        {url ? (
          <Image src={url} alt={label} fill className="object-cover" sizes="(min-width: 640px) 50vw, 100vw" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            {loading || uploading ? (
              <Spinner />
            ) : (
              <>
                <div className="text-4xl text-neutral-300 mb-2">{isInteractive ? "＋" : "👤"}</div>
                <div className="text-sm font-medium text-neutral-700">{emptyTitle}</div>
                {emptyHint && (
                  <div className="text-xs text-neutral-500 mt-1">{emptyHint}</div>
                )}
                {isInteractive && (
                  <div className="text-[10px] text-neutral-400 mt-3">클릭 또는 드래그&드롭</div>
                )}
              </>
            )}
          </div>
        )}
        {loading && url && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Spinner light />
          </div>
        )}
      </div>
    </div>
  );
}

function StripPicker({
  items, selectedId, onSelect, onAddClick, uploading, tileShape,
}: {
  items: { id: string; src: string; caption?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  uploading: boolean;
  tileShape: "square" | "portrait";
}) {
  const w = tileShape === "square" ? 96 : 60;
  const h = tileShape === "square" ? 96 : 80;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      <button
        type="button"
        onClick={onAddClick}
        disabled={uploading}
        className="shrink-0 rounded-lg border-2 border-dashed border-neutral-300 hover:border-black hover:bg-neutral-50 flex flex-col items-center justify-center text-neutral-500 hover:text-black transition disabled:opacity-50"
        style={{ width: w, height: h }}
      >
        {uploading ? <Spinner small /> : (
          <>
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] mt-1">추가</span>
          </>
        )}
      </button>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onSelect(it.id)}
          className="shrink-0 text-left"
          style={{ width: w }}
        >
          <div
            className={`relative rounded-lg overflow-hidden transition-all pointer-events-none ${
              selectedId === it.id
                ? "ring-[3px] ring-black shadow-lg bg-white"
                : "ring-1 ring-neutral-200 opacity-50 hover:opacity-100 bg-white"
            }`}
            style={{ width: w, height: h }}
          >
            <Image src={it.src} alt="" fill className="object-cover" sizes={`${w}px`} />
            {selectedId === it.id && (
              <span className="absolute top-1 right-1 bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow">
                ✓
              </span>
            )}
          </div>
          {it.caption && (
            <div
              className={`mt-1 text-[10px] truncate ${selectedId === it.id ? "text-black font-medium" : "text-neutral-500"}`}
              style={{ width: w }}
            >
              {it.caption}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function GarmentPreviewModal({
  garment, isCurrentSelection, onConfirm, onClose,
}: {
  garment: Garment;
  isCurrentSelection: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          width: "min(500px, 92vw)",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="relative bg-neutral-100" style={{ width: "100%", aspectRatio: "1 / 1" }}>
          <Image
            src={garment.url}
            alt={garment.name ?? ""}
            fill
            className="object-contain"
            sizes="500px"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-neutral-700 shadow"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {garment.name && (
            <div className="font-semibold text-neutral-900 mb-1 truncate">{garment.name}</div>
          )}
          <div className="text-xs text-neutral-500 mb-4">미리보기 · Enter 로 선택</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isCurrentSelection}
              className="flex-[2] py-2.5 rounded-lg bg-black text-white font-semibold disabled:opacity-40"
            >
              {isCurrentSelection ? "이미 선택됨" : "이 옷으로 선택"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ light, small }: { light?: boolean; small?: boolean } = {}) {
  const size = small ? 16 : 28;
  return (
    <div
      className={`animate-spin rounded-full border-2 ${light ? "border-white/30 border-t-white" : "border-neutral-300 border-t-neutral-700"}`}
      style={{ width: size, height: size }}
    />
  );
}
