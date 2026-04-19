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

type ClinicSummary = {
  name: string | null;
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
const MessageCircleIcon = () => (
  <svg {...svgBase}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
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

const CLINIC_NAME_PREFIXES = new Set([
  "dr",
  "dra",
  "doctor",
  "doctora",
  "clinica",
  "centro",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "");
}

function deriveInitial(name: string | null, fallback: string): string {
  const source = (name ?? fallback).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  for (const part of parts) {
    if (!CLINIC_NAME_PREFIXES.has(normalize(part))) {
      return (part[0] ?? "").toUpperCase();
    }
  }
  return (source[0] ?? "?").toUpperCase();
}

export function ClinicPanelLayout({ children, clinicSlug, basePath }: ClinicPanelLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [clinic, setClinic] = useState<ClinicSummary>({ name: null });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((data: { clinic?: { name?: string | null } }) => {
        if (!active || !data.clinic) return;
        setClinic({ name: data.clinic.name ?? null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [clinicSlug]);

  const managementItems: NavItem[] = [
    { href: basePath, label: "Inicio", icon: <GridIcon /> },
    { href: `${basePath}/calendar`, label: "Calendario", icon: <CalendarIcon /> },
    { href: `${basePath}/appointments/new`, label: "Nueva cita", icon: <ClockIcon /> },
    { href: `${basePath}/reminders`, label: "Recordatorios", icon: <MessageCircleIcon /> },
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

  const itemBase =
    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 font-heading text-[13px] transition-[background-color,color] duration-150";
  const inactiveCls =
    "text-[var(--sidebar-text-inactive)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white/90 font-medium";
  const activeCls =
    "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)] font-semibold before:content-[''] before:absolute before:left-[-10px] before:top-[6px] before:bottom-[6px] before:w-[3px] before:bg-[var(--sidebar-active-bar)] before:rounded-[0_3px_3px_0]";

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.href;
    const cls = `${itemBase} ${isActive ? activeCls : inactiveCls}`;

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={cls}>
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  const groupLabelCls =
    "px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text-label)]";
  const dividerCls =
    "h-px border-0 bg-[var(--sidebar-divider)] mt-[10px] mx-[4px] mb-[2px]";

  const displayName = clinic.name ?? clinicSlug;
  const initial = deriveInitial(clinic.name, clinicSlug);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <aside className="flex w-full flex-col rounded-[14px] bg-[var(--sidebar-bg)] p-4 text-white lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72 lg:self-start">
          <div
            className="flex items-center gap-3 border-b"
            style={{
              padding: "10px 10px 14px",
              borderBottomColor: "var(--sidebar-divider)",
              borderBottomWidth: "1px",
            }}
          >
            <div
              aria-hidden="true"
              className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[#0E9E82] font-heading text-sm font-bold text-white"
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--sidebar-text-label)]">
                Panel de clínica
              </p>
              <p
                className="mt-0.5 truncate font-heading text-[13px] font-bold tracking-tight text-white"
                title={displayName}
              >
                {displayName}
              </p>
            </div>
          </div>

          <nav className="mt-4 flex flex-1 flex-col">
            <div>
              <p className={groupLabelCls}>Gestión</p>
              <div className="space-y-0.5">{managementItems.map(renderItem)}</div>
            </div>

            <hr className={dividerCls} />

            <div>
              <p className={groupLabelCls}>Configuración</p>
              <div className="space-y-0.5">{configItems.map(renderItem)}</div>
            </div>

            <div className="mt-auto">
              <hr className={dividerCls} />
              <p className={groupLabelCls}>Cuenta</p>
              <div className="space-y-0.5">
                {accountItems.map(renderItem)}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className={`${itemBase} ${inactiveCls} w-full disabled:cursor-not-allowed disabled:opacity-60`}
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
