import { PaymentMethodSection } from "@/components/billing/PaymentMethodSection";
import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import { InvoicesSection } from "./InvoicesSection";

type ClinicSummary = {
  name: string;
  plan: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  is_pilot: boolean;
};

type TaxDataExists = { clinic_id: string };

async function getClinicSummary(clinicId: string): Promise<ClinicSummary | null> {
  const { data } = await supabaseAdmin
    .from("clinics")
    .select(
      "name, plan, subscription_status, trial_ends_at, stripe_subscription_id, plan_expires_at, is_pilot",
    )
    .eq("id", clinicId)
    .maybeSingle<ClinicSummary>();
  return data ?? null;
}

async function hasFiscalData(clinicId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("tax_data")
    .select("clinic_id")
    .eq("clinic_id", clinicId)
    .maybeSingle<TaxDataExists>();
  return data !== null;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (Number.isNaN(diffMs)) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateES(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function MiPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkoutStatus =
    params.checkout === "success"
      ? "success"
      : params.checkout === "cancel"
        ? "cancel"
        : null;

  const access = await requireCurrentClinicForRequest();

  const [clinic, taxDataExists] = await Promise.all([
    getClinicSummary(access.clinicId),
    hasFiscalData(access.clinicId),
  ]);

  if (!clinic) {
    // Edge case defensivo: la clínica existe en clinic_users pero no
    // en clinics. No debería ocurrir, pero evitamos romper la página.
    return (
      <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
        <div className="px-6 py-8 md:px-8 md:py-9">
          <p className="text-sm text-muted">
            No se pudo cargar la información de tu clínica. Contacta con
            hola@appoclick.com si el problema persiste.
          </p>
        </div>
      </section>
    );
  }

  const trialDaysLeft = daysUntil(clinic.trial_ends_at);
  const isTrial = clinic.subscription_status === "trial";
  const trialEndDate = formatDateES(clinic.trial_ends_at);

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
        <div className="px-6 py-8 md:px-8 md:py-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Mi plan
          </p>
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
            {clinic.name}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Aquí puedes ver el estado de tu plan, completar tus datos fiscales
            y gestionar tu suscripción.
          </p>
        </div>
      </section>

      {/* Estado del plan */}
      <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
        <div className="px-6 py-7 md:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Estado actual
          </p>

          {/* Trial activo */}
          {isTrial && trialDaysLeft !== null && trialDaysLeft > 0 ? (
            <>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                Prueba activa
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Tu prueba gratuita termina en{" "}
                <span className="font-semibold text-foreground">
                  {trialDaysLeft} {trialDaysLeft === 1 ? "día" : "días"}
                </span>
                {trialEndDate ? ` · ${trialEndDate}` : null}.
              </p>
            </>
          ) : null}

          {/* Trial expirado (edge case) */}
          {isTrial && trialDaysLeft !== null && trialDaysLeft <= 0 ? (
            <>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                Tu prueba ha terminado
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Añade un método de pago para seguir usando Appoclick.
              </p>
            </>
          ) : null}

          {/* Active */}
          {clinic.subscription_status === "active" ? (
            <>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                Plan {clinic.plan ?? "Starter"} activo
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                {clinic.is_pilot
                  ? "Tu cuenta es piloto permanente, sin cobro."
                  : "Tu suscripción está al día."}
              </p>
            </>
          ) : null}

          {/* Past due */}
          {clinic.subscription_status === "past_due" ? (
            <div className="mt-3 rounded-[10px] border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm font-semibold text-orange-900">
                Último pago fallido
              </p>
              <p className="mt-1 text-sm text-orange-800">
                Actualiza tu método de pago para evitar que se suspenda tu
                cuenta.
              </p>
            </div>
          ) : null}

          {/* Free */}
          {clinic.subscription_status === "free" ? (
            <>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                Estás en Free
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Límites: 1 servicio y 50 citas/mes. Pasa a Starter cuando lo
                necesites.
              </p>
            </>
          ) : null}

          {/* Canceled */}
          {clinic.subscription_status === "canceled" ? (
            <>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                Suscripción cancelada
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Tu cuenta pasará a Free cuando termine tu periodo pagado.
              </p>
            </>
          ) : null}
        </div>
      </section>

      {/* Datos fiscales */}
      <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
        <div className="px-6 py-7 md:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Datos fiscales
          </p>

          {taxDataExists ? (
            <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  ✓
                </span>
                <p className="text-sm font-medium text-foreground">
                  Datos fiscales completados
                </p>
              </div>
              <Link
                href="/mi-plan/datos-fiscales"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Editar
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                Completa tus datos fiscales
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Los necesitamos antes de que añadas un método de pago para
                poder emitir tus facturas correctamente.
              </p>
              <Link
                href="/mi-plan/datos-fiscales"
                className="mt-4 inline-flex rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
              >
                Completar datos fiscales
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Método de pago */}
      <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
        <div className="px-6 py-7 md:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Método de pago
          </p>
          <div className="mt-4">
            <PaymentMethodSection
              hasSubscription={Boolean(clinic.stripe_subscription_id)}
              hasFiscalData={taxDataExists}
              planExpiresAt={clinic.plan_expires_at ?? null}
              checkoutStatus={checkoutStatus}
            />
          </div>
        </div>
      </section>

      {/* Comprobantes */}
      <InvoicesSection trialEndsAt={clinic.trial_ends_at} />

      {/* Footer de ayuda */}
      <section className="px-6 md:px-8">
        <p className="text-xs text-muted">
          ¿Necesitas ayuda? Escríbenos a{" "}
          <a
            href="mailto:hola@appoclick.com"
            className="font-medium text-primary hover:underline"
          >
            hola@appoclick.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
