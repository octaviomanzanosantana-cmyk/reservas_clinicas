import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { deleteClinicBlock } from "@/lib/clinicBlocks";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const blockId = id?.trim();
    if (!blockId) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });
    await deleteClinicBlock(blockId, access.clinicId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el bloqueo" },
      { status: 500 },
    );
  }
}
