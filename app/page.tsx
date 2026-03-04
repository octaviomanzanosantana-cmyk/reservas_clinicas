import { getClinicTheme } from "@/lib/clinicTheme";
import Link from "next/link";

export default function HomePage() {
  const theme = getClinicTheme("demo123");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4">
      <div className="mx-auto max-w-xl py-24 text-center">
        <div className="flex min-h-[70vh] flex-col items-center justify-center">
          <div
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shadow-sm"
            style={{ backgroundColor: `${theme.accent}1f`, color: theme.accent }}
          >
            {theme.logoText}
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">Reservas Clínicas</h1>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Sistema de autoservicio para confirmar, cambiar o cancelar citas sin llamar a recepción.
          </p>

          <div className="mt-8 grid w-full max-w-sm gap-3">
            <Link
              href="/a/demo123"
              className="rounded-xl px-5 py-3 text-base font-medium text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
              style={{ backgroundColor: theme.primary }}
            >
              Ver demo paciente
            </Link>
            <Link
              href="/demo/dashboard"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-medium text-gray-900 transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
            >
              Ver demo clínica
            </Link>
          </div>

          <p className="mt-5 text-sm text-gray-500">Demo interactiva del MVP para clínicas privadas.</p>

          <section className="mx-auto mt-8 w-full max-w-md space-y-2 text-left text-sm text-gray-600">
            <h2 className="text-center font-medium text-gray-900">Cómo funciona</h2>
            <p>1. La clínica envía un enlace único al paciente</p>
            <p>2. El paciente confirma, cambia o cancela en segundos</p>
            <p>3. La clínica recibe la actualización automáticamente</p>
          </section>
        </div>
      </div>
    </main>
  );
}
