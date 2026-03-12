"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/clinic", label: "Dashboard" },
  { href: "/clinic/services", label: "Servicios" },
  { href: "/clinic/hours", label: "Horarios" },
  { href: "/clinic/settings", label: "Configuración" },
];

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="mb-4">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-gray-500">
              Panel de clínica
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">pilarcastillo</p>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <Link
              href="/b/pilarcastillo"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Ver página pública
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
