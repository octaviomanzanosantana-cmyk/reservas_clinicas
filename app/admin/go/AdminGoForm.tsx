"use client";

import { useEffect, useState, type FormEvent } from "react";

const STORAGE_KEY = "appoclick.admin.recentSlugs";
const MAX_RECENT = 5;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

const INPUT_CLASS =
  "mt-1 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary";

function loadRecentSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSlugs(slugs: string[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(slugs.slice(0, MAX_RECENT)),
    );
  } catch {
    // localStorage indisponible (modo privado, quota) — ignorar
  }
}

type AdminGoFormProps = {
  initialSlug: string;
};

export default function AdminGoForm({ initialSlug }: AdminGoFormProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [recent, setRecent] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecent(loadRecentSlugs());
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleaned = slug.trim().toLowerCase();
    if (!cleaned) {
      setError("Introduce un slug.");
      return;
    }
    if (!SLUG_PATTERN.test(cleaned)) {
      setError("Solo letras minúsculas, números y guiones.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/impersonate-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: cleaned }),
      });
      const data = (await res.json()) as {
        redirect_to?: string;
        error?: string;
      };

      if (!res.ok || !data.redirect_to) {
        throw new Error(data.error ?? "No se pudo acceder.");
      }

      const nextRecent = [
        cleaned,
        ...recent.filter((s) => s !== cleaned),
      ].slice(0, MAX_RECENT);
      saveRecentSlugs(nextRecent);

      window.location.href = data.redirect_to;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acceder.");
      setSubmitting(false);
    }
  };

  const handlePickRecent = (s: string) => {
    setSlug(s);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Entrar a clínica
          </h1>
          <p className="mt-2 text-sm text-muted">
            Acceso directo por slug. Inicia una sesión de impersonación de 60
            minutos.
          </p>

          <form className="mt-6" onSubmit={(e) => void handleSubmit(e)}>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Slug</span>
              <input
                autoFocus
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ej. cliente-x"
                className={INPUT_CLASS}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <button
              type="submit"
              disabled={submitting || !slug.trim()}
              className="mt-4 w-full rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Entrando…" : "Entrar como admin"}
            </button>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}
          </form>

          {recent.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Recientes
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {recent.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => handlePickRecent(s)}
                      className="rounded-full border-[0.5px] border-border bg-white px-3 py-1 text-sm text-foreground hover:bg-slate-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
