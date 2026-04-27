"use client";

import { useEffect, useState } from "react";

type InvoiceSummary = {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
};

type InvoicesResponse = {
  invoices?: InvoiceSummary[];
  error?: string;
};

type InvoicesSectionProps = {
  trialEndsAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(unix: number): string {
  return dateFormatter.format(new Date(unix * 1000));
}

function formatAmount(amountInCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountInCents / 100);
  } catch {
    return `${(amountInCents / 100).toFixed(2)} €`;
  }
}

function formatTrialDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function inferPlanLabel(
  invoice: InvoiceSummary,
): string {
  if (invoice.description && invoice.description.trim().length > 0) {
    return invoice.description.trim();
  }
  if (invoice.amount_paid === 1900) return "Starter mensual";
  if (invoice.amount_paid === 19000) return "Starter anual";
  return "Suscripción";
}

export function InvoicesSection({ trialEndsAt }: InvoicesSectionProps) {
  const [invoices, setInvoices] = useState<InvoiceSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/billing/invoices", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const data = (await response.json()) as InvoicesResponse;
        if (cancelled) return;
        setInvoices(data.invoices ?? []);
      } catch {
        if (cancelled) return;
        setInvoices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const trialEndFormatted = formatTrialDate(trialEndsAt);

  return (
    <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
      <div className="px-6 py-7 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
          Comprobantes
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          Aquí encuentras tus últimos pagos. Las facturas fiscales oficiales se
          envían por email tras cada cobro.
        </p>

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-muted">Cargando comprobantes…</p>
          ) : invoices && invoices.length > 0 ? (
            <div className="overflow-hidden rounded-[10px] border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Importe
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      <span className="sr-only">Descargar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr
                      key={invoice.id || `invoice-${index}`}
                      className={
                        index === 0
                          ? ""
                          : "border-t border-border"
                      }
                    >
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {formatDate(invoice.created)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {inferPlanLabel(invoice)}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {formatAmount(invoice.amount_paid, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {invoice.invoice_pdf ? (
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path
                                d="M7 1.75v7.5m0 0L4 6.5m3 2.75L10 6.5M2.25 11.25h9.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            PDF
                          </a>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {trialEndFormatted
                ? `Aún no tienes cobros. Verás aquí los comprobantes tras tu primer pago el ${trialEndFormatted}.`
                : "Aún no tienes cobros. Verás aquí los comprobantes tras tu primer pago."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
