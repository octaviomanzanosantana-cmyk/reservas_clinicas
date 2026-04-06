import { ClinicPlanPage } from "@/components/clinic/ClinicPlanPage";

export default async function DynamicClinicPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicPlanPage clinicSlug={slug} />;
}
