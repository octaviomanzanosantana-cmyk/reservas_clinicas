import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";

export default async function DynamicClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <ClinicPanelLayout clinicSlug={slug} basePath={`/clinic/${slug}`}>
      {children}
    </ClinicPanelLayout>
  );
}
