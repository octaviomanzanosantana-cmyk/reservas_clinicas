import { createHash, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { wrapEmailHtml } from "@/lib/emailLayout";
import { NextResponse } from "next/server";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generate6DigitCode(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { user_id?: string; email?: string };
    const userId = body.user_id?.trim();
    const email = body.email?.trim();

    if (!userId || !email) {
      return NextResponse.json({ error: "user_id y email son requeridos" }, { status: 400 });
    }

    // Rate limit: check if a code was sent less than 60s ago
    const { data: latest, error: latestError } = await supabaseAdmin.rpc(
      "get_latest_2fa_code_time",
      { p_user_id: userId },
    );

    if (latestError) {
      console.error("[api/auth/send-2fa-code] rate-limit query failed", {
        userId,
        code: latestError.code,
        message: latestError.message,
      });
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 },
      );
    }

    const latestCreatedAt = latest?.[0]?.created_at;
    if (latestCreatedAt) {
      const lastSent = new Date(latestCreatedAt).getTime();
      if (Date.now() - lastSent < 60_000) {
        return NextResponse.json({ error: "cooldown", message: "Espera 60 segundos para reenviar" }, { status: 429 });
      }
    }

    // Invalidate previous codes
    const { error: invalidateError } = await supabaseAdmin.rpc(
      "invalidate_active_2fa_codes",
      { p_user_id: userId },
    );

    if (invalidateError) {
      console.error(
        "[api/auth/send-2fa-code] failed to invalidate previous codes",
        {
          userId,
          code: invalidateError.code,
          message: invalidateError.message,
        },
      );
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 },
      );
    }

    const code = generate6DigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insertError } = await supabaseAdmin.rpc("create_2fa_code", {
      p_user_id: userId,
      p_code_hash: codeHash,
      p_expires_at: expiresAt,
    });

    if (insertError) {
      console.error(
        "[api/auth/send-2fa-code] failed to insert new code",
        {
          userId,
          code: insertError.code,
          message: insertError.message,
        },
      );
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 },
      );
    }

    // Send email
    const apiKey = process.env.EMAIL_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();

    if (!apiKey || !from) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const subject = "Tu código de acceso — AppoClick";
    const text = [
      `Tu código de verificación es: ${code}`,
      "",
      "Válido durante 10 minutos. No lo compartas con nadie.",
      "",
      "Si no has solicitado este código, ignora este email.",
      "",
      "— AppoClick · hola@appoclick.com",
    ].join("\n");

    const html = wrapEmailHtml(`
      <div style="text-align:center;padding:8px 0 16px">
        <p style="margin:0;font-size:14px;color:#6B7280">Tu código de verificación:</p>
        <p style="margin:16px 0;font-size:36px;font-weight:700;letter-spacing:8px;color:#1A1A1A">${code}</p>
        <p style="margin:0;font-size:13px;color:#6B7280">Válido durante 10 minutos. No lo compartas con nadie.</p>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;text-align:center">
        Si no has solicitado este código, ignora este email.
      </p>
    `);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });

    if (!emailResponse.ok) {
      throw new Error("Failed to send 2FA email");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/auth/send-2fa-code] uncaught error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
