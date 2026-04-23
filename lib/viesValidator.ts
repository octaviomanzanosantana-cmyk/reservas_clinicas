import "server-only";

import { EU_COUNTRIES } from "./taxData";

/**
 * Validador de VAT intracomunitario contra el servicio VIES oficial de la UE.
 *
 * Endpoint REST público:
 *   GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{CC}/vat/{NUMBER}
 *
 * Principios:
 *  - Timeout 5s. Si se agota, devolvemos { valid: false, reason: "timeout" }.
 *  - NUNCA lanza excepción. Todo error de red/servidor se traduce a un
 *    VatValidationResult estructurado.
 *  - Validación sintáctica previa: si el input no empieza por código UE
 *    válido, corto sin hacer fetch.
 *  - Este validador es control de calidad interno. Un resultado
 *    valid=false NO bloquea el guardado fiscal — el caller decide
 *    qué hacer.
 */

export type VatValidationReason =
  | "invalid_format"
  | "not_registered"
  | "service_unavailable"
  | "timeout"
  | "unknown_error";

export type VatValidationResult =
  | {
      valid: true;
      validatedAt: string; // ISO timestamp
      countryCode: string;
      vatNumber: string;
      name: string | null;
    }
  | {
      valid: false;
      reason: VatValidationReason;
      details?: string;
    };

const VIES_BASE_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const VIES_TIMEOUT_MS = 5000;

/**
 * Respuesta esperada del endpoint REST oficial.
 * Solo listamos los campos que consumimos; el resto se ignora.
 */
interface ViesApiResponse {
  isValid?: boolean;
  requestDate?: string;
  userError?: string;
  name?: string | null;
  countryCode?: string;
  vatNumber?: string;
}

/**
 * Separa un VAT intracomunitario en country code + número.
 * Espera formato "ESB76357201", "DE123456789", etc.
 * Acepta espacios, guiones y minúsculas — los normaliza.
 *
 * Devuelve null si el formato es claramente inválido.
 */
export function parseVatIntracomunitario(
  rawVat: string,
): { countryCode: string; vatNumber: string } | null {
  const clean = rawVat.trim().toUpperCase().replace(/[\s-]/g, "");
  if (clean.length < 4) return null;

  const countryCode = clean.slice(0, 2);
  const vatNumber = clean.slice(2);

  if (!EU_COUNTRIES.includes(countryCode)) return null;
  if (!/^[A-Z0-9]{2,12}$/.test(vatNumber)) return null;

  return { countryCode, vatNumber };
}

/**
 * Valida un VAT intracomunitario contra VIES.
 *
 * Formato esperado del input: "ESB76357201" (código país + número).
 * No se llama a VIES para ES sin prefijo — el caller debe añadirlo
 * si está validando un CIF español como intracomunitario.
 */
export async function validateVatOnVies(
  rawVat: string,
): Promise<VatValidationResult> {
  const parsed = parseVatIntracomunitario(rawVat);
  if (!parsed) {
    return { valid: false, reason: "invalid_format" };
  }

  const { countryCode, vatNumber } = parsed;
  const url = `${VIES_BASE_URL}/${countryCode}/vat/${vatNumber}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        valid: false,
        reason: "service_unavailable",
        details: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as ViesApiResponse;

    if (data.isValid === true) {
      return {
        valid: true,
        validatedAt: data.requestDate ?? new Date().toISOString(),
        countryCode: data.countryCode ?? countryCode,
        vatNumber: data.vatNumber ?? vatNumber,
        name: data.name ?? null,
      };
    }

    if (data.isValid === false) {
      return {
        valid: false,
        reason: "not_registered",
        details: data.userError ?? undefined,
      };
    }

    return {
      valid: false,
      reason: "unknown_error",
      details: "Respuesta VIES sin campo isValid",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, reason: "timeout" };
    }
    const details = err instanceof Error ? err.message : String(err);
    console.warn("[vies] validation failed", { url, details });
    return { valid: false, reason: "unknown_error", details };
  } finally {
    clearTimeout(timeoutId);
  }
}
