import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionCookie } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/unlock",
  "/api/auth/pin",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.svg",
  "/sw.js",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isValid = await verifySessionCookie(cookie);

  if (!isValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado. Ingresa tu PIN." }, { status: 401 });
    }
    const unlockUrl = new URL("/unlock", request.url);
    return NextResponse.redirect(unlockUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
