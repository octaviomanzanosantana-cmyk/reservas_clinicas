import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
          Error 404
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          Página no encontrada
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Esta dirección no existe o el enlace ha caducado. Comprueba la URL o vuelve al inicio.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
          >
            Volver al inicio
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft"
          >
            Acceder al panel
          </Link>
        </div>

        <p className="mt-12 font-heading text-sm font-semibold tracking-tight text-primary">
          Appoclick
        </p>
      </div>
    </main>
  );
}
