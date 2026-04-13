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
    const { data: recent } = await supabaseAdmin
      .from("two_factor_codes")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const lastSent = new Date(recent.created_at).getTime();
      if (Date.now() - lastSent < 60_000) {
        return NextResponse.json({ error: "cooldown", message: "Espera 60 segundos para reenviar" }, { status: 429 });
      }
    }

    // Invalidate previous codes
    await supabaseAdmin
      .from("two_factor_codes")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    const code = generate6DigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insertError } = await supabaseAdmin.from("two_factor_codes").insert({
      user_id: userId,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
      attempts: 0,
    });

    console.log("[2fa-send] user_id:", userId, "insert_error:", insertError?.message ?? "none");

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error enviando código" },
      { status: 500 },
    );
  }
}
