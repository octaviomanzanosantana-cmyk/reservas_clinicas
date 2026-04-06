"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { PlanUpgrade } from "@/components/PlanUpgrade";
import type { Plan } from "@/lib/plan";
import { useEffect, useState } from "react";

type ClinicPlanPageProps = {
  clinicSlug?: string;
};

export function ClinicPlanPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicPlanPageProps) {
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((data: { clinic?: { plan?: string }; error?: string }) => {
        if (!active) return;
        if (data.clinic) {
          setPlan((data.clinic.plan as Plan) ?? "free");
        } else if (data.error) {
          setErrorMessage(data.error);
        }
      })
      .catch((err) => {
        if (active)
          setErrorMessage(err instanceof Error ? err.message : "Error de carga");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clinicSlug]);

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Tu plan
        </h1>
        <p className="mt-2 text-sm text-muted">
          Gestiona tu suscripción a AppoClick
        </p>
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        {loading ? (
          <p className="text-sm text-muted">Cargando plan...</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : (
          <PlanUpgrade currentPlan={plan} clinicSlug={clinicSlug} />
        )}
      </section>
    </div>
  );
}
