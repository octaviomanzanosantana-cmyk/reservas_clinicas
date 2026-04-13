import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse, type NextRequest } from "next/server";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    // Check rate limit
    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("attempted_at", windowStart);

    const attempts = count ?? 0;

    if (attempts >= MAX_ATTEMPTS) {
      // Find oldest attempt in window to calculate unlock time
      const { data: oldest } = await supabaseAdmin
        .from("login_attempts")
        .select("attempted_at")
        .eq("email", email)
        .gte("attempted_at", windowStart)
        .order("attempted_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const unlocksAt = oldest?.attempted_at
        ? new Date(new Date(oldest.attempted_at).getTime() + WINDOW_MINUTES * 60_000)
        : new Date(Date.now() + WINDOW_MINUTES * 60_000);
      const minutesLeft = Math.max(1, Math.ceil((unlocksAt.getTime() - Date.now()) / 60_000));

      return NextResponse.json(
        {
          error: "rate_limited",
          message: `Demasiados intentos fallidos. Prueba de nuevo en ${minutesLeft} minuto${minutesLeft > 1 ? "s" : ""}.`,
          minutes_left: minutesLeft,
        },
        { status: 429 },
      );
    }

    // Attempt login via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      // Record failed attempt
      await supabaseAdmin.from("login_attempts").insert({ email, ip_address: ip });

      const remaining = MAX_ATTEMPTS - attempts - 1;
      const raw = authError?.message?.toLowerCase() ?? "";
      const isInvalidCredentials = raw.includes("invalid login credentials") || raw.includes("invalid email or password");
      const isEmailNotConfirmed = raw.includes("email not confirmed");

      const message = isInvalidCredentials
        ? `Email o contraseña incorrectos.${remaining > 0 ? ` Te quedan ${remaining} intento${remaining > 1 ? "s" : ""}.` : ""}`
        : isEmailNotConfirmed
          ? "Debes confirmar tu email antes de acceder."
          : authError?.message ?? "No se pudo iniciar sesión";

      return NextResponse.json({ error: "auth_failed", message }, { status: 401 });
    }

    // Login OK — clear attempts for this email
    await supabaseAdmin
      .from("login_attempts")
      .delete()
      .eq("email", email);

    return NextResponse.json({
      ok: true,
      user_id: authData.user.id,
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de login" },
      { status: 500 },
    );
  }
}
