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
    const { data: record } = await supabaseAdmin
      .from("two_factor_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) {
      return NextResponse.json(
        { error: "no_code", message: "No hay código activo. Solicita uno nuevo." },
        { status: 400 },
      );
    }

    // Check expiry
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("two_factor_codes")
        .update({ used: true })
        .eq("id", record.id);

      return NextResponse.json(
        { error: "expired", message: "El código ha caducado. Solicita uno nuevo." },
        { status: 400 },
      );
    }

    // Check max attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("two_factor_codes")
        .update({ used: true })
        .eq("id", record.id);

      return NextResponse.json(
        { error: "max_attempts", message: "Demasiados intentos. Solicita un nuevo código." },
        { status: 400 },
      );
    }

    // Verify code
    const codeHash = hashCode(code);
    if (codeHash !== record.code_hash) {
      // Increment attempts
      await supabaseAdmin
        .from("two_factor_codes")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      const remaining = MAX_ATTEMPTS - record.attempts - 1;
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
    await supabaseAdmin
      .from("two_factor_codes")
      .update({ used: true })
      .eq("id", record.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error verificando código" },
      { status: 500 },
    );
  }
}
