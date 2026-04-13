import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { wrapEmailHtml } from "@/lib/emailLayout";
import { NextResponse } from "next/server";

const APP_URL = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.appoclick.com";
const CALLBACK_URL = `${APP_URL.replace(/\/+$/, "")}/auth/callback`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    // Generate recovery link via Supabase Admin
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: CALLBACK_URL,
      },
    });

    if (linkError) {
      // Don't reveal if email exists — always return success
      return NextResponse.json({ ok: true });
    }

    const recoveryUrl = data.properties?.action_link;
    if (!recoveryUrl) {
      return NextResponse.json({ ok: true });
    }

    // Send email via Resend
    const apiKey = process.env.EMAIL_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();

    if (!apiKey || !from) {
      return NextResponse.json({ ok: true });
    }

    const subject = "Restablece tu contraseña — AppoClick";

    const text = [
      "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
      "",
      `Haz clic en este enlace para crear una nueva contraseña:`,
      recoveryUrl,
      "",
      "Este enlace caduca en 1 hora.",
      "",
      "Si no has solicitado este cambio, ignora este email.",
      "",
      "— AppoClick · hola@appoclick.com",
    ].join("\n");

    const html = wrapEmailHtml(`
      <p style="margin:0 0 16px;font-size:15px;color:#1A1A1A">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
      </p>

      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px">
        <tr>
          <td style="border-radius:10px;background-color:#0E9E82">
            <a href="${recoveryUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">
              Restablecer contraseña
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:13px;color:#6B7280">
        Este enlace caduca en 1 hora.
      </p>
      <p style="margin:0;font-size:13px;color:#6B7280">
        Si no has solicitado este cambio, ignora este email.
      </p>
    `);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Always return success to prevent email enumeration
    return NextResponse.json({ ok: true });
  }
}
