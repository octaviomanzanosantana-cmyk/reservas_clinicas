import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type ClinicForInvoices = {
  stripe_customer_id: string | null;
};

export type InvoiceSummary = {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
};

export async function GET() {
  try {
    const access = await requireCurrentClinicForApi();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("stripe_customer_id")
      .eq("id", access.clinicId)
      .maybeSingle<ClinicForInvoices>();

    if (!clinic?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = getStripe();

    let stripeInvoices;
    try {
      stripeInvoices = await stripe.invoices.list({
        customer: clinic.stripe_customer_id,
        limit: 12,
        status: "paid",
      });
    } catch (error) {
      console.error("[api/billing/invoices] stripe.invoices.list failed", {
        clinicId: access.clinicId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ invoices: [] });
    }

    const invoices: InvoiceSummary[] = stripeInvoices.data
      .filter((invoice) => invoice.amount_paid > 0)
      .map((invoice) => ({
        id: invoice.id ?? "",
        created: invoice.created,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
        invoice_pdf: invoice.invoice_pdf ?? null,
        description:
          invoice.description ??
          invoice.lines?.data?.[0]?.description ??
          null,
      }));

    return NextResponse.json({ invoices });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/invoices] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ invoices: [] });
  }
}
