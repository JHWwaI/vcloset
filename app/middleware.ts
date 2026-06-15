import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED = ["/closet", "/try-on", "/lookbook", "/onboarding", "/billing"];
// (kept in sync with app routes)

export default auth((req) => {
  const { nextUrl } = req;
  const isProtected = PROTECTED.some((p) => nextUrl.pathname.startsWith(p));
  if (isProtected && !req.auth) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
