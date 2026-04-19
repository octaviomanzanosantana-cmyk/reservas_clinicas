import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { markReminderSent, unmarkReminderSent } from "@/lib/whatsappReminders";
import { NextResponse } from "next/server";

type MarkRequest = {
  clinicSlug?: string;
  appointmentId?: number;
  sent?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarkRequest;
    const clinicSlug = body.clinicSlug?.trim();
    const appointmentId = typeof body.appointmentId === "number" ? body.appointmentId : null;
    const sent = body.sent === true;

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }
    if (!appointmentId || appointmentId <= 0) {
      return NextResponse.json({ error: "appointmentId inválido" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });

    if (sent) {
      await markReminderSent(appointmentId, access.clinicId);
    } else {
      await unmarkReminderSent(appointmentId, access.clinicId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo marcar el recordatorio" },
      { status: 500 },
    );
  }
}
