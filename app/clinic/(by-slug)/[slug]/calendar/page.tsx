import { ClinicCalendarPage } from "@/components/clinic/ClinicCalendarPage";

export default async function DynamicClinicCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicCalendarPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
