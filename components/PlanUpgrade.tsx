"use client";

import { useState } from "react";
import type { Plan } from "@/lib/plan";

type PlanUpgradeProps = {
  currentPlan: Plan;
  clinicSlug: string;
};

const FEATURES_STARTER = [
  "Recordatorios automáticos",
  "WhatsApp",
  "Google Calendar",
  "Enlace de videollamada",
  "Citas ilimitadas",
];

const FEATURES_PRO = [
  "Todo de Starter",
  "Marca blanca",
  "Dominio personalizado",
  "Sala de vídeo privada",
];

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const PRICES = {
  starter: { monthly: 19, yearly: 190 },
  pro: { monthly: 39, yearly: 390 },
};

export function PlanUpgrade({ currentPlan, clinicSlug }: PlanUpgradeProps) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: "starter" | "pro") => {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Error al iniciar el pago");
        setLoading(null);
      }
    } catch {
      alert("Error de conexión");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Current plan badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Plan actual:</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {PLAN_LABELS[currentPlan]}
        </span>
      </div>

      {/* Interval toggle */}
      <div className="flex items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-border bg-background p-2">
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors ${
            interval === "monthly"
              ? "bg-primary text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setInterval("yearly")}
          className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors ${
            interval === "yearly"
              ? "bg-primary text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          Anual
          <span className="ml-1.5 text-xs font-normal opacity-80">
            Ahorra 2 meses
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Starter */}
        <div className="flex flex-col rounded-[14px] border-[0.5px] border-border bg-white p-6">
          <h3 className="font-heading text-lg font-bold text-foreground">
            Starter
          </h3>
          <p className="mt-1 text-sm text-muted">
            Para clínicas que quieren automatizar
          </p>
          <p className="mt-4 font-heading text-3xl font-bold text-foreground">
            {interval === "monthly"
              ? `${PRICES.starter.monthly}\u00A0\u20AC`
              : `${PRICES.starter.yearly}\u00A0\u20AC`}
            <span className="text-sm font-normal text-muted">
              /{interval === "monthly" ? "mes" : "año"}
            </span>
          </p>

          <ul className="mt-5 flex-1 space-y-2">
            {FEATURES_STARTER.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-primary">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={currentPlan === "starter" || currentPlan === "pro" || loading !== null}
            onClick={() => void handleUpgrade("starter")}
            className="mt-6 w-full rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === "starter"
              ? "Redirigiendo..."
              : currentPlan === "starter" || currentPlan === "pro"
                ? "Plan actual"
                : "Activar Starter"}
          </button>
        </div>

        {/* Pro */}
        <div className="flex flex-col rounded-[14px] border-[0.5px] border-border bg-white p-6 ring-2 ring-primary/20">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Pro
            </h3>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
              Popular
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Control total sobre tu marca
          </p>
          <p className="mt-4 font-heading text-3xl font-bold text-foreground">
            {interval === "monthly"
              ? `${PRICES.pro.monthly}\u00A0\u20AC`
              : `${PRICES.pro.yearly}\u00A0\u20AC`}
            <span className="text-sm font-normal text-muted">
              /{interval === "monthly" ? "mes" : "año"}
            </span>
          </p>

          <ul className="mt-5 flex-1 space-y-2">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-primary">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={currentPlan === "pro" || loading !== null}
            onClick={() => void handleUpgrade("pro")}
            className="mt-6 w-full rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === "pro"
              ? "Redirigiendo..."
              : currentPlan === "pro"
                ? "Plan actual"
                : "Activar Pro"}
          </button>
        </div>
      </div>
    </div>
  );
}
