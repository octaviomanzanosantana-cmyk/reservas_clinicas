"use client";

export type PlanInterval = "monthly" | "yearly";

export type PlanIntervalSelectorProps = {
  value: PlanInterval;
  onChange: (interval: PlanInterval) => void;
  disabled?: boolean;
};

/**
 * Pricing canónico del plan Starter (hardcoded).
 * Sincronizar con STRIPE_PRICE_STARTER_MONTHLY_TEST y
 * STRIPE_PRICE_STARTER_YEARLY_TEST en .env.local si cambian en
 * Stripe Dashboard.
 *
 * Ahorro anual: 228 - 190 = 38 € ≈ 17%.
 */
const PRICING = {
  monthly: {
    label: "Mensual",
    price: "19 €",
    period: "al mes",
    equivalentPerMonth: null,
    savingsLabel: null,
  },
  yearly: {
    label: "Anual",
    price: "190 €",
    period: "al año",
    equivalentPerMonth: "15,83 € / mes equivalente",
    savingsLabel: "Ahorra 17%",
  },
} as const;

export function PlanIntervalSelector({
  value,
  onChange,
  disabled = false,
}: PlanIntervalSelectorProps) {
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    interval: PlanInterval,
  ) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChange(interval);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange("yearly");
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange("monthly");
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Periodicidad del plan"
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      {(Object.keys(PRICING) as PlanInterval[]).map((interval) => {
        const isSelected = value === interval;
        const info = PRICING[interval];

        return (
          <div
            key={interval}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onChange(interval)}
            onKeyDown={(e) => handleKeyDown(e, interval)}
            className={[
              "relative cursor-pointer rounded-[14px] border-[1.5px] p-5 transition-all",
              "focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-white hover:border-primary/40",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            {/* Círculo de selección arriba derecha */}
            <div
              className={[
                "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-[1.5px]",
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white",
              ].join(" ")}
              aria-hidden="true"
            >
              {isSelected ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 7L6 10L11 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </div>

            {/* Label del intervalo */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {info.label}
            </p>

            {/* Precio grande */}
            <p className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground">
              {info.price}
            </p>
            <p className="mt-1 text-sm text-muted">{info.period}</p>

            {/* Extras para anual */}
            {info.savingsLabel ? (
              <div className="mt-3 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {info.savingsLabel}
              </div>
            ) : null}
            {info.equivalentPerMonth ? (
              <p className="mt-2 text-xs text-muted">
                {info.equivalentPerMonth}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
