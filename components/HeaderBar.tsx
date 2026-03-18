import { hexToRgba } from "@/lib/color";

type HeaderBarProps = {
  logoText: string;
  clinicName: string;
  idLabel?: string;
  accentColor?: string;
};

export default function HeaderBar({
  logoText,
  clinicName,
  accentColor = "#0EA5E9",
}: HeaderBarProps) {
  return (
    <header className="mb-3 flex items-center">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold"
          style={{
            borderColor: hexToRgba(accentColor, 0.35),
            backgroundColor: hexToRgba(accentColor, 0.12),
            color: accentColor,
          }}
        >
          {logoText}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{clinicName}</p>
        </div>
      </div>
    </header>
  );
}
