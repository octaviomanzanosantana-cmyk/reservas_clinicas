import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all clinics with their owner email
    const { data: clinics, error: clinicsError } = await supabaseAdmin
      .from("clinics")
      .select("id, slug, name, plan, is_demo, created_at, subscription_status, trial_ends_at, stripe_subscription_id")
      .order("created_at", { ascending: false });

    if (clinicsError) {
      console.error("[clinic-stats] clinics query failed", {
        message: clinicsError.message,
        code: clinicsError.code,
        details: clinicsError.details,
      });
      return NextResponse.json({ error: "clinics query failed" }, { status: 500 });
    }

    const clinicIds = (clinics ?? []).map((c) => c.id);

    // Get owner emails via clinic_users join
    const { data: clinicUsers, error: clinicUsersError } = await supabaseAdmin
      .from("clinic_users")
      .select("clinic_id, user_id")
      .in("clinic_id", clinicIds.length > 0 ? clinicIds : ["__none__"]);

    if (clinicUsersError) {
      console.error("[clinic-stats] clinic_users query failed", {
        message: clinicUsersError.message,
        code: clinicUsersError.code,
        details: clinicUsersError.details,
      });
      return NextResponse.json({ error: "clinic_users query failed" }, { status: 500 });
    }

    const userIds = [...new Set((clinicUsers ?? []).map((cu) => cu.user_id))];
    const userEmails = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: usersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (listUsersError) {
        console.error("[clinic-stats] auth.admin.listUsers failed", {
          message: listUsersError.message,
          code: (listUsersError as { code?: string }).code,
        });
        return NextResponse.json({ error: "listUsers failed" }, { status: 500 });
      }
      const users = usersData?.users;
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
    const { data: counts, error: countsError } = await supabaseAdmin
      .from("appointments")
      .select("clinic_id")
      .in("clinic_id", clinicIds.length > 0 ? clinicIds : ["__none__"]);

    if (countsError) {
      console.error("[clinic-stats] appointments query failed", {
        message: countsError.message,
        code: countsError.code,
        details: countsError.details,
      });
      return NextResponse.json({ error: "appointments query failed" }, { status: 500 });
    }

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
