import { randomUUID } from "node:crypto";
import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

function verifyAdmin(request: Request, admin: { id: string; email: string } | null): boolean {
  if (admin) return true;
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret && secret === process.env.ADMIN_API_SECRET?.trim());
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!verifyAdmin(request, admin)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { slug?: string };
    const slug = body.slug?.trim();

    if (!slug) {
      return NextResponse.json({ error: "slug requerido" }, { status: 400 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error } = await supabaseAdmin.from("impersonation_tokens").insert({
      token,
      clinic_slug: slug,
      expires_at: expiresAt,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
