"use client";

type ActionPanelProps = {
  primaryColor?: string;
  accentColor?: string;
  showConfirm?: boolean;
  onConfirm: () => void;
  onReschedule: () => void;
};

export default function ActionPanel({
  showConfirm = true,
  onConfirm,
  onReschedule,
}: ActionPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3.5">
        {showConfirm ? (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
            >
              Confirmar cita
            </button>
            <p className="text-sm text-muted">
              Confirmacion instantanea. La clinica recibira el aviso automaticamente.
            </p>
          </>
        ) : null}

        <button
          type="button"
          onClick={onReschedule}
          className="w-full rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
        >
          Cambiar cita
        </button>
      </div>

      <div className="rounded-[14px] border-[0.5px] border-border bg-background p-4">
        <p className="text-sm text-muted">
          Evita esperas al telefono: gestiona aqui tu cita en 10 segundos.
        </p>
        <p className="mt-1 text-sm text-muted">
          La clinica recibira el aviso automaticamente.
        </p>
      </div>
    </div>
  );
}
