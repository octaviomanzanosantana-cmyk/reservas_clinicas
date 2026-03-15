import { ClinicHoursPage } from "@/app/clinic/(default)/hours/page";

export default async function DynamicClinicHoursPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicHoursPage clinicSlug={slug} />;
}
