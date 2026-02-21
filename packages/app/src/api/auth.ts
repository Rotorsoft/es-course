import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

const SECRET = process.env.SESSION_SECRET || crypto.randomUUID();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// === Session tokens (HMAC-signed) ===

export function signToken(payload: { email: string }): string {
  const data = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function verifyToken(token: string): { email: string } | null {
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;

  const expected = createHmac("sha256", SECRET).update(json).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  const data = JSON.parse(Buffer.from(json, "base64url").toString());
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  return { email: data.email };
}

// === Password hashing (scrypt) ===

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(attempt));
  } catch {
    return false;
  }
}
