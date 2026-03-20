"use client";

import { ClinicPanelLayout } from "@/components/clinic/ClinicPanelLayout";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicPanelLayout
      clinicSlug={PANEL_CLINIC_SLUG}
      basePath={`/clinic/${PANEL_CLINIC_SLUG}`}
    >
      {children}
    </ClinicPanelLayout>
  );
}
