"use client";

import {
  EU_COUNTRIES,
  SPAIN_PROVINCES,
  type TaxDataInput,
  type TaxIdType,
  validateTaxIdFormat,
} from "@/lib/taxData";
import { useState } from "react";
import { toast } from "sonner";

type FiscalDataFormProps = {
  defaultLegalName: string;
  existing: TaxDataInput | null;
};

type ApiResponse = {
  ok?: boolean;
  tax_data?: unknown;
  error?: string;
};

// Lista desplegable de países: España primero, luego resto UE alfabético.
const COUNTRY_LABELS: Record<string, string> = {
  AT: "Austria",
  BE: "Bélgica",
  BG: "Bulgaria",
  CY: "Chipre",
  CZ: "Chequia",
  DE: "Alemania",
  DK: "Dinamarca",
  EE: "Estonia",
  ES: "España",
  FI: "Finlandia",
  FR: "Francia",
  GR: "Grecia",
  HR: "Croacia",
  HU: "Hungría",
  IE: "Irlanda",
  IT: "Italia",
  LT: "Lituania",
  LU: "Luxemburgo",
  LV: "Letonia",
  MT: "Malta",
  NL: "Países Bajos",
  PL: "Polonia",
  PT: "Portugal",
  RO: "Rumanía",
  SE: "Suecia",
  SI: "Eslovenia",
  SK: "Eslovaquia",
};

const COUNTRY_OPTIONS = [
  { code: "ES", label: "España" },
  ...EU_COUNTRIES.filter((c) => c !== "ES")
    .map((c) => ({ code: c, label: COUNTRY_LABELS[c] ?? c }))
    .sort((a, b) => a.label.localeCompare(b.label, "es")),
];

type TaxIdTypeOption = {
  value: TaxIdType;
  label: string;
  format: string;
  example: string;
};

const TAX_ID_TYPE_OPTIONS: TaxIdTypeOption[] = [
  {
    value: "cif",
    label: "CIF (empresa)",
    format: "Letra + 7 dígitos + letra/dígito",
    example: "B76357201",
  },
  {
    value: "dni_autonomo",
    label: "DNI (autónomo)",
    format: "8 dígitos + letra",
    example: "12345678Z",
  },
  {
    value: "nie_empresarial",
    label: "NIE (empresarial)",
    format: "X/Y/Z + 7 dígitos + letra",
    example: "X1234567L",
  },
  {
    value: "vat_eu",
    label: "VAT intracomunitario (UE)",
    format: "Código país + número",
    example: "FR12345678901",
  },
];

