import { ClinicRemindersPage } from "@/components/clinic/ClinicRemindersPage";

export default async function DynamicClinicRemindersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClinicRemindersPage clinicSlug={slug} />;
}
