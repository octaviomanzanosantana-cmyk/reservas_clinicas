import { ClinicSettingsPage } from "@/components/clinic/ClinicSettingsPage";

export default async function DynamicClinicSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicSettingsPage clinicSlug={slug} />;
}
