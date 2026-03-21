import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
          <div className="px-6 py-8 md:px-8 md:py-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Nueva password
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Elige una password nueva
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Si el enlace es valido, podras actualizar tu password aqui mismo.
            </p>

            <div className="mt-8">
              <ResetPasswordForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
