import { ClinicNewAppointmentPage } from "@/app/clinic/(default)/appointments/new/page";

export default async function DynamicClinicNewAppointmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicNewAppointmentPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
