import { getCurrentClinicForRequest } from "@/lib/clinicAuth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const access = await getCurrentClinicForRequest();

  if (access?.clinicSlug) {
    redirect(`/clinic/${access.clinicSlug}`);
  }

  redirect("/login");
}
