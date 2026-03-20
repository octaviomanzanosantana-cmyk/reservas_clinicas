import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { redirect } from "next/navigation";

export default function ClinicDefaultRedirectPage() {
  redirect(`/clinic/${PANEL_CLINIC_SLUG}`);
}
