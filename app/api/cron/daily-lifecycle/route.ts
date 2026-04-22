import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  sendTrial24HoursEmail,
  sendTrial5DaysEmail,
  sendTrialExpiredEmail,
} from "@/lib/trialEmails";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

type Step = "trial_5d" | "trial_24h" | "trial_expired";

type StepCountsBasic = { sent: number; failed: number };
type StepCountsExpired = { sent: number; failed: number; downgraded: number };

type ProcessedCounts = {
  trial_5d: StepCountsBasic;
  trial_24h: StepCountsBasic;
  trial_expired: StepCountsExpired;
};

type ErrorItem = { clinicId: string; step: Step; error: string };

type TrialClinic = {
  id: string;
  slug: string;
  name: string;
  trial_ends_at: string | null;
  last_trial_email_sent: "5d" | "24h" | "expired" | null;
};

type OwnerInfo = {
  email: string;
  userMetadata: Record<string, unknown> | null;
};

/**
 * Sanitiza un mensaje de error para la respuesta JSON pública:
 *  - reemplaza cualquier token que parezca email por "[email]"
 *  - trunca a 200 chars
 * Los logs internos (console.error) reciben el mensaje original completo.
 */
function sanitizeErrorForResponse(msg: string): string {
  const scrubbed = msg.replace(/\S+@\S+\.\S+/g, "[email]");
  return scrubbed.length > 200 ? scrubbed.slice(0, 200) : scrubbed;
}

/**
 * Decide qué string enviar como toName al email de trial.
 *
 * Regla (Sprint Comercial Chat 3, Fase 3):
 *   - Si auth.users.user_metadata.full_name existe y no está vacío → usarlo.
 *   - Si no → caer al clinicName (nombre de la clínica).
 *   - NUNCA usar el local-part del email (evita "Hola, info" y similares).
 *
 * Esta decisión vive aquí, en el cron, no en lib/trialEmails.ts. La firma
 * de los emails se mantiene agnóstica: reciben toName ya resuelto.
 */
function resolveDisplayName(
  userMetadata: Record<string, unknown> | null,
  clinicName: string,
): string {
  const raw = userMetadata?.full_name;
  const fullName = typeof raw === "string" ? raw.trim() : "";
  return fullName || clinicName;
}

/**
 * Carga clínicas en trial en una ventana temporal específica.
 *
 * @param upperBoundIso   trial_ends_at <= upperBoundIso
 * @param lowerBoundIso   trial_ends_at > lowerBoundIso (null = sin cota inferior)
 * @param allowedLastSent null = solo clínicas con last_trial_email_sent IS NULL.
 *                        array = clínicas con last_trial_email_sent IS NULL
 *                                  O IN (los valores del array).
 */
async function loadTrialClinics(
  upperBoundIso: string,
  lowerBoundIso: string | null,
  allowedLastSent: Array<"5d" | "24h"> | null,
): Promise<TrialClinic[]> {
  let query = supabaseAdmin
    .from("clinics")
    .select("id, slug, name, trial_ends_at, last_trial_email_sent")
    .eq("subscription_status", "trial")
    .eq("is_pilot", false)
    .not("trial_ends_at", "is", null)
    .lte("trial_ends_at", upperBoundIso)
    .order("trial_ends_at", { ascending: true });

  if (lowerBoundIso !== null) {
    query = query.gt("trial_ends_at", lowerBoundIso);
  }

  if (allowedLastSent === null) {
    query = query.is("last_trial_email_sent", null);
  } else {
    const inList = allowedLastSent.join(",");
    query = query.or(
      `last_trial_email_sent.is.null,last_trial_email_sent.in.(${inList})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Clinics query failed: ${error.message}`);
  }
  return (data ?? []) as TrialClinic[];
}

/**
 * Construye un Map clinicId → { email, userMetadata } para la lista de
 * clinic_ids dada. Filtra clinic_users por role='owner' (defensive coding:
 * aunque hoy cada clínica tenga un único clinic_user).
 *
 * Usa un único listUsers({ perPage: 1000 }) para resolver emails de todos
 * los owners en un solo viaje a Supabase Auth. Reutilizado por los 3 pasos.
 */
