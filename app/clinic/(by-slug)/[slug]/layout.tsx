import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";
import SubscriptionBanner from "@/components/clinic/SubscriptionBanner";
import { requireClinicAccessForSlug } from "@/lib/clinicAuth";
import { cookies } from "next/headers";

export default async function DynamicClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_token")?.value ?? null;

  const clinicAccess = await requireClinicAccessForSlug(slug, adminToken);

  return (
    <>
      <ImpersonationBanner />
      <ClinicPanelLayout
        clinicSlug={slug}
        basePath={`/clinic/${slug}`}
        banner={<SubscriptionBanner clinicId={clinicAccess.clinicId} />}
      >
        {children}
      </ClinicPanelLayout>
    </>
  );
}
