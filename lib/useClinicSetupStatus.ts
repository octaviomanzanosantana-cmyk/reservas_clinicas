"use client";

import { useEffect, useState } from "react";

export type ClinicSetupStatus = {
  loading: boolean;
  ready: boolean;
  hasServices: boolean;
  hasHours: boolean;
};

const INITIAL: ClinicSetupStatus = {
  loading: true,
  ready: false,
  hasServices: false,
  hasHours: false,
};

export function useClinicSetupStatus(clinicSlug: string): ClinicSetupStatus {
  const [status, setStatus] = useState<ClinicSetupStatus>(INITIAL);

  useEffect(() => {
    if (!clinicSlug) return;
    let active = true;

    const load = async () => {
      try {
        const [servicesRes, hoursRes] = await Promise.all([
          fetch(`/api/services?clinicSlug=${encodeURIComponent(clinicSlug)}`),
          fetch(`/api/clinic-hours?clinicSlug=${encodeURIComponent(clinicSlug)}`),
        ]);
        const [servicesData, hoursData] = await Promise.all([
          servicesRes.json(),
          hoursRes.json(),
        ]);
        if (!active) return;

        const hasServices =
          Array.isArray(servicesData?.services) && servicesData.services.length > 0;
        const hasHours =
          Array.isArray(hoursData?.clinicHours) && hoursData.clinicHours.length > 0;

        setStatus({
          loading: false,
          hasServices,
          hasHours,
          ready: hasServices && hasHours,
        });
      } catch {
        if (!active) return;
        // En error transitorio no nag al usuario: tratamos como "ready".
        setStatus({ loading: false, ready: true, hasServices: true, hasHours: true });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [clinicSlug]);

  return status;
}
