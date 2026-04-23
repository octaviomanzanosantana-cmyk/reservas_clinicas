import { requireCurrentClinicForRequest } from "@/lib/clinicAuth";

export default async function MiPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: si no hay sesión o no tiene clínica, redirige a /login.
  await requireCurrentClinicForRequest();

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}
