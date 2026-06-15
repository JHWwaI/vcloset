import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  return (
    <section className="py-12">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
        style={{ background: "rgba(20,184,166,0.12)", color: "var(--teal)" }}>
        🌞 Summer Edition · AI 가상 피팅
      </div>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
        이번 여름,<br />입어보고 사세요.
      </h1>
      <p className="mt-4 max-w-xl" style={{ color: "var(--ink-soft)" }}>
        사진 한 장과 옷 한 장이면 충분합니다. AI가 자연스럽게 합성해 보여줍니다.
      </p>
      <div className="mt-8 flex gap-3">
        {session?.user ? (
          <Link href="/closet" className="btn-primary px-6 py-2.5 font-semibold">옷장으로 →</Link>
        ) : (
          <>
            <Link href="/signup" className="btn-primary px-6 py-2.5 font-semibold">무료로 시작</Link>
            <Link href="/login" className="btn-soft px-6 py-2.5 font-medium">로그인</Link>
          </>
        )}
      </div>

      <div className="mt-16 grid sm:grid-cols-3 gap-6">
        {[
          { e: "📸", t: "1. 내 사진 등록", d: "전신 또는 반신 사진 한 장." },
          { e: "🩳", t: "2. 옷 추가", d: "가진 옷 또는 사고 싶은 옷 사진." },
          { e: "✨", t: "3. 입어보기", d: "AI 합성으로 어울리는지 확인." },
        ].map((s) => (
          <div key={s.t} className="surface-card p-5">
            <div className="text-2xl mb-1" aria-hidden>{s.e}</div>
            <div className="font-bold" style={{ color: "var(--ink)" }}>{s.t}</div>
            <div className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
