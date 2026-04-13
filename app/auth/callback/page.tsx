"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Supabase sends tokens as hash fragment: #access_token=...&refresh_token=...&type=recovery
        const hash = window.location.hash.substring(1);
        if (!hash) {
          setError("No se encontraron datos de autenticación en el enlace.");
          return;
        }

        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (!accessToken || !refreshToken) {
          setError("Enlace de autenticación no válido o incompleto.");
          return;
        }

        // Set session from tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError("El enlace ha caducado o no es válido. Solicita uno nuevo.");
          return;
        }

        // Redirect based on type
        switch (type) {
          case "recovery":
            router.replace("/reset-password");
            break;
          case "magiclink":
          case "signup":
          default:
            router.replace("/clinic");
            break;
        }
      } catch {
        setError("Error al procesar el enlace de autenticación.");
      }
    };

    void processCallback();
  }, [router, supabase]);

  if (error) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-md">
          <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card px-6 py-8 text-center">
            <h1 className="font-heading text-xl font-semibold text-foreground">Error de autenticación</h1>
            <p className="mt-3 text-sm text-muted">{error}</p>
            <a href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary underline">
              Solicitar nuevo enlace
            </a>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-muted">Procesando enlace de autenticación...</p>
      </div>
    </main>
  );
}
