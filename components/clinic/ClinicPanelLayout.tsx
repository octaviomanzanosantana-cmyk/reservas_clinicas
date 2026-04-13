"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";
import AppoclickLogo from "@/components/ui/AppoclickLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type ClinicPanelLayoutProps = {
  children: React.ReactNode;
  clinicSlug: string;
  basePath: string;
};

export function ClinicPanelLayout({ children, clinicSlug, basePath }: ClinicPanelLayoutProps) {
  const pathname = usePathname();
  const [clinicName, setClinicName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((data: { clinic?: { name?: string } }) => {
        if (active && data.clinic?.name) setClinicName(data.clinic.name);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [clinicSlug]);

  const navItems = [
    { href: basePath, label: "Dashboard" },
    { href: `${basePath}/calendar`, label: "Calendario" },
    { href: `${basePath}/appointments/new`, label: "Nueva cita" },
    { href: `${basePath}/patients`, label: "Pacientes" },
    { href: `${basePath}/services`, label: "Servicios" },
    { href: `${basePath}/hours`, label: "Horarios" },
    { href: `${basePath}/settings`, label: "Configuración" },
    { href: `${basePath}/plan`, label: "Tu plan" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <aside className="w-full rounded-[14px] border-[0.5px] border-border bg-card p-5 lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="rounded-[14px] border-[0.5px] border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Panel de clínica
            </p>
            <p className="mt-2 font-heading text-lg font-semibold tracking-tight text-foreground">
              {clinicName ?? clinicSlug}
            </p>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-[10px] px-3.5 py-2.5 font-heading text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted hover:bg-primary-soft hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-border pt-5">
            <Link
              href={`/b/${clinicSlug}`}
              className="inline-flex w-full items-center justify-center rounded-[10px] border-[1.5px] border-primary px-4 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
            >
              Abrir página pública
            </Link>
            <div className="mt-3">
              <LogoutButton />
            </div>
          </div>

          <a
            href="https://appoclick.com"
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex flex-col items-center gap-1.5 opacity-40 transition-opacity hover:opacity-70"
          >
            <AppoclickLogo variant="color" width={90} />
            <span className="text-[10px] text-muted">Powered by Appoclick</span>
          </a>
        </aside>

        <main className="min-w-0 flex-1 pb-6">{children}</main>
      </div>
    </div>
  );
}
