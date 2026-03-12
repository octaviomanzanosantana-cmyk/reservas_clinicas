"use client";

import { darkenHex } from "@/lib/color";
import type { CSSProperties } from "react";
import { useMemo } from "react";

type ActionPanelProps = {
  primaryColor: string;
  accentColor: string;
  onConfirm: () => void;
  onReschedule: () => void;
};

export default function ActionPanel({
  primaryColor,
  accentColor,
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
    <div className="space-y-6" style={themeVars}>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-xl bg-[var(--theme-color)] px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[var(--theme-color-dark)] active:translate-y-[1px]"
        >
          Confirmar cita
        </button>
        <p className="text-sm text-gray-500">
          Confirmación instantánea. La clínica recibirá el aviso automáticamente.
        </p>

        <button
          type="button"
          onClick={onReschedule}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
        >
          Cambiar cita
        </button>
      </div>

      <div
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        style={{ borderColor: accentColor }}
      >
        <p className="text-sm text-gray-600">
          Evita esperas al teléfono: gestiona aquí tu cita en 10 segundos.
        </p>
        <p className="mt-1 text-sm text-gray-600">
          La clínica recibirá el aviso automáticamente.
        </p>
      </div>
    </div>
  );
}
