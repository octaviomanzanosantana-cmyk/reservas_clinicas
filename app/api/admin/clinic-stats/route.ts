import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// Shape devuelto por public.get_all_clinics() — 9 columnas estrictas.
type ClinicRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  is_demo: boolean;
  created_at: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
};

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Plan B Bug 1 — RPC SECURITY DEFINER bypasea pool/role stale.
    const { data: clinicsInitial, error: clinicsError } = await supabaseAdmin
      .rpc("get_all_clinics");

    if (clinicsError) {
      console.error("[clinic-stats] clinics query failed", {
        message: clinicsError.message,
        code: clinicsError.code,
        details: clinicsError.details,
      });
      return NextResponse.json({ error: "clinics query failed" }, { status: 500 });
    }

    let clinics: ClinicRow[] = (clinicsInitial as ClinicRow[] | null) ?? [];
    let clinicIds = clinics.map((c) => c.id);

    // Bug-1 signal (intermitente): clinics query OK pero 0 filas.
    // Sin clinicIds no hay nada que enriquecer; devolvemos respuesta vacía
    // valida en vez de inyectar "__none__" en columnas uuid (22P02).
    if (clinicIds.length === 0) {
      // Sanity check dirigido (EJE B'): ¿el cliente tiene service role real?
      // auth.admin.listUsers SOLO funciona con service role legacy JWT (eyJ...).
      // Si falla o devuelve vacio → cliente esta autenticado con anon o con
      // sb_secret_* nuevas que NO bypassan RLS (ver hotfix B7.1 revertido 9/5/26).
      const sanityStart = Date.now();
      const { data: sanityData, error: sanityError } =
        await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

      console.warn("[clinic-stats] zero clinics returned by query", {
        timestamp: new Date().toISOString(),
        sanity: {
          ms: Date.now() - sanityStart,
          hasServiceRole: !sanityError && (sanityData?.users?.length ?? 0) > 0,
          errorCode: (sanityError as { code?: string } | null)?.code,
          errorMessage: sanityError?.message,
          serviceRoleKeyLen: serviceKey.length,
          serviceRoleKeyPrefix: serviceKey.slice(0, 4),
          anonKeyLen: anonKey.length,
          anonKeyPrefix: anonKey.slice(0, 4),
        },
      });

      // Defense-in-depth: segundo intento via RPC (mismo bypass de RLS).
      const retry = await supabaseAdmin.rpc("get_all_clinics");

      if ((retry.data?.length ?? 0) > 0) {
        console.warn("[clinic-stats] retry succeeded — pool stale confirmed (e4)", {
          retryRowCount: retry.data?.length ?? 0,
        });
        clinics = (retry.data as ClinicRow[] | null) ?? [];
        clinicIds = clinics.map((c) => c.id);
        // Fall through al flujo normal de enriquecimiento (clinic_users + appointments).
      } else {
        console.warn("[clinic-stats] retry also returned zero", {
          retryErrorCode: (retry.error as { code?: string } | null)?.code,
          retryErrorMessage: retry.error?.message,
        });
        return NextResponse.json({ clinics: [] });
      }
    }

    // Get owner emails via clinic_users join
    const { data: clinicUsers, error: clinicUsersError } = await supabaseAdmin
      .from("clinic_users")
      .select("clinic_id, user_id")
      .in("clinic_id", clinicIds);

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
      .in("clinic_id", clinicIds);

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
    console.error("[api/admin/clinic-stats] uncaught error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }
}
