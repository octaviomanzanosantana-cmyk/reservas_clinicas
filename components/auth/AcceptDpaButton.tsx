"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptDpaButton() {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/accept-dpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo aceptar el DPA");
      }

      setAccepted(true);
      setTimeout(() => router.push("/clinic"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aceptar");
    } finally {
      setAccepting(false);
    }
  };

  if (accepted) {
    return (
      <div className="mt-8 rounded-[14px] border-[0.5px] border-primary/20 bg-primary-soft p-5 text-center">
        <p className="text-sm font-semibold text-foreground">DPA aceptado correctamente</p>
        <p className="mt-1 text-sm text-muted">Redirigiendo a tu panel...</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-[14px] border-[0.5px] border-border bg-background p-5 text-center">
      <p className="text-sm text-muted">
        Al hacer clic, confirmas que has leído y aceptas este contrato.
      </p>
      <button
        type="button"
        onClick={() => void handleAccept()}
        disabled={accepting}
        className="mt-3 rounded-[10px] bg-primary px-6 py-2.5 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {accepting ? "Aceptando..." : "Acepto el DPA"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
