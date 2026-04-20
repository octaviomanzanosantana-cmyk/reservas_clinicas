import { NextRequest, NextResponse } from "next/server";

import { wrapEmailHtml } from "@/lib/emailLayout";
import { checkAndRegisterRateLimit } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  clinicName?: unknown;
  dpa_accepted?: unknown;
};

function getAppUrl(): string {
  const appUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://app.appoclick.com";
  return appUrl.replace(/\/+$/, "");
}

async function sendSignupConfirmationEmail(params: {
  to: string;
  confirmUrl: string;
}): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1A1A;">Confirma tu email</h1>
    <p style="margin:0 0 18px;font-size:15px;color:#1A1A1A;">
      Gracias por crear tu cuenta en AppoClick. Haz clic en el botón para confirmar tu email y activar tu panel.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${params.confirmUrl}"
         style="display:inline-block;background-color:#0E9E82;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Confirmar mi email
      </a>
    </p>
    <p style="margin:0 0 12px;font-size:13px;color:#6B7280;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#0E9E82;word-break:break-all;">
      <a href="${params.confirmUrl}" style="color:#0E9E82;">${params.confirmUrl}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      Si no creaste esta cuenta, ignora este email — no se activará nada sin tu confirmación.
    </p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: "Confirma tu email — AppoClick",
      html: wrapEmailHtml(body),
      text: `Confirma tu email en AppoClick: ${params.confirmUrl}\n\nSi no creaste esta cuenta, ignora este email.`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${text}`);
  }
}

export async function POST(request: NextRequest) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const clinicName = typeof body.clinicName === "string" ? body.clinicName.trim() : "";
  const dpaAccepted = body.dpa_accepted === true;
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (!email || !password || !clinicName) {
    return NextResponse.json(
      { error: "email, password y clinicName son requeridos" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  // Rate limit por IP (3 registros / 60 min) y por email (1 intento / 10 min)
  if (clientIp) {
    const ipCheck = await checkAndRegisterRateLimit({
      kind: "signup_ip",
      key: clientIp,
      windowMinutes: 60,
      maxAttempts: 3,
      ipAddress: clientIp,
    });
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado el límite de registros desde esta conexión. Inténtalo más tarde.",
        },
        { status: 429, headers: { "Retry-After": String(ipCheck.retryAfterSeconds) } },
      );
    }
  }

  const emailCheck = await checkAndRegisterRateLimit({
    kind: "signup_email",
    key: email,
    windowMinutes: 10,
    maxAttempts: 1,
    ipAddress: clientIp,
  });
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: "Ya hay un intento de registro reciente con este email. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(emailCheck.retryAfterSeconds) } },
    );
  }

  // Genera signup link + user vía Supabase Admin API. Esto:
  //  - crea auth.users con email_confirmed_at = NULL
  //  - almacena la metadata de la futura clínica en user_metadata
  //  - devuelve hashed_token que usamos en nuestro /auth/confirm
  //
  // NO se crea la fila en `clinics` aquí. La clínica se crea SOLO cuando
  // el usuario confirma el email (endpoint /auth/confirm).
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: {
          clinic_name: clinicName,
          dpa_accepted: dpaAccepted,
          dpa_version: dpaAccepted ? "v1.4" : null,
          dpa_ip: dpaAccepted ? clientIp : null,
        },
      },
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    const msg = linkError?.message ?? "No se pudo crear el registro";
    const lower = msg.toLowerCase();
    const isAlreadyExists =
      lower.includes("already been registered") ||
      lower.includes("already registered") ||
      lower.includes("user already exists") ||
      lower.includes("already exists");
    return NextResponse.json(
      { error: isAlreadyExists ? "Ya existe una cuenta con ese email" : msg },
      { status: isAlreadyExists ? 409 : 400 },
    );
  }

  // Construimos nuestro propio link a /auth/confirm con el hashed_token.
  // /auth/confirm llama a verifyOtp, setea la sesión, y crea la clínica.
  const confirmUrl = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(
    linkData.properties.hashed_token,
  )}&type=signup`;

  try {
    await sendSignupConfirmationEmail({ to: email, confirmUrl });
  } catch (err) {
    // Si el email falla, el user ya existe sin confirmar y puede reenviar
    // desde /verify-email. Registramos pero no rompemos el signup.
    console.error("[register] email send failed", err);
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Te hemos enviado un email para confirmar tu cuenta. Revisa tu bandeja de entrada.",
    },
    { status: 201 },
  );
}
