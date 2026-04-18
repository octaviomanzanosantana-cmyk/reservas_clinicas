import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { countAppointmentsInBlockRange } from "@/lib/clinicBlocks";
import { NextResponse } from "next/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    const startDate = searchParams.get("start_date")?.trim();
    const endDate = searchParams.get("end_date")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }
    if (!startDate || !DATE_RE.test(startDate) || !endDate || !DATE_RE.test(endDate)) {
      return NextResponse.json({ error: "start_date y end_date requeridos (YYYY-MM-DD)" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });
    const count = await countAppointmentsInBlockRange(access.clinicId, startDate, endDate);

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al contar citas" },
      { status: 500 },
    );
  }
}
