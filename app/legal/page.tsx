import Link from "next/link";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 md:py-16">
      <div className="mx-auto max-w-[760px]">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Volver
        </Link>

        <article className="rounded-[14px] border-[0.5px] border-border bg-card px-8 py-10 md:px-12 md:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Documento legal</p>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground">
            Aviso Legal
          </h1>
          <p className="mt-2 text-sm text-muted">Versión 1.0 · Abril 2026</p>

          <div className="mt-6 rounded-[10px] border border-border bg-background p-4 text-sm text-muted leading-6">
            <p><strong className="text-foreground">Titular:</strong> ANALÓGICAMENTE DIGITALES, SOCIEDAD LIMITADA</p>
            <p>NIF: B76357201 · Calle Fresno 32, 35212 Telde, Las Palmas, España</p>
            <p>Registro Mercantil: Las Palmas de Gran Canaria. Tomo 2227; Folio 182; Hoja GC-56181</p>
            <p>Email: hola@appoclick.com · Web: app.appoclick.com</p>
          </div>

          <div className="mt-10 space-y-8 text-[15px] leading-7 text-foreground">

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">1. Objeto</h2>
              <p className="mt-3 text-muted">
                AppoClick es una plataforma SaaS de gestión de citas médicas. El acceso y uso de la plataforma
                implica la aceptación de estas condiciones.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">2. Responsabilidad</h2>
              <p className="mt-3 text-muted">
                AppoClick no asume responsabilidad por datos incorrectos introducidos por usuarios, ni por
                la calidad del servicio sanitario prestado por los profesionales — dicha responsabilidad
                recae íntegramente en la clínica o profesional correspondiente.
              </p>
              <p className="mt-2 text-muted">
                Los contenidos de la plataforma no constituyen consejo médico ni diagnóstico.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">3. Propiedad intelectual</h2>
              <p className="mt-3 text-muted">
                Todos los contenidos de la plataforma (código, diseño, textos, logotipos, marcas) son
                propiedad de ANALÓGICAMENTE DIGITALES, SOCIEDAD LIMITADA o de sus respectivos titulares.
                Queda prohibida su reproducción, distribución o transformación sin autorización expresa.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">4. Uso adecuado</h2>
              <p className="mt-3 text-muted">
                Queda prohibido el uso de la plataforma para actividades ilícitas, fraudulentas o que
                perjudiquen derechos de terceros. El uso indebido podrá dar lugar a la suspensión
                de la cuenta.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">5. Ley aplicable y jurisdicción</h2>
              <p className="mt-3 text-muted">
                Estas condiciones se rigen por la legislación española. Para cualquier controversia,
                las partes se someten a los Juzgados y Tribunales de Las Palmas de Gran Canaria.
              </p>
            </section>
          </div>

          <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
            AppoClick · ANALÓGICAMENTE DIGITALES, S.L. · B76357201
          </div>
        </article>
      </div>
    </main>
  );
}
