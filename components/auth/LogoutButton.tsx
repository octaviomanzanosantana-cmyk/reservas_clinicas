"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cerrar sesion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Cerrando sesion..." : "Cerrar sesion"}
      </button>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
