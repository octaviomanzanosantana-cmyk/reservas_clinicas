import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TaxDataRow } from "@/lib/taxData";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

type PostBody = Partial<{
  interval: "monthly" | "yearly";
}>;

type ClinicForCheckout = {
  id: string;
  slug: string;
  stripe_customer_id: string | null;
  name: string;
};

const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://app.appoclick.com";

/**
 * Mapa de tax_id_type interno → tipo aceptado por Stripe tax_ids.
 * La lista completa está en https://stripe.com/docs/api/customer_tax_ids/object
 * Para España:
 *  - cif → eu_vat (B12345678 se formatea a ESB12345678)
 *  - dni_autonomo → eu_vat
 *  - nie_empresarial → eu_vat
 *  - vat_eu → eu_vat (el país ya está en el prefijo)
 */
function formatVatForStripe(
  taxId: string,
  taxIdType: string,
  country: string,
): { type: Stripe.TaxIdCreateParams["type"]; value: string } | null {
  const clean = taxId.trim().toUpperCase().replace(/[\s-]/g, "");
  const countryUpper = country.trim().toUpperCase();

  // Si ya empieza por prefijo de país UE (típico vat_eu), úsalo tal cual.
  if (/^[A-Z]{2}/.test(clean) && clean.length > 2) {
    const prefix = clean.slice(0, 2);
    // Si el prefijo coincide con el country, es un VAT completo.
    if (prefix === countryUpper) {
      return { type: "eu_vat", value: clean };
    }
  }

  // Caso ES: añadir prefijo ES al CIF/DNI/NIE.
  if (countryUpper === "ES") {
    if (
      taxIdType === "cif" ||
      taxIdType === "dni_autonomo" ||
      taxIdType === "nie_empresarial"
    ) {
      return { type: "eu_vat", value: `ES${clean}` };
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    const interval = body.interval;

    if (interval !== "monthly" && interval !== "yearly") {
      return NextResponse.json(
        { error: "interval debe ser 'monthly' o 'yearly'" },
        { status: 400 },
      );
    }

    // Auth + ownership --------------------------------------------
    const access = await requireCurrentClinicForApi();

    // Precio según interval (env-var driven vía lib/stripe.ts) ----
    const priceEnvKey =
      interval === "monthly"
        ? process.env[
            `STRIPE_PRICE_STARTER_MONTHLY_${
              (process.env.STRIPE_MODE || "test").toUpperCase() === "LIVE"
                ? "LIVE"
                : "TEST"
            }`
          ]
        : process.env[
            `STRIPE_PRICE_STARTER_YEARLY_${
              (process.env.STRIPE_MODE || "test").toUpperCase() === "LIVE"
                ? "LIVE"
                : "TEST"
            }`
          ];

    const priceId = priceEnvKey?.trim();

    if (!priceId) {
      console.error("[api/billing/setup-checkout] missing price id", {
        interval,
        mode: process.env.STRIPE_MODE,
      });
      return NextResponse.json(
        { error: "Plan no disponible. Contacta con soporte." },
        { status: 500 },
      );
    }

    // Obtener clínica + tax_data ----------------------------------
    const [{ data: clinic }, { data: taxData }] = await Promise.all([
      supabaseAdmin
        .from("clinics")
        .select("id, slug, stripe_customer_id, name")
        .eq("id", access.clinicId)
        .maybeSingle<ClinicForCheckout>(),
      supabaseAdmin
        .from("tax_data")
        .select("*")
        .eq("clinic_id", access.clinicId)
        .maybeSingle<TaxDataRow>(),
    ]);

    if (!clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 },
      );
    }

    if (!taxData) {
      return NextResponse.json(
        {
          error:
            "Completa tus datos fiscales antes de añadir un método de pago",
          missingTaxData: true,
        },
        { status: 400 },
      );
    }

    // Email del owner para Customer ------------------------------
    const { data: userRow } = await supabaseAdmin
      .from("clinic_users")
      .select("user_id")
      .eq("clinic_id", access.clinicId)
      .maybeSingle<{ user_id: string }>();

    let ownerEmail: string | null = null;
    if (userRow?.user_id) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(
        userRow.user_id,
      );
      ownerEmail = user?.user?.email ?? null;
    }

    if (!ownerEmail) {
      return NextResponse.json(
        { error: "No se pudo determinar el email del titular" },
        { status: 500 },
      );
    }

    // Crear o reutilizar Customer --------------------------------
    const stripe = getStripe();
    let customerId = clinic.stripe_customer_id;

    if (!customerId) {
      const taxIdForStripe = formatVatForStripe(
        taxData.tax_id,
        taxData.tax_id_type,
        taxData.address_country,
      );

      const customer = await stripe.customers.create({
        email: ownerEmail,
        name: taxData.legal_name,
        metadata: { clinic_id: clinic.id, clinic_slug: clinic.slug },
        address: {
          line1: taxData.address_street ?? undefined,
          city: taxData.address_city ?? undefined,
          state: taxData.address_province ?? undefined,
          postal_code: taxData.address_postal_code ?? undefined,
          country: taxData.address_country,
        },
        tax_id_data: taxIdForStripe ? [taxIdForStripe] : undefined,
      });

      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from("clinics")
        .update({ stripe_customer_id: customerId })
        .eq("id", clinic.id);

      if (updateError) {
        console.error(
          "[api/billing/setup-checkout] failed to save customer_id",
          { clinicId: clinic.id, error: updateError.message },
        );
        // No abortamos: el customer existe en Stripe, mejor continuar
        // con el checkout y dejar el webhook / un retry posterior
        // sincronizar el customer_id.
      }
    }

    // Crear Checkout Session mode=setup --------------------------
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${APP_URL}/mi-plan?checkout=success`,
      cancel_url: `${APP_URL}/mi-plan?checkout=cancel`,
      metadata: {
        clinic_id: clinic.id,
        interval,
        price_id: priceId,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe no devolvió URL de checkout" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/setup-checkout] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Error al iniciar el checkout" },
      { status: 500 },
    );
  }
}
