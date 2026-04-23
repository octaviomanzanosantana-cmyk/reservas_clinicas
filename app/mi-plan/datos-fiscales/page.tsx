import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TaxDataRow } from "@/lib/taxData";

type ClinicName = { name: string };

async function getClinicName(clinicId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .maybeSingle<ClinicName>();
  return data?.name ?? "Mi clínica";
}

async function getExistingTaxData(
  clinicId: string,
): Promise<TaxDataRow | null> {
  const { data } = await supabaseAdmin
    .from("tax_data")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle<TaxDataRow>();
  return data ?? null;
}

export default async function DatosFiscalesPage() {
  const access = await requireCurrentClinicForRequest();

  const [clinicName, existing] = await Promise.all([
    getClinicName(access.clinicId),
    getExistingTaxData(access.clinicId),
  ]);

  return (
    <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
      <div className="px-6 py-8 md:px-8 md:py-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
          Mi plan
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          Datos fiscales
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Estos datos se usan para emitir tus facturas. Los necesitamos antes
          de que añadas un método de pago.
        </p>

        <div className="mt-8 rounded-[10px] border-[0.5px] border-border bg-background p-6">
          <p className="text-sm text-muted">
            Formulario en construcción. Commit 2A.4b añadirá el componente
            FiscalDataForm con los datos actuales:
          </p>
          <pre className="mt-4 overflow-x-auto text-xs text-foreground">
{JSON.stringify(
  {
    clinicId: access.clinicId,
    clinicName,
    hasExistingData: existing !== null,
    existing: existing
      ? {
          legal_name: existing.legal_name,
          tax_id: existing.tax_id,
          tax_id_type: existing.tax_id_type,
          address_country: existing.address_country,
          tax_regime: existing.tax_regime,
          vat_validated: existing.vat_validated,
        }
      : null,
  },
  null,
  2,
)}
          </pre>
        </div>
      </div>
    </section>
  );
}
