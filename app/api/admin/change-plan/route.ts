import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const VALID_PLANS = new Set(["free", "starter", "pro"]);

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
    const body = (await request.json()) as { clinic_id?: string; plan?: string };
    const clinicId = body.clinic_id?.trim();
    const plan = body.plan?.trim();

    if (!clinicId || !plan || !VALID_PLANS.has(plan)) {
      return NextResponse.json({ error: "clinic_id y plan válido requeridos" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", clinicId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
