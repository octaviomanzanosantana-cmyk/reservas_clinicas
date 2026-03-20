import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "appoclick_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  exp: number;
};

function getSessionSecret(): string {
  const value = process.env.AUTH_SESSION_SECRET?.trim();
  if (!value) {
    throw new Error("Missing environment variable: AUTH_SESSION_SECRET");
  }
  return value;
}

function signValue(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function encodePayload(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(body);
  return `${body}.${signature}`;
}

function decodePayload(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expectedSignature = signValue(body);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;

  if (!payload.userId || typeof payload.exp !== "number") {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function createSessionCookieValue(userId: string): string {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    throw new Error("userId is required");
  }

  return encodePayload({
    userId: safeUserId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
}

export async function getCurrentUserIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE_NAME)?.value?.trim();
  if (!raw) return null;

  const payload = decodePayload(raw);
  return payload?.userId ?? null;
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getSessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS;
}
