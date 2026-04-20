import { NextRequest, NextResponse } from "next/server";

import { checkAndRegisterRateLimit } from "@/lib/rateLimit";
import { sendSignupConfirmationEmail } from "@/lib/signupConfirmationEmail";
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
    await sendSignupConfirmationEmail({ to: email, confirmUrl, clinicName });
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
