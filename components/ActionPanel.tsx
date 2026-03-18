"use client";

import { darkenHex } from "@/lib/color";
import type { CSSProperties } from "react";
import { useMemo } from "react";

type ActionPanelProps = {
  primaryColor: string;
  accentColor: string;
  showConfirm?: boolean;
  onConfirm: () => void;
  onReschedule: () => void;
};

export default function ActionPanel({
  primaryColor,
  accentColor,
  showConfirm = true,
  onConfirm,
  onReschedule,
}: ActionPanelProps) {
  const themeVars = useMemo(
    () =>
      ({
        "--theme-color": primaryColor,
        "--theme-color-dark": darkenHex(primaryColor),
        "--accent-color": accentColor,
      }) as CSSProperties,
    [primaryColor, accentColor],
  );

  return (
    <div className="space-y-4" style={themeVars}>
      <div className="space-y-3.5">
        {showConfirm ? (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-2xl bg-[var(--theme-color)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.35)] transition-all duration-150 hover:bg-[var(--theme-color-dark)] active:translate-y-[1px]"
            >
              Confirmar cita
            </button>
            <p className="text-sm text-gray-500">
              Confirmación instantánea. La clínica recibirá el aviso automáticamente.
            </p>
          </>
        ) : null}

        <button
          type="button"
          onClick={onReschedule}
          className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
        >
          Cambiar cita
        </button>
      </div>

      <div
        className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
        style={{ borderColor: `${accentColor}33` }}
      >
        <p className="text-sm text-slate-600">
          Evita esperas al teléfono: gestiona aquí tu cita en 10 segundos.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          La clínica recibirá el aviso automáticamente.
        </p>
      </div>
    </div>
  );
}
