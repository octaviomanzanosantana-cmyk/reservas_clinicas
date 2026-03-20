import {
  createSessionCookieValue,
  getAuthCookieName,
  getSessionMaxAgeSeconds,
} from "@/lib/authSession";
import { getCurrentClinicForUser } from "@/lib/clinicAuth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type LoginRequestBody = {
  email?: string;
  password?: string;
};

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase auth configuration");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y password son obligatorios" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const clinicAccess = await getCurrentClinicForUser(data.user.id);

    if (!clinicAccess) {
      return NextResponse.json(
        { error: "Tu usuario no esta vinculado a ninguna clinica" },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: `/clinic/${clinicAccess.clinicSlug}`,
    });

    response.cookies.set(getAuthCookieName(), createSessionCookieValue(data.user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar sesion" },
      { status: 500 },
    );
  }
}
