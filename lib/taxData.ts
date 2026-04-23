/**
 * Datos fiscales de la clínica.
 *
 * Este módulo contiene types + lógica pura relativa a la tabla tax_data:
 *  - Tipos espejo del schema (TaxDataRow, TaxDataInput).
 *  - Helpers de detección de régimen fiscal (computeTaxRegime).
 *  - Validaciones sintácticas de NIF/CIF/NIE/VAT (validateTaxIdFormat).
 *  - Constantes: países UE, provincias españolas, provincias canarias.
 *
 * NO hace I/O. NO llama a Supabase. NO llama a VIES. La validación
 * VIES vive en lib/viesValidator.ts (Commit 2A.3).
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TaxIdType = "cif" | "dni_autonomo" | "nie_empresarial" | "vat_eu";

export type TaxRegime = "igic_7" | "isp" | "isp_intra_ue" | "iva_21";

export interface TaxDataRow {
  clinic_id: string;
  legal_name: string;
  tax_id: string;
  tax_id_type: TaxIdType;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  address_country: string; // ISO-2, default 'ES'
  tax_regime: TaxRegime | null;
  vat_validated: boolean;
  vat_validated_at: string | null; // ISO timestamp
  created_at: string;
  updated_at: string;
}

/**
 * Payload que llega del formulario (sin campos gestionados por servidor).
 */
export interface TaxDataInput {
  legal_name: string;
  tax_id: string;
  tax_id_type: TaxIdType;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null; // obligatorio si country=ES
  address_postal_code: string | null;
  address_country: string; // ISO-2
}

// ---------------------------------------------------------------------------
// Constantes: países UE (ISO-2)
// ---------------------------------------------------------------------------

