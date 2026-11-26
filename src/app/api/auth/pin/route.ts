import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  computePinToken,
  getExpectedPin,
} from "@/lib/auth";

// Protección anti fuerza bruta por IP (máx 5 intentos fallidos cada 15 minutos)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const globalAttempts = globalThis as unknown as {
  __pinAttempts?: Map<string, AttemptRecord>;
};

function getAttemptMap(): Map<string, AttemptRecord> {
  if (!globalAttempts.__pinAttempts) {
    globalAttempts.__pinAttempts = new Map();
  }
  return globalAttempts.__pinAttempts;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local-client";
}

function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a.padEnd(32, "\0"), "utf8");
  const bufB = Buffer.from(b.padEnd(32, "\0"), "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB) && a.length === b.length;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const attempts = getAttemptMap();
    const now = Date.now();
    const rec = attempts.get(ip);

    if (rec && now < rec.resetAt && rec.count >= MAX_ATTEMPTS) {
      const waitMin = Math.ceil((rec.resetAt - now) / 60000);
      return NextResponse.json(
        {
          error: `Demasiados intentos. Espera ${waitMin} min por seguridad.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const submittedPin = String(body?.pin ?? "").trim();

    if (!submittedPin || submittedPin.length > 16) {
      return NextResponse.json({ error: "Ingresa tu PIN personal" }, { status: 400 });
    }

    const expectedPin = getExpectedPin();
    const isMatch = safeCompareStrings(submittedPin, expectedPin);

    if (!isMatch) {
      const nextCount = rec && now < rec.resetAt ? rec.count + 1 : 1;
      attempts.set(ip, {
        count: nextCount,
        resetAt: rec && now < rec.resetAt ? rec.resetAt : now + WINDOW_MS,
      });
      await new Promise((r) => setTimeout(r, 350));
      return NextResponse.json(
        {
          error: `PIN incorrecto (${Math.max(0, MAX_ATTEMPTS - nextCount)} intentos restantes).`,
        },
        { status: 401 }
      );
    }

    attempts.delete(ip);
    const token = await computePinToken(expectedPin);
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
