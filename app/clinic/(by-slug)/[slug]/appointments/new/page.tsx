import { ClinicNewAppointmentPage } from "@/components/clinic/ClinicNewAppointmentPage";

export default async function DynamicClinicNewAppointmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicNewAppointmentPage clinicSlug={slug} basePath={`/clinic/${slug}`} />;
}
