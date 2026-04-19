import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitCheck = {
  kind: string; // "signup_ip" | "signup_email" | "booking_ip" | "booking_email"
  key: string; // IP or email
  windowMinutes: number;
  maxAttempts: number;
  ipAddress?: string | null;
};

/**
 * Chequea si (kind, key) ha alcanzado el máximo en la ventana temporal.
 * Si NO ha alcanzado, registra un nuevo evento y retorna { allowed: true }.
 * Si SÍ, retorna { allowed: false, retryAfterSeconds }.
 *
 * Implementación: cuenta filas en rate_limit_events dentro de la ventana.
 * Ligero, no requiere Redis, funciona en Vercel serverless.
 */
export async function checkAndRegisterRateLimit(
  check: RateLimitCheck,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - check.windowMinutes * 60_000).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", check.kind)
    .eq("key", check.key)
    .gte("created_at", since);

  if (countError) {
    // En error de DB: fail-open (permitir) para no tumbar la UX legítima.
    // Loggeamos para detectar si es sistémico.
    console.error("[rateLimit] count error", countError);
    return { allowed: true };
  }

  if ((count ?? 0) >= check.maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: check.windowMinutes * 60,
    };
  }

  const { error: insertError } = await supabaseAdmin.from("rate_limit_events").insert({
    kind: check.kind,
    key: check.key,
    ip_address: check.ipAddress?.trim() || null,
  });

  if (insertError) {
    console.error("[rateLimit] insert error", insertError);
    // Aún así permitimos — fail-open
  }

  return { allowed: true };
}

export function getClientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? null;
}
