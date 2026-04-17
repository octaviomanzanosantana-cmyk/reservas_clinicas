"use client";

import { useClinicSetupStatus } from "@/lib/useClinicSetupStatus";
import Link from "next/link";

type ClinicSetupBannerProps = {
  clinicSlug: string;
  basePath: string;
};

export function ClinicSetupBanner({ clinicSlug, basePath }: ClinicSetupBannerProps) {
  const { loading, ready } = useClinicSetupStatus(clinicSlug);
  if (loading || ready) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border-[0.5px] px-4 py-3 text-sm"
      style={{ backgroundColor: "#E6F7F3", color: "#0B7D68", borderColor: "#0E9E82" }}
    >
      <span>Configura tus servicios y horarios para empezar a recibir citas.</span>
      <span className="ml-auto flex gap-4 font-medium">
        <Link
          href={`${basePath}/services`}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Servicios
        </Link>
        <Link
          href={`${basePath}/hours`}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Horarios
        </Link>
      </span>
    </div>
  );
}
