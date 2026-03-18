import { Phone } from "lucide-react";

type PatientFooterProps = {
  supportPhone?: string | null;
};

export default function PatientFooter({ supportPhone }: PatientFooterProps) {
  return (
    <footer className="border-t border-slate-200 pt-5 text-center">
      {supportPhone ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-400">¿Necesitas ayuda con tu cita?</p>
          <a
            href={`tel:${supportPhone}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <Phone size={12} className="shrink-0" />
            <span>{supportPhone}</span>
          </a>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-slate-400">No compartas este enlace</p>
    </footer>
  );
}
