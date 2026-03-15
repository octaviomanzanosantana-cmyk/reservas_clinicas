import { ClinicServicesPage } from "@/app/clinic/(default)/services/page";

export default async function DynamicClinicServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicServicesPage clinicSlug={slug} />;
}
