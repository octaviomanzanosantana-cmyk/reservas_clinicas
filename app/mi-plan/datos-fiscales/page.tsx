import { FiscalDataForm } from "@/components/billing/FiscalDataForm";
import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TaxDataInput, TaxDataRow } from "@/lib/taxData";

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

function toInput(row: TaxDataRow): TaxDataInput {
  return {
    legal_name: row.legal_name,
    tax_id: row.tax_id,
    tax_id_type: row.tax_id_type,
    address_street: row.address_street,
    address_city: row.address_city,
    address_province: row.address_province,
    address_postal_code: row.address_postal_code,
    address_country: row.address_country,
  };
}

export default async function DatosFiscalesPage() {
  const access = await requireCurrentClinicForRequest();

  const [clinicName, existingRow] = await Promise.all([
    getClinicName(access.clinicId),
    getExistingTaxData(access.clinicId),
  ]);

  const existingInput = existingRow ? toInput(existingRow) : null;

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

        <div className="mt-8">
          <FiscalDataForm
            defaultLegalName={clinicName}
            existing={existingInput}
          />
        </div>
      </div>
    </section>
  );
}
