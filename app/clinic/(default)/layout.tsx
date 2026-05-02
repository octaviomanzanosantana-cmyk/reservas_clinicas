import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";
import SubscriptionBanner from "@/components/clinic/SubscriptionBanner";
import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const clinicAccess = await requireCurrentClinicForRequest();

  return (
    <ClinicPanelLayout
      clinicSlug={clinicAccess.clinicSlug}
      basePath={`/clinic/${clinicAccess.clinicSlug}`}
      banner={<SubscriptionBanner clinicId={clinicAccess.clinicId} />}
    >
      {children}
    </ClinicPanelLayout>
  );
}
