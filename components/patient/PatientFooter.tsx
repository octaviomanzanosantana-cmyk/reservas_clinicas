import AppoclickLogo from "@/components/ui/AppoclickLogo";
import { Phone } from "lucide-react";

type PatientFooterProps = {
  supportPhone?: string | null;
};

export default function PatientFooter({ supportPhone }: PatientFooterProps) {
  return (
    <footer className="border-t border-border pt-5 text-center">
      {supportPhone ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted">¿Necesitas ayuda con tu cita?</p>
          <a
            href={`tel:${supportPhone}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            <Phone size={12} className="shrink-0" />
            <span>{supportPhone}</span>
          </a>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-muted">No compartas este enlace</p>

      <a
        href="https://appoclick.com"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex flex-col items-center gap-1 opacity-40 transition-opacity hover:opacity-70"
      >
        <AppoclickLogo variant="color" width={80} />
        <span className="text-[10px] text-muted">Powered by Appoclick</span>
      </a>
    </footer>
  );
}
