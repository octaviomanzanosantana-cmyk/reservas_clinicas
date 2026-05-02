import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";
import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const clinicAccess = await requireCurrentClinicForRequest();

  return (
    <ClinicPanelLayout
      clinicSlug={clinicAccess.clinicSlug}
      basePath={`/clinic/${clinicAccess.clinicSlug}`}
    >
      {children}
    </ClinicPanelLayout>
  );
}
