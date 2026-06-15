"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
    else {
      router.push(sp.get("callbackUrl") ?? "/closet");
      router.refresh();
    }
  }

  return (
    <div className="max-w-sm mx-auto py-10">
      <div className="surface-card p-7">
        <h1 className="text-2xl font-bold">로그인 <span aria-hidden>🌴</span></h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }}
            type="email" placeholder="이메일"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded-lg px-3 py-2.5 outline-none focus:border-[color:var(--teal)]"
            style={{ border: "1.5px solid var(--line)", background: "#fff" }}
            type="password" placeholder="비밀번호"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button disabled={loading} className="btn-primary w-full py-2.5 font-semibold">
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <div className="mt-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          계정이 없으신가요? <Link className="font-medium" style={{ color: "var(--coral)" }} href="/signup">가입하기</Link>
        </div>
      </div>
    </div>
  );
}
