import { randomUUID } from "node:crypto";
import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const IMPERSONATION_TTL_MINUTES = 60;
const COOKIE_NAME = "admin_token";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { slug?: string };
    const slug = body.slug?.trim();

    if (!slug) {
      return NextResponse.json({ error: "slug requerido" }, { status: 400 });
    }

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (clinicError) throw new Error(clinicError.message);
    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    const token = randomUUID();
    const ttlMs = IMPERSONATION_TTL_MINUTES * 60_000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("impersonation_tokens")
      .insert({
        token,
        clinic_slug: slug,
        expires_at: expiresAt,
      });

    if (insertError) throw new Error(insertError.message);

    console.info(
      `[admin-impersonation] start admin=${admin.email} slug=${slug} expires=${expiresAt}`,
    );

    const response = NextResponse.json({ redirect_to: `/clinic/${slug}` });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: IMPERSONATION_TTL_MINUTES * 60,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
