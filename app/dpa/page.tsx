import { AcceptDpaButton } from "@/components/auth/AcceptDpaButton";
import Link from "next/link";

export default function DpaPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 md:py-16">
      <div className="mx-auto max-w-[760px]">
        <Link href="/register" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Volver al registro
        </Link>

        <article className="rounded-[14px] border-[0.5px] border-border bg-card px-8 py-10 md:px-12 md:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Documento legal</p>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground">
            Contrato de Encargo de Tratamiento (DPA)
          </h1>
          <p className="mt-2 text-sm text-muted">Versión 1.4 · Abril 2026</p>

          <div className="mt-6 rounded-[10px] border border-border bg-background p-4 text-sm text-muted leading-6">
            <p><strong className="text-foreground">Encargado:</strong> ANALÓGICAMENTE DIGITALES, SOCIEDAD LIMITADA (AppoClick)</p>
            <p>NIF: B76357201 · Calle Fresno, 2 · 35200 Telde · Las Palmas</p>
            <p>Email: hola@appoclick.com</p>
          </div>

          <div className="mt-10 space-y-8 text-[15px] leading-7 text-foreground">

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">1. Objeto</h2>
              <p className="mt-3 text-muted">
                El presente contrato regula las condiciones en las que AppoClick, como <strong className="text-foreground">Encargado del Tratamiento</strong>, trata datos personales de los pacientes en nombre de la clínica (<strong className="text-foreground">Responsable del Tratamiento</strong>), conforme al artículo 28 del RGPD y la LOPDGDD.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">2. Datos tratados</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li><strong className="text-foreground">Categorías de interesados:</strong> pacientes de la clínica</li>
                <li><strong className="text-foreground">Tipos de datos:</strong> nombre, email, teléfono, fecha/hora de cita, tipo de consulta, modalidad (presencial/online)</li>
                <li><strong className="text-foreground">No se tratan:</strong> historiales médicos, diagnósticos, datos clínicos ni contenido sanitario</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">3. Obligaciones de AppoClick</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li>Tratar los datos únicamente según las instrucciones documentadas del Responsable</li>
                <li>No utilizar los datos para fines propios ni cederlos a terceros</li>
                <li>Garantizar que las personas autorizadas para tratar datos se han comprometido a respetar la confidencialidad</li>
                <li>Implementar medidas técnicas y organizativas adecuadas (Art. 32 RGPD)</li>
                <li>Asistir al Responsable en el cumplimiento de sus obligaciones RGPD (derechos de los interesados, notificación de brechas, evaluaciones de impacto)</li>
                <li>Suprimir o devolver los datos al término del contrato, salvo obligación legal de conservación</li>
                <li>Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">4. Subencargados</h2>
              <p className="mt-3 text-muted">
                AppoClick utiliza los siguientes subencargados del tratamiento, con los que mantiene contratos equivalentes al presente DPA:
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Función</th>
                      <th className="py-2 font-medium">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted">
                    <tr className="border-b border-border/50"><td className="py-2.5 pr-4">Supabase Inc.</td><td className="py-2.5 pr-4">Base de datos y autenticación</td><td className="py-2.5">UE (Frankfurt)</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2.5 pr-4">Vercel Inc.</td><td className="py-2.5 pr-4">Infraestructura y hosting</td><td className="py-2.5">UE / EE.UU. (DPF)</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2.5 pr-4">Resend Inc.</td><td className="py-2.5 pr-4">Envío de emails transaccionales</td><td className="py-2.5">EE.UU. (DPF)</td></tr>
                    <tr><td className="py-2.5 pr-4">Stripe Inc.</td><td className="py-2.5 pr-4">Procesamiento de pagos (solo datos de clínicas)</td><td className="py-2.5">UE / EE.UU. (DPF)</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-muted">
                El Responsable autoriza al Encargado a contratar nuevos subencargados, previa notificación. El Responsable puede oponerse en un plazo de 15 días.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">5. Transferencias internacionales</h2>
              <p className="mt-3 text-muted">
                Las transferencias a países fuera del EEE se realizan exclusivamente con garantías adecuadas: Cláusulas Contractuales Tipo de la Comisión Europea o Data Privacy Framework UE-EE.UU.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">6. Medidas de seguridad</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li>Cifrado HTTPS/TLS en todas las comunicaciones</li>
                <li>Separación de datos por clínica (Row-Level Security)</li>
                <li>Autenticación segura con 2FA obligatorio</li>
                <li>Tokens únicos con caducidad por cita</li>
                <li>Rate limiting en login (protección fuerza bruta)</li>
                <li>Backups automáticos cifrados</li>
                <li>Notificación de brechas a la AEPD en menos de 72 horas</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">7. Obligaciones de la clínica</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted">
                <li>Garantizar la base legal para el tratamiento de datos de pacientes</li>
                <li>Informar a los pacientes sobre el tratamiento de sus datos</li>
                <li>Atender los derechos ARCO de los pacientes (acceso, rectificación, supresión, portabilidad)</li>
                <li>No introducir datos especialmente protegidos (origen étnico, salud detallada, orientación sexual) en los campos de texto libre de AppoClick</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">8. Duración y resolución</h2>
              <p className="mt-3 text-muted">
                Este contrato tiene la misma duración que la relación de servicio entre AppoClick y la clínica. Al finalizar, AppoClick suprimirá los datos en un plazo máximo de 30 días, salvo obligación legal de conservación. La clínica puede solicitar una copia de los datos antes de la supresión.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">9. Responsabilidad</h2>
              <p className="mt-3 text-muted">
                Cada parte responderá de los daños causados por el incumplimiento de sus obligaciones conforme al RGPD. AppoClick responde por los daños derivados del tratamiento si ha actuado al margen de las instrucciones del Responsable o incumpliendo sus obligaciones como Encargado.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground">10. Legislación aplicable</h2>
              <p className="mt-3 text-muted">
                Este contrato se rige por el Reglamento General de Protección de Datos (RGPD), la Ley Orgánica 3/2018 de Protección de Datos (LOPDGDD) y la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de Las Palmas de Gran Canaria.
              </p>
              <p className="mt-2 text-muted">
                Autoridad de control competente: Agencia Española de Protección de Datos (AEPD) — <a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-primary hover:underline">www.aepd.es</a>
              </p>
            </section>
          </div>

          <AcceptDpaButton />

          <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
            AppoClick · ANALÓGICAMENTE DIGITALES, S.L. · B76357201 · hola@appoclick.com
          </div>
        </article>
      </div>
    </main>
  );
}
