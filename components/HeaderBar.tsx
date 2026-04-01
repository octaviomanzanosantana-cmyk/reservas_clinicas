type HeaderBarProps = {
  logoText: string;
  clinicName: string;
  idLabel?: string;
  accentColor?: string;
};

export default function HeaderBar({
  logoText,
  clinicName,
}: HeaderBarProps) {
  return (
    <header className="mb-3 flex items-center">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary-soft font-heading text-sm font-semibold text-primary">
          {logoText}
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold text-foreground">{clinicName}</p>
        </div>
      </div>
    </header>
  );
}
