"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "가입에 실패했습니다.");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto py-10">
      <div className="surface-card p-7">
        <h1 className="text-2xl font-bold">회원가입 <span aria-hidden>🐚</span></h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>가입 시 무료 크레딧 5장 지급</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }} placeholder="이름 (선택)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }} type="email" placeholder="이메일"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }} type="password" placeholder="비밀번호 (6자 이상)"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button disabled={loading} className="btn-primary w-full py-2.5 font-semibold">
            {loading ? "가입 중…" : "가입하기"}
          </button>
        </form>
        <div className="mt-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          이미 계정이 있으신가요? <Link className="font-medium" style={{ color: "var(--coral)" }} href="/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