export function FiscalDataForm({
  defaultLegalName,
  existing,
}: FiscalDataFormProps) {
  const [legalName, setLegalName] = useState(
    existing?.legal_name ?? defaultLegalName,
  );
  const [taxId, setTaxId] = useState(existing?.tax_id ?? "");
  const [taxIdType, setTaxIdType] = useState<TaxIdType>(
    existing?.tax_id_type ?? "cif",
  );
  const [country, setCountry] = useState(existing?.address_country ?? "ES");
  const [province, setProvince] = useState(existing?.address_province ?? "");
  const [street, setStreet] = useState(existing?.address_street ?? "");
  const [city, setCity] = useState(existing?.address_city ?? "");
  const [postalCode, setPostalCode] = useState(
    existing?.address_postal_code ?? "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSpain = country === "ES";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    // Validaciones frontend --------------------------------------
    const trimmedLegalName = legalName.trim();
    const trimmedTaxId = taxId.trim().toUpperCase().replace(/[\s-]/g, "");

    if (!trimmedLegalName || trimmedLegalName.length < 3) {
      setErrorMessage("La razón social es obligatoria (mínimo 3 caracteres).");
      setSubmitting(false);
      return;
    }
    if (!trimmedTaxId) {
      setErrorMessage("El identificador fiscal es obligatorio.");
      setSubmitting(false);
      return;
    }
    if (!validateTaxIdFormat(trimmedTaxId, taxIdType)) {
      const opt = TAX_ID_TYPE_OPTIONS.find((o) => o.value === taxIdType);
      setErrorMessage(
        opt
          ? `El formato no es válido. Esperado: ${opt.format} · Ej: ${opt.example}`
          : "El formato del identificador fiscal no es válido.",
      );
      setSubmitting(false);
      return;
    }
    if (isSpain && !province.trim()) {
      setErrorMessage("Selecciona la provincia.");
      setSubmitting(false);
      return;
    }

    // POST al API -----------------------------------------------
    try {
      const response = await fetch("/api/billing/tax-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: trimmedLegalName,
          tax_id: trimmedTaxId,
          tax_id_type: taxIdType,
          address_street: street.trim() || null,
          address_city: city.trim() || null,
          address_province: isSpain ? province.trim() : null,
          address_postal_code: postalCode.trim() || null,
          address_country: country,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        toast.error("No se pudieron guardar los datos fiscales", {
          description: data.error ?? "Inténtalo de nuevo en unos minutos.",
        });
        return;
      }

      toast.success("Datos fiscales guardados", {
        description:
          "Ya puedes añadir un método de pago cuando quieras.",
      });
    } catch {
      toast.error("No se pudieron guardar los datos fiscales", {
        description: "Error de conexión. Inténtalo de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTypeOption = TAX_ID_TYPE_OPTIONS.find(
    (opt) => opt.value === taxIdType,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Razón social */}
      <label className="block">
        <span className="text-sm font-medium text-foreground">Razón social</span>
        <input
          type="text"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="ANALOGICAMENTE DIGITALES S.L."
          required
          autoComplete="organization"
        />
      </label>

      {/* Tipo de identificador */}
      <label className="block">
        <span className="text-sm font-medium text-foreground">
          Tipo de identificador fiscal
        </span>
        <select
          value={taxIdType}
          onChange={(event) => setTaxIdType(event.target.value as TaxIdType)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
        >
          {TAX_ID_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {selectedTypeOption ? (
          <span className="mt-1.5 block text-xs text-muted">
            {selectedTypeOption.format}. Ej: {selectedTypeOption.example}
          </span>
        ) : null}
      </label>

      {/* Identificador fiscal */}
      <label className="block">
        <span className="text-sm font-medium text-foreground">
          Identificador fiscal
        </span>
        <input
          type="text"
          value={taxId}
          onChange={(event) => setTaxId(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm uppercase text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="B76357201"
          required
          autoComplete="off"
        />
      </label>

      {/* País */}
      <label className="block">
        <span className="text-sm font-medium text-foreground">País</span>
        <select
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            if (event.target.value !== "ES") {
              setProvince("");
            }
          }}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-muted">
          En esta fase Appoclick solo acepta empresas y profesionales de España
          o UE.
        </span>
      </label>

      {/* Provincia (solo si país=ES) */}
      {isSpain ? (
        <label className="block">
          <span className="text-sm font-medium text-foreground">Provincia</span>
          <select
            value={province}
            onChange={(event) => setProvince(event.target.value)}
            className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
            required
          >
            <option value="">Selecciona provincia…</option>
            {SPAIN_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Dirección: calle */}
      <label className="block">
        <span className="text-sm font-medium text-foreground">
          Calle y número
        </span>
        <input
          type="text"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="Calle Fresno 2"
          autoComplete="street-address"
        />
      </label>

      {/* Dirección: ciudad + código postal en grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Ciudad / Localidad
          </span>
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
            placeholder="Telde"
            autoComplete="address-level2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Código postal
          </span>
          <input
            type="text"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
            placeholder="35200"
            autoComplete="postal-code"
          />
        </label>
      </div>

      {/* Errores de validación inline (campos mal rellenados) */}
      {errorMessage ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      ) : null}

      {/* Botón */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Guardando..." : "Guardar datos fiscales"}
      </button>
    </form>
  );
}
