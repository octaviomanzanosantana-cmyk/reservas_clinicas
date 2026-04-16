import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const admin = await getAdminUser();

  // Fallback: check ADMIN_API_SECRET header if session auth fails
  if (!admin) {
    const authHeader = request.headers.get("x-admin-secret");
    const adminSecret = process.env.ADMIN_API_SECRET?.trim();
    if (!authHeader || !adminSecret || authHeader !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Get all clinics with their owner email
    const { data: clinics } = await supabaseAdmin
      .from("clinics")
      .select("id, slug, name, plan, is_demo, created_at")
      .order("created_at", { ascending: false });

    const clinicIds = (clinics ?? []).map((c) => c.id);

    // Get owner emails via clinic_users join
    const { data: clinicUsers } = await supabaseAdmin
      .from("clinic_users")
      .select("clinic_id, user_id")
      .in("clinic_id", clinicIds.length > 0 ? clinicIds : ["__none__"]);

    const userIds = [...new Set((clinicUsers ?? []).map((cu) => cu.user_id))];
    const userEmails = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users ?? []) {
        if (u.email) userEmails.set(u.id, u.email);
      }
    }

    const clinicOwnerEmail = new Map<string, string>();
    for (const cu of clinicUsers ?? []) {
      const email = userEmails.get(cu.user_id);
      if (email) clinicOwnerEmail.set(cu.clinic_id, email);
    }

    // Count appointments per clinic
    const { data: counts } = await supabaseAdmin
      .from("appointments")
      .select("clinic_id")
      .in("clinic_id", clinicIds.length > 0 ? clinicIds : ["__none__"]);

    const appointmentCounts = new Map<string, number>();
    for (const row of counts ?? []) {
      if (row.clinic_id) {
        appointmentCounts.set(row.clinic_id, (appointmentCounts.get(row.clinic_id) ?? 0) + 1);
      }
    }

    const result = (clinics ?? []).map((c) => ({
      ...c,
      owner_email: clinicOwnerEmail.get(c.id) ?? null,
      appointment_count: appointmentCounts.get(c.id) ?? 0,
    }));

    return NextResponse.json({ clinics: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
