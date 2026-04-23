import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  computeTaxRegime,
  isEuCountry,
  type TaxDataInput,
  type TaxIdType,
  validateTaxIdFormat,
} from "@/lib/taxData";
import { validateVatOnVies } from "@/lib/viesValidator";
import { NextResponse } from "next/server";

type PostBody = Partial<{
  legal_name: string;
  tax_id: string;
  tax_id_type: TaxIdType;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  address_country: string;
}>;

const VALID_TAX_ID_TYPES: TaxIdType[] = [
  "cif",
  "dni_autonomo",
  "nie_empresarial",
  "vat_eu",
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;

    // Validaciones defensivas ----------------------------------------
    const legal_name = body.legal_name?.trim();
    const tax_id = body.tax_id?.trim().toUpperCase().replace(/[\s-]/g, "");
    const tax_id_type = body.tax_id_type;
    const address_country = (body.address_country ?? "ES").trim().toUpperCase();
    const address_province = body.address_province?.trim() || null;
    const address_street = body.address_street?.trim() || null;
    const address_city = body.address_city?.trim() || null;
    const address_postal_code = body.address_postal_code?.trim() || null;

    if (!legal_name || legal_name.length < 3) {
      return badRequest("La razón social es obligatoria (mínimo 3 caracteres)");
    }
    if (!tax_id) {
      return badRequest("El identificador fiscal es obligatorio");
    }
    if (!tax_id_type || !VALID_TAX_ID_TYPES.includes(tax_id_type)) {
      return badRequest(
        "Tipo de identificador fiscal no permitido. En esta fase Appoclick solo acepta empresas y autónomos de España o UE.",
      );
    }
    if (!validateTaxIdFormat(tax_id, tax_id_type)) {
      return badRequest("El formato del identificador fiscal no es válido");
    }
    if (!isEuCountry(address_country)) {
      return badRequest(
        "En esta fase Appoclick solo acepta empresas y profesionales en España o UE. Contacta con hola@appoclick.com si tu caso es distinto.",
      );
    }
    if (address_country === "ES" && !address_province) {
      return badRequest("La provincia es obligatoria para España");
    }

    // Auth + ownership ------------------------------------------------
    const access = await requireCurrentClinicForApi();

    // Régimen fiscal calculado ---------------------------------------
    const tax_regime = computeTaxRegime({
      tax_id_type,
      address_country,
      address_province,
    });
    if (!tax_regime) {
      return badRequest(
        "No se pudo determinar el régimen fiscal. Revisa país y provincia.",
      );
    }
    if (tax_regime === "iva_21") {
      return badRequest(
        "Particulares bloqueados en v1. Contacta con hola@appoclick.com.",
      );
    }

    // Validación VIES (no bloqueante) --------------------------------
    let vat_validated = false;
    let vat_validated_at: string | null = null;

    if (tax_id_type === "vat_eu") {
      const result = await validateVatOnVies(tax_id);
      if (result.valid) {
        vat_validated = true;
        vat_validated_at = result.validatedAt;
      }
    }

    // UPSERT en tax_data ---------------------------------------------
    const payload: TaxDataInput & {
      clinic_id: string;
      tax_regime: string;
      vat_validated: boolean;
      vat_validated_at: string | null;
    } = {
      clinic_id: access.clinicId,
      legal_name,
      tax_id,
      tax_id_type,
      address_street,
      address_city,
      address_province,
      address_postal_code,
      address_country,
      tax_regime,
      vat_validated,
      vat_validated_at,
    };

    const { data, error } = await supabaseAdmin
      .from("tax_data")
      .upsert(payload, { onConflict: "clinic_id" })
      .select("*")
      .single();

    if (error) {
      console.error("[api/billing/tax-data] upsert failed", {
        clinicId: access.clinicId,
        error: error.message,
      });
      return NextResponse.json(
        { error: "No se pudieron guardar los datos fiscales" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, tax_data: data });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/tax-data] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Error al procesar los datos fiscales" },
      { status: 500 },
    );
  }
}
