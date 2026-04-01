"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ClinicPanelLayoutProps = {
  children: React.ReactNode;
  clinicSlug: string;
  basePath: string;
};

export function ClinicPanelLayout({ children, clinicSlug, basePath }: ClinicPanelLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { href: basePath, label: "Dashboard" },
    { href: `${basePath}/calendar`, label: "Calendario" },
    { href: `${basePath}/appointments/new`, label: "Nueva cita" },
    { href: `${basePath}/services`, label: "Servicios" },
    { href: `${basePath}/hours`, label: "Horarios" },
    { href: `${basePath}/settings`, label: "Configuración" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <aside className="w-full rounded-[14px] border-[0.5px] border-border bg-card p-5 lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="rounded-[14px] border-[0.5px] border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Panel de clínica
            </p>
            <p className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground">
              {clinicSlug}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Agenda, servicios y configuración.
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
        </aside>

        <main className="min-w-0 flex-1 pb-6">{children}</main>
      </div>
    </div>
  );
}
