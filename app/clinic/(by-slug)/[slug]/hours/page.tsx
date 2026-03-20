import { ClinicHoursPage } from "@/components/clinic/ClinicHoursPage";

export default async function DynamicClinicHoursPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicHoursPage clinicSlug={slug} />;
}
