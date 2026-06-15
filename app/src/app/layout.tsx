import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "vcloset · 가상 옷장",
  description: "내 사진과 옷 사진으로 가상 피팅",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="glass-bar sticky top-0 z-20">
          <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-extrabold tracking-tight text-lg">
              <span style={{ color: "var(--coral)" }}>v</span>
              <span style={{ color: "var(--ink)" }}>closet</span>
              <span className="ml-1" aria-hidden>🌴</span>
            </Link>
            <div className="flex items-center gap-5 text-sm" style={{ color: "var(--ink-soft)" }}>
              <Link href="/closet" className="hover:text-[color:var(--teal)] transition-colors">옷장</Link>
              <Link href="/try-on" className="hover:text-[color:var(--teal)] transition-colors">피팅</Link>
              <Link href="/onboarding" className="hover:text-[color:var(--teal)] transition-colors">내 사진</Link>
              <Link href="/lookbook" className="hover:text-[color:var(--teal)] transition-colors">룩북</Link>
              {session?.user ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="btn-soft px-3 py-1.5 text-sm">로그아웃</button>
                </form>
              ) : (
                <Link href="/login" className="btn-primary px-4 py-1.5 font-medium">로그인</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
        <footer className="text-xs" style={{ color: "var(--ink-soft)", borderTop: "1px solid var(--line)" }}>
          <div className="max-w-6xl mx-auto px-6 h-12 flex items-center">vcloset · summer edition · local dev</div>
        </footer>
      </body>
    </html>
  );
}
