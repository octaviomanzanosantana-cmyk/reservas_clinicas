import { ClinicDashboardPage } from "@/app/clinic/(default)/page";

export default async function DynamicClinicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicDashboardPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
