import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentClinicForRequest } from "@/lib/clinicAuth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const clinicAccess = await getCurrentClinicForRequest();

  if (clinicAccess) {
    redirect(`/clinic/${clinicAccess.clinicSlug}`);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
          <div className="px-6 py-8 md:px-8 md:py-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Nueva cuenta
            </p>
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
              Crea tu panel
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Regístrate con tu email para empezar a gestionar tu clínica.
            </p>

            <div className="mt-8">
              <RegisterForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
