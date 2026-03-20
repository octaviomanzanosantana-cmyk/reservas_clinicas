import { getCurrentClinicForRequest } from "@/lib/clinicAuth";
import { redirect } from "next/navigation";

export default async function ClinicDefaultNewAppointmentRedirectPage() {
  const clinicAccess = await getCurrentClinicForRequest();

  if (!clinicAccess) {
    redirect("/login");
  }

  redirect(`/clinic/${clinicAccess.clinicSlug}/appointments/new`);
}
