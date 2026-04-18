import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { createClinicBlock } from "@/lib/clinicBlocks";
import { NextResponse } from "next/server";

type CreateBlockRequest = {
  clinicSlug?: string;
  start_date?: string;
  end_date?: string;
  reason?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBlockRequest;
    const clinicSlug = body.clinicSlug?.trim();
    const startDate = body.start_date?.trim();
    const endDate = body.end_date?.trim();
    const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }
    if (!startDate || !DATE_RE.test(startDate)) {
      return NextResponse.json({ error: "start_date inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!endDate || !DATE_RE.test(endDate)) {
      return NextResponse.json({ error: "end_date inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json(
        { error: "La fecha fin debe ser igual o posterior a la fecha inicio" },
        { status: 400 },
      );
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });
    const block = await createClinicBlock(
      access.clinicId,
      startDate,
      endDate,
      reason,
      access.userId.startsWith("admin-impersonation") ? null : access.userId,
    );

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el bloqueo" },
      { status: 500 },
    );
  }
}
