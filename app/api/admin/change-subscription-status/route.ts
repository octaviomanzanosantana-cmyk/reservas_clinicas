import { getAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const VALID_STATUSES = new Set([
  "trial",
  "active",
  "past_due",
  "canceled",
  "free",
]);

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      clinic_id?: string;
      subscription_status?: string;
    };
    const clinicId = body.clinic_id?.trim();
    const subscriptionStatus = body.subscription_status?.trim();

    if (
      !clinicId ||
      !subscriptionStatus ||
      !VALID_STATUSES.has(subscriptionStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "clinic_id y subscription_status válido requeridos (trial, active, past_due, canceled, free)",
        },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
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
