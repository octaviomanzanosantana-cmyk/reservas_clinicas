import { ClinicPatientsPage } from "@/components/clinic/ClinicPatientsPage";

export default async function DynamicClinicPatientsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicPatientsPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
