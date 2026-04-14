"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminEnterClinicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token no proporcionado");
      return;
    }

    // Set cookie and redirect
    document.cookie = `admin_token=${token}; path=/clinic/${slug}; max-age=300; SameSite=Lax`;
    window.location.href = `/clinic/${slug}`;
  }, [slug, token]);

  if (error) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm text-red-600">{error}</p>
          <a href="/admin/clinics" className="mt-4 inline-block text-sm font-medium text-primary underline">
            Volver al admin
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-muted">Accediendo al panel de {slug}...</p>
      </div>
    </main>
  );
}
