import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const access = await requireCurrentClinicForApi();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({
        dpa_accepted_at: new Date().toISOString(),
        dpa_version: "v1.4",
        dpa_ip: ip,
      })
      .eq("id", access.clinicId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
