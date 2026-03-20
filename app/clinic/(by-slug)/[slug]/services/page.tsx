import { ClinicServicesPage } from "@/components/clinic/ClinicServicesPage";

export default async function DynamicClinicServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicServicesPage clinicSlug={slug} />;
}
