"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ClinicPanelLayoutProps = {
  children: React.ReactNode;
  clinicSlug: string;
  basePath: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
};

const svgBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GridIcon = () => (
  <svg {...svgBase}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...svgBase}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </svg>
);
const ClockIcon = () => (
  <svg {...svgBase}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const UsersIcon = () => (
  <svg {...svgBase}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const GearIcon = () => (
  <svg {...svgBase}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const UserIcon = () => (
  <svg {...svgBase}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);
const SunIcon = () => (
  <svg {...svgBase}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M4.93 4.93l1.41 1.41" />
    <path d="M17.66 17.66l1.41 1.41" />
    <path d="M4.93 19.07l1.41-1.41" />
    <path d="M17.66 6.34l1.41-1.41" />
  </svg>
);
const CardIcon = () => (
  <svg {...svgBase}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg {...svgBase}>
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);
const LogoutIcon = () => (
  <svg {...svgBase}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export function ClinicPanelLayout({ children, clinicSlug, basePath }: ClinicPanelLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((data: { clinic?: { name?: string } }) => {
        if (active && data.clinic?.name) setClinicName(data.clinic.name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [clinicSlug]);

  const managementItems: NavItem[] = [
    { href: basePath, label: "Inicio", icon: <GridIcon /> },
    { href: `${basePath}/calendar`, label: "Calendario", icon: <CalendarIcon /> },
    { href: `${basePath}/appointments/new`, label: "Citas", icon: <ClockIcon /> },
    { href: `${basePath}/patients`, label: "Pacientes", icon: <UsersIcon /> },
    {
      href: `/b/${clinicSlug}`,
      label: "Ver página pública",
      icon: <ExternalLinkIcon />,
      external: true,
    },
  ];
  const configItems: NavItem[] = [
    { href: `${basePath}/services`, label: "Servicios", icon: <GearIcon /> },
    { href: `${basePath}/settings`, label: "Perfil de clínica", icon: <UserIcon /> },
    { href: `${basePath}/hours`, label: "Horarios", icon: <SunIcon /> },
  ];
  const accountItems: NavItem[] = [
    { href: `${basePath}/plan`, label: "Mi plan", icon: <CardIcon /> },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const renderItem = (item: NavItem, variant: "default" | "config") => {
    const isActive = pathname === item.href;
    const base =
      "flex items-center gap-2.5 rounded-lg px-3 py-2 font-heading text-[13px] font-medium transition-colors";
    const cls =
      variant === "config"
        ? isActive
          ? "bg-[rgba(14,158,130,0.15)] text-[#0E9E82]"
          : "text-[rgba(14,158,130,0.7)] hover:bg-[rgba(14,158,130,0.1)] hover:text-[#0E9E82]"
        : isActive
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white";

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} ${cls}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={`${base} ${cls}`}>
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <aside className="flex w-full flex-col rounded-[14px] bg-[#1A1A1A] p-4 text-white lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72 lg:self-start">
          <div className="rounded-[10px] bg-white/3 px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
              Panel de clínica
            </p>
            <p className="mt-1.5 font-heading text-base font-semibold tracking-tight text-white">
              {clinicName ?? clinicSlug}
            </p>
          </div>

          <nav className="mt-5 flex flex-1 flex-col">
            <div>
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Gestión
              </p>
              <div className="space-y-0.5">
                {managementItems.map((i) => renderItem(i, "default"))}
              </div>
            </div>

            <hr className="my-4 border-0 border-t-[0.5px] border-white/8" />

            <div>
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#0E9E82]">
                Configuración
              </p>
              <div className="space-y-0.5">
                {configItems.map((i) => renderItem(i, "config"))}
              </div>
            </div>

            <div className="mt-auto border-t-[0.5px] border-white/8 pt-4">
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Cuenta
              </p>
              <div className="space-y-0.5">
                {accountItems.map((i) => renderItem(i, "default"))}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-heading text-[13px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogoutIcon />
                  <span>{loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
                </button>
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-6">{children}</main>
      </div>
    </div>
  );
}
