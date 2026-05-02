import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_token";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value?.trim();

  if (token) {
    const { data } = await supabaseAdmin
      .from("impersonation_tokens")
      .update({ used: true })
      .eq("token", token)
      .select("clinic_slug")
      .maybeSingle();

    console.info(
      `[admin-impersonation] end slug=${data?.clinic_slug ?? "unknown"}`,
    );
  }

  const response = NextResponse.json({ redirect_to: "/admin/clinics" });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