/**
 * 27 estados miembros UE (ISO-2). Mantiene a España en la lista porque
 * ES también se considera UE — el régimen específico se decide por
 * tax_id_type + provincia, no por país.
 */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.includes(country.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// Constantes: provincias españolas
// ---------------------------------------------------------------------------

export interface SpanishProvince {
  code: string; // código INE de 2 dígitos
  name: string;
}

/**
 * 52 provincias españolas (50 peninsulares + Ceuta + Melilla).
 * Código INE de 2 dígitos (zero-padded).
 */
export const SPAIN_PROVINCES: readonly SpanishProvince[] = [
  { code: "01", name: "Álava" },
  { code: "02", name: "Albacete" },
  { code: "03", name: "Alicante" },
  { code: "04", name: "Almería" },
  { code: "05", name: "Ávila" },
  { code: "06", name: "Badajoz" },
  { code: "07", name: "Illes Balears" },
  { code: "08", name: "Barcelona" },
  { code: "09", name: "Burgos" },
  { code: "10", name: "Cáceres" },
  { code: "11", name: "Cádiz" },
  { code: "12", name: "Castellón" },
  { code: "13", name: "Ciudad Real" },
  { code: "14", name: "Córdoba" },
  { code: "15", name: "A Coruña" },
  { code: "16", name: "Cuenca" },
  { code: "17", name: "Girona" },
  { code: "18", name: "Granada" },
  { code: "19", name: "Guadalajara" },
  { code: "20", name: "Gipuzkoa" },
  { code: "21", name: "Huelva" },
  { code: "22", name: "Huesca" },
  { code: "23", name: "Jaén" },
  { code: "24", name: "León" },
  { code: "25", name: "Lleida" },
  { code: "26", name: "La Rioja" },
  { code: "27", name: "Lugo" },
  { code: "28", name: "Madrid" },
  { code: "29", name: "Málaga" },
  { code: "30", name: "Murcia" },
  { code: "31", name: "Navarra" },
  { code: "32", name: "Ourense" },
  { code: "33", name: "Asturias" },
  { code: "34", name: "Palencia" },
  { code: "35", name: "Las Palmas" },
  { code: "36", name: "Pontevedra" },
  { code: "37", name: "Salamanca" },
  { code: "38", name: "Santa Cruz de Tenerife" },
  { code: "39", name: "Cantabria" },
  { code: "40", name: "Segovia" },
  { code: "41", name: "Sevilla" },
  { code: "42", name: "Soria" },
  { code: "43", name: "Tarragona" },
  { code: "44", name: "Teruel" },
  { code: "45", name: "Toledo" },
  { code: "46", name: "Valencia" },
  { code: "47", name: "Valladolid" },
  { code: "48", name: "Bizkaia" },
  { code: "49", name: "Zamora" },
  { code: "50", name: "Zaragoza" },
  { code: "51", name: "Ceuta" },
  { code: "52", name: "Melilla" },
] as const;

export const CANARIAS_PROVINCE_CODES: readonly string[] = ["35", "38"] as const;

export function isCanariasProvince(province: string | null): boolean {
  if (!province) return false;
  return CANARIAS_PROVINCE_CODES.includes(province.trim());
}

// ---------------------------------------------------------------------------
// computeTaxRegime
// ---------------------------------------------------------------------------

export interface ComputeTaxRegimeInput {
  tax_id_type: TaxIdType;
  address_country: string;
  address_province: string | null;
}

/**
 * Detecta el régimen fiscal aplicable a partir del tipo de identificador,
 * país y provincia.
 *
 * Matriz (validada con Biplaza, 23/04/2026):
 *  - Cualquier tipo + provincia Canarias (35/38) → igic_7
 *  - CIF / dni_autonomo / nie_empresarial + peninsular ES → isp
 *  - vat_eu (country ≠ ES, dentro de UE) → isp_intra_ue
 *  - Particulares (no representables en enum actual) → iva_21 (BLOQUEADO v1)
 *
 * Nota: el enum tax_id_type no incluye 'dni' ni 'nie' particulares, así que
 * el caso iva_21 NO debería ocurrir en v1. Se mantiene la rama por
 * defensa, devolviendo null si llega algo inesperado (el caller debe
 * manejar null como "régimen indeterminado, bloquear guardado").
 */
export function computeTaxRegime(input: ComputeTaxRegimeInput): TaxRegime | null {
  const country = input.address_country.trim().toUpperCase();
  const isES = country === "ES";
  const isCanarias = isES && isCanariasProvince(input.address_province);

  // Canarias siempre IGIC, independientemente del tipo de identificador.
  if (isCanarias) return "igic_7";

  // Empresa peninsular o autónomo peninsular → ISP
  if (
    isES &&
    (input.tax_id_type === "cif" ||
      input.tax_id_type === "dni_autonomo" ||
      input.tax_id_type === "nie_empresarial")
  ) {
    return "isp";
  }

  // VAT intracomunitario (UE fuera de España)
  if (input.tax_id_type === "vat_eu" && isEuCountry(country) && country !== "ES") {
    return "isp_intra_ue";
  }

  // Caso indeterminado: no debería ocurrir con validaciones de form
  return null;
}

// ---------------------------------------------------------------------------
// validateTaxIdFormat
// ---------------------------------------------------------------------------

/**
 * Validación sintáctica básica del identificador fiscal. NO verifica
 * contra ningún servicio externo — eso es responsabilidad de VIES
 * (lib/viesValidator.ts).
 *
 * Patrones:
 *  - cif: letra + 7 dígitos + letra/dígito (AKPQSNW obligatorio letra final)
 *    Simplificado: letra [ABCDEFGHJPQRSUVNW] + 7 dígitos + [0-9A-J]
 *  - dni_autonomo: 8 dígitos + letra
 *  - nie_empresarial: [XYZ] + 7 dígitos + letra
 *  - vat_eu: 2 letras país UE + 2-12 alfanuméricos
 */
export function validateTaxIdFormat(taxId: string, type: TaxIdType): boolean {
  const clean = taxId.trim().toUpperCase().replace(/[\s-]/g, "");

  switch (type) {
    case "cif":
      return /^[ABCDEFGHJPQRSUVNW]\d{7}[0-9A-J]$/.test(clean);
    case "dni_autonomo":
      return /^\d{8}[A-Z]$/.test(clean);
    case "nie_empresarial":
      return /^[XYZ]\d{7}[A-Z]$/.test(clean);
    case "vat_eu": {
      const countryPrefix = clean.slice(0, 2);
      const rest = clean.slice(2);
      if (!EU_COUNTRIES.includes(countryPrefix)) return false;
      return /^[A-Z0-9]{2,12}$/.test(rest);
    }
    default: {
      const _exhaustive: never = type;
      return false;
    }
  }
}
