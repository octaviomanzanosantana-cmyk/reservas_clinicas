import { hexToRgba } from "@/lib/color";

type HeaderBarProps = {
  logoText: string;
  clinicName: string;
  idLabel: string;
  accentColor?: string;
};

export default function HeaderBar({ logoText, clinicName, idLabel, accentColor = "#0EA5E9" }: HeaderBarProps) {
  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-sm"
          style={{
            borderColor: hexToRgba(accentColor, 0.35),
            backgroundColor: hexToRgba(accentColor, 0.12),
            color: accentColor,
          }}
        >
          {logoText}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reservas Clínicas</p>
          <p className="text-sm font-semibold text-gray-900">{clinicName}</p>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-500">{idLabel}</p>
    </header>
  );
}
