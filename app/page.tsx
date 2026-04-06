import AppoclickLogo from "@/components/ui/AppoclickLogo";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero — fondo teal */}
      <section className="relative bg-[#0E9E82]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-14 text-center md:pb-28 md:pt-20">
          <div className="flex justify-center">
            <AppoclickLogo variant="white" width={200} />
          </div>

          <h1 className="mt-10 font-heading text-4xl font-bold tracking-tight text-white md:text-5xl">
            La plataforma de reservas{" "}
            <br className="hidden md:block" />
            para tu clínica
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/80">
            Gestiona tus citas, reduce ausencias y mejora la experiencia de tus pacientes.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center rounded-[10px] bg-white px-8 py-3.5 font-heading text-sm font-semibold text-[#0E9E82] shadow-lg transition-all duration-150 hover:shadow-xl hover:brightness-95"
            >
              Acceder al panel
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-[10px] border-[1.5px] border-white/60 px-8 py-3.5 font-heading text-sm font-semibold text-white transition-all duration-150 hover:border-white hover:bg-white/10"
            >
              Empieza gratis
            </Link>
          </div>
        </div>
      </section>

      {/* Beneficios — fondo claro */}
      <section className="bg-background px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E6F7F3]">
              <svg className="h-6 w-6 text-[#0E9E82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <path d="M9 16l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">Reserva online 24/7</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tus pacientes reservan cuando quieren, sin llamadas ni esperas.
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E6F7F3]">
              <svg className="h-6 w-6 text-[#0E9E82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">Recordatorios automáticos</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Email de confirmación y recordatorio antes de cada cita. Menos ausencias.
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E6F7F3]">
              <svg className="h-6 w-6 text-[#0E9E82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">Sin complicaciones</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Panel simple para la clínica, experiencia clara para el paciente.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white px-6 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm text-muted">
            ¿Aún no tienes cuenta?{" "}
            <a href="mailto:hola@appoclick.com" className="font-medium text-primary hover:underline">
              Contacta con nosotros
            </a>
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted">
            <Link href="/privacy" className="hover:text-foreground">Privacidad</Link>
            <Link href="/legal" className="hover:text-foreground">Aviso legal</Link>
            <Link href="/admin/clinics" className="hover:text-foreground">Administración</Link>
          </div>

          <p className="mt-4 text-[11px] text-muted/50">
            Appoclick · ANALÓGICAMENTE DIGITALES, S.L.
          </p>
        </div>
      </footer>
    </main>
  );
}
