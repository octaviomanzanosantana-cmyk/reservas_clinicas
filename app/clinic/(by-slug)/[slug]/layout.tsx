import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";
import { requireClinicAccessForSlug } from "@/lib/clinicAuth";

export default async function DynamicClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireClinicAccessForSlug(slug);

  return (
    <ClinicPanelLayout clinicSlug={slug} basePath={`/clinic/${slug}`}>
      {children}
    </ClinicPanelLayout>
  );
}
