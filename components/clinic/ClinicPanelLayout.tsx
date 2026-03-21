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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94)_38%,_rgba(226,232,240,0.86)_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <aside className="w-full rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.42)] backdrop-blur lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Panel de clínica
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {clinicSlug}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Agenda, servicios y configuración en una única vista.
            </p>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.82)]"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <Link
              href={`/b/${clinicSlug}`}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-white hover:text-slate-900"
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
