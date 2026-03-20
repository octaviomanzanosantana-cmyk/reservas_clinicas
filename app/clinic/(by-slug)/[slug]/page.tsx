import { ClinicDashboardPage } from "@/components/clinic/ClinicDashboardPage";

export default async function DynamicClinicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicDashboardPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
