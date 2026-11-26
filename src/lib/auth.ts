export const AUTH_COOKIE_NAME = "health_os_session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 días

export function getExpectedPin(): string {
  return (process.env.APP_PIN || "2580").trim();
}

function getSecret(): string {
  return (process.env.AUTH_SECRET || "health-os-personal-secret-v1").trim();
}

/**
 * Genera un hash SHA-256 determinístico compatible con Edge Runtime (Middleware) y Node.js
 */
export async function computePinToken(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`health-os:${pin}:${getSecret()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifySessionCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expectedToken = await computePinToken(getExpectedPin());
  return cookieValue === expectedToken;
}