async function buildOwnerMap(
  clinicIds: string[],
): Promise<Map<string, OwnerInfo>> {
  const result = new Map<string, OwnerInfo>();
  if (clinicIds.length === 0) return result;

  const { data: clinicUsers, error: cuError } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, user_id")
    .eq("role", "owner")
    .in("clinic_id", clinicIds);

  if (cuError) {
    throw new Error(`clinic_users query failed: ${cuError.message}`);
  }

  const clinicIdToUserId = new Map<string, string>();
  for (const cu of clinicUsers ?? []) {
    clinicIdToUserId.set(cu.clinic_id as string, cu.user_id as string);
  }

  const { data: usersList, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) {
    throw new Error(`listUsers failed: ${usersError.message}`);
  }

  const userIdToInfo = new Map<
    string,
    { email: string; metadata: Record<string, unknown> | null }
  >();
  for (const u of usersList?.users ?? []) {
    if (!u.email) continue;
    userIdToInfo.set(u.id, {
      email: u.email,
      metadata: (u.user_metadata as Record<string, unknown> | null) ?? null,
    });
  }

  for (const [clinicId, userId] of clinicIdToUserId) {
    const info = userIdToInfo.get(userId);
    if (!info) continue;
    result.set(clinicId, {
      email: info.email,
      userMetadata: info.metadata,
    });
  }

  return result;
}

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[daily-lifecycle] Starting at ${startedAt.toISOString()}`);

  const counts: ProcessedCounts = {
    trial_5d: { sent: 0, failed: 0 },
    trial_24h: { sent: 0, failed: 0 },
    trial_expired: { sent: 0, failed: 0, downgraded: 0 },
  };
  const errors: ErrorItem[] = [];

  try {
    const now = new Date();
    const isoNow = now.toISOString();
    const iso1Day = new Date(now.getTime() + 1 * 24 * 3_600_000).toISOString();
    const iso5Days = new Date(now.getTime() + 5 * 24 * 3_600_000).toISOString();

    // Ejecutamos las 3 queries de cohortes ANTES de construir el ownerMap,
    // así hacemos un único listUsers para el set unión y lo reutilizamos.
    const clinics5d = await loadTrialClinics(iso5Days, iso1Day, null);
    const clinics24h = await loadTrialClinics(iso1Day, isoNow, ["5d"]);
    const clinicsExpired = await loadTrialClinics(isoNow, null, ["5d", "24h"]);

    const unionClinicIds = Array.from(
      new Set([
        ...clinics5d.map((c) => c.id),
        ...clinics24h.map((c) => c.id),
        ...clinicsExpired.map((c) => c.id),
      ]),
    );
    const ownerMap = await buildOwnerMap(unionClinicIds);

    // ========================================================================
    // PASO 1 · 5 días restantes
    // ========================================================================
    for (const clinic of clinics5d) {
      const owner = ownerMap.get(clinic.id);
      if (!owner) {
        counts.trial_5d.failed += 1;
        const msg = "No owner found for clinic";
        console.error("[daily-lifecycle] trial_5d skipped", {
          clinicId: clinic.id,
          step: "trial_5d",
          error: msg,
        });
        errors.push({ clinicId: clinic.id, step: "trial_5d", error: msg });
        continue;
      }

      const toName = resolveDisplayName(owner.userMetadata, clinic.name);

      try {
        await sendTrial5DaysEmail({
          toEmail: owner.email,
          toName,
          clinicName: clinic.name,
        });

        const { error: updError } = await supabaseAdmin
          .from("clinics")
          .update({ last_trial_email_sent: "5d" })
          .eq("id", clinic.id);

        if (updError) {
          throw new Error(`DB update failed: ${updError.message}`);
        }

        counts.trial_5d.sent += 1;
      } catch (err) {
        counts.trial_5d.failed += 1;
        const fullMsg = err instanceof Error ? err.message : String(err);
        console.error("[daily-lifecycle] trial_5d failed", {
          clinicId: clinic.id,
          step: "trial_5d",
          error: fullMsg,
        });
        errors.push({
          clinicId: clinic.id,
          step: "trial_5d",
          error: sanitizeErrorForResponse(fullMsg),
        });
      }
    }

    // ========================================================================
    // PASO 2 · 24 horas restantes
    // ========================================================================
    for (const clinic of clinics24h) {
      const owner = ownerMap.get(clinic.id);
      if (!owner) {
        counts.trial_24h.failed += 1;
        const msg = "No owner found for clinic";
        console.error("[daily-lifecycle] trial_24h skipped", {
          clinicId: clinic.id,
          step: "trial_24h",
          error: msg,
        });
        errors.push({ clinicId: clinic.id, step: "trial_24h", error: msg });
        continue;
      }

      const toName = resolveDisplayName(owner.userMetadata, clinic.name);

      try {
        await sendTrial24HoursEmail({
          toEmail: owner.email,
          toName,
          clinicName: clinic.name,
        });

        const { error: updError } = await supabaseAdmin
          .from("clinics")
          .update({ last_trial_email_sent: "24h" })
          .eq("id", clinic.id);

        if (updError) {
          throw new Error(`DB update failed: ${updError.message}`);
        }

        counts.trial_24h.sent += 1;
      } catch (err) {
        counts.trial_24h.failed += 1;
        const fullMsg = err instanceof Error ? err.message : String(err);
        console.error("[daily-lifecycle] trial_24h failed", {
          clinicId: clinic.id,
          step: "trial_24h",
          error: fullMsg,
        });
        errors.push({
          clinicId: clinic.id,
          step: "trial_24h",
          error: sanitizeErrorForResponse(fullMsg),
        });
      }
    }

    // ========================================================================
    // PASO 3 · Trial expirado
    // Downgrade primero (atómico: 3 columnas de 1 row en 1 UPDATE).
    // Email después: si falla, la clínica YA está en free (no rollback).
    // ========================================================================
    for (const clinic of clinicsExpired) {
      const { error: updError } = await supabaseAdmin
        .from("clinics")
        .update({
          subscription_status: "free",
          plan: "free",
          last_trial_email_sent: "expired",
        })
        .eq("id", clinic.id);

      if (updError) {
        counts.trial_expired.failed += 1;
        const fullMsg = `DB downgrade failed: ${updError.message}`;
        console.error("[daily-lifecycle] trial_expired downgrade failed", {
          clinicId: clinic.id,
          step: "trial_expired",
          error: fullMsg,
        });
        errors.push({
          clinicId: clinic.id,
          step: "trial_expired",
          error: sanitizeErrorForResponse(fullMsg),
        });
        continue;
      }

      counts.trial_expired.downgraded += 1;

      const owner = ownerMap.get(clinic.id);
      if (!owner) {
        counts.trial_expired.failed += 1;
        const msg = "No owner found for clinic (downgrade applied, email skipped)";
        console.error("[daily-lifecycle] trial_expired email skipped", {
          clinicId: clinic.id,
          step: "trial_expired",
          error: msg,
        });
        errors.push({
          clinicId: clinic.id,
          step: "trial_expired",
          error: msg,
        });
        continue;
      }

      const toName = resolveDisplayName(owner.userMetadata, clinic.name);

      try {
        await sendTrialExpiredEmail({
          toEmail: owner.email,
          toName,
          clinicName: clinic.name,
        });
        counts.trial_expired.sent += 1;
      } catch (err) {
        counts.trial_expired.failed += 1;
        const fullMsg = err instanceof Error ? err.message : String(err);
        console.error(
          "[daily-lifecycle] trial_expired email failed (downgrade already applied)",
          {
            clinicId: clinic.id,
            step: "trial_expired",
            error: fullMsg,
          },
        );
        errors.push({
          clinicId: clinic.id,
          step: "trial_expired",
          error: sanitizeErrorForResponse(fullMsg),
        });
      }
    }

    const summary = {
      timestamp: startedAt.toISOString(),
      processed: counts,
      errors,
    };

    console.log("[daily-lifecycle] Finished:", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (err) {
    const fullMsg = err instanceof Error ? err.message : String(err);
    console.error("[daily-lifecycle] unrecoverable error", { error: fullMsg });
    return NextResponse.json(
      { error: sanitizeErrorForResponse(fullMsg) },
      { status: 500 },
    );
  }
}
