import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 3;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { user_id?: string; code?: string };
    const userId = body.user_id?.trim();
    const code = body.code?.trim();

    if (!userId || !code) {
      return NextResponse.json({ error: "user_id y code son requeridos" }, { status: 400 });
    }

    // Get latest unused code for this user
    const { data: codes, error: recordError } = await supabaseAdmin.rpc(
      "get_active_2fa_code",
      { p_user_id: userId },
    );
    const record = codes?.[0] ?? null;

    if (recordError) {
      console.error("[api/auth/verify-2fa-code] record query failed", {
        userId,
        code: recordError.code,
        message: recordError.message,
      });
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 },
      );
    }

    if (!record) {
      return NextResponse.json(
        { error: "no_code", message: "No hay código activo. Solicita uno nuevo." },
        { status: 400 },
      );
    }

    // Check expiry
    if (new Date(record.expires_at).getTime() < Date.now()) {
      // Fire-and-forget intencional: si falla, el guard
      // expires_at < now() sigue rechazando el codigo.
      await supabaseAdmin.rpc("mark_2fa_code_used", { p_code_id: record.id });

      return NextResponse.json(
        { error: "expired", message: "El código ha caducado. Solicita uno nuevo." },
        { status: 400 },
      );
    }

    // Check max attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      // Fire-and-forget intencional: si falla, el guard
      // attempts >= MAX_ATTEMPTS sigue rechazando.
      await supabaseAdmin.rpc("mark_2fa_code_used", { p_code_id: record.id });

      return NextResponse.json(
        { error: "max_attempts", message: "Demasiados intentos. Solicita un nuevo código." },
        { status: 400 },
      );
    }

    // Verify code
    const codeHash = hashCode(code);
    if (codeHash !== record.code_hash) {
      // Increment attempts atomically
      const { data: incremented, error: incError } = await supabaseAdmin.rpc(
        "increment_2fa_attempts",
        { p_code_id: record.id },
      );

      if (incError) {
        console.error(
          "[api/auth/verify-2fa-code] failed to increment attempts (security risk: bruteforce protection bypassed)",
          {
            userId,
            codeId: record.id,
            code: incError.code,
            message: incError.message,
          },
        );
        return NextResponse.json(
          { ok: false, error: "internal_error" },
          { status: 500 },
        );
      }

      const newAttempts = Number(incremented?.[0]?.attempts ?? record.attempts + 1);
      const remaining = MAX_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          error: "invalid_code",
          message: remaining > 0
            ? `Código incorrecto. Te quedan ${remaining} intento${remaining > 1 ? "s" : ""}.`
            : "Código incorrecto. Solicita un nuevo código.",
        },
        { status: 400 },
      );
    }

    // Mark as used
    const { error: usedError } = await supabaseAdmin.rpc("mark_2fa_code_used", {
      p_code_id: record.id,
    });

    if (usedError) {
      console.error(
        "[api/auth/verify-2fa-code] failed to mark code used (security risk: code may be reused)",
        {
          userId,
          codeId: record.id,
          code: usedError.code,
          message: usedError.message,
        },
      );
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/auth/verify-2fa-code] uncaught error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
