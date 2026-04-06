import Link from "next/link";

export default function PrivacyPage() {
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
            Política de Privacidad
          </h1>
          <p className="mt-2 text-sm text-muted">Versión 1.0 · Abril 2026</p>

          <div className="mt-6 rounded-[10px] border border-border bg-background p-4 text-sm text-muted leading-6">
            <p><strong className="text-foreground">Responsable:</strong> ANALÓGICAMENTE DIGITALES, SOCIEDAD LIMITADA</p>
            <p>NIF: B76357201 · Calle Fresno, 2. 35200 Telde (Las Palmas)</p>
            <p>Email: hola@appoclick.com · Web: app.appoclick.com</p>
          </div>

          <div className="mt-10 space-y-8 text-[15px] leading-7 text-foreground">

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">1. Rol de Appoclick</h2>
              <p className="mt-3 text-muted">
                Appoclick actúa como <strong className="text-foreground">Encargado del Tratamiento</strong> respecto a los datos de pacientes
                (modelo Calendly/Docplanner) y como <strong className="text-foreground">Responsable del Tratamiento</strong> respecto a los datos
                de sus clientes (clínicas).
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">2. Datos que tratamos</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-2 pr-4 font-medium">Categoría</th>
                      <th className="py-2 font-medium">Datos</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted">
                    <tr className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium text-foreground">Clínicas</td>
                      <td className="py-2.5">Nombre, email, teléfono, dirección, facturación, datos de acceso</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-foreground">Pacientes (como Encargado)</td>
                      <td className="py-2.5">Nombre, email, teléfono, fecha/hora de cita, tipo de consulta, modalidad. No tratamos contenido clínico (historiales, diagnósticos)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">3. Finalidad</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li>Gestión de reservas, confirmaciones y recordatorios automáticos</li>
                <li>Gestión comercial con las clínicas</li>
                <li>Seguridad y mantenimiento de la plataforma</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">4. Base legal</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li><strong className="text-foreground">Datos de clínicas:</strong> ejecución de contrato (Art. 6.1.b RGPD)</li>
                <li><strong className="text-foreground">Datos de pacientes:</strong> encargo de tratamiento (Art. 28 RGPD)</li>
                <li><strong className="text-foreground">Recordatorios:</strong> interés legítimo (Art. 6.1.f RGPD)</li>
                <li><strong className="text-foreground">Datos de salud:</strong> prestación de servicios sanitarios (Art. 9.2.h RGPD)</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">5. Subencargados</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 font-medium">Función</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted">
                    <tr className="border-b border-border/50"><td className="py-2.5 pr-4">Supabase</td><td className="py-2.5">Base de datos</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2.5 pr-4">Vercel</td><td className="py-2.5">Hosting</td></tr>
                    <tr><td className="py-2.5 pr-4">Resend</td><td className="py-2.5">Envío de emails</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-muted">Todos con DPA y garantías RGPD. No se venden datos a terceros.</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">6. Transferencias internacionales</h2>
              <p className="mt-3 text-muted">
                Solo con garantías adecuadas: Cláusulas Contractuales Tipo o Data Privacy Framework UE-EE.UU.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">7. Conservación</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li><strong className="text-foreground">Datos de clínicas:</strong> vigencia del contrato + prescripción legal</li>
                <li><strong className="text-foreground">Datos de pacientes:</strong> según instrucciones de la clínica, máximo 5 años</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">8. Derechos</h2>
              <p className="mt-3 text-muted">
                Acceso, rectificación, supresión, oposición, limitación y portabilidad.
                Contacto: <a href="mailto:hola@appoclick.com" className="text-primary hover:underline">hola@appoclick.com</a>
              </p>
              <p className="mt-2 text-muted">
                Reclamaciones ante la AEPD: <a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-primary hover:underline">www.aepd.es</a>
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">9. Seguridad</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li>HTTPS/TLS en todas las comunicaciones</li>
                <li>Separación de datos por clínica (Row-Level Security)</li>
                <li>Autenticación segura y tokens únicos por cita</li>
                <li>Backups automáticos</li>
                <li>Notificación de brechas a AEPD en menos de 72 horas</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
            Appoclick · ANALÓGICAMENTE DIGITALES, S.L. · B76357201
          </div>
        </article>
      </div>
    </main>
  );
}
