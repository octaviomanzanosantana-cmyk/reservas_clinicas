// Sprint 7.6 — DPA banner para clínicas sin aceptar.
// Excluye pilots por P14.
//
// Patrón: replica SubscriptionBanner (server wrapper + client UI).
// Recibe clinicId por prop desde el layout (by-slug)/[slug]/layout.tsx.
// Lee solo los 2 campos necesarios y delega el render al cliente, que
// gestiona cooldown 24h en localStorage.

import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DPABannerClient from "./DPABannerClient";

type Props = {
  clinicId: string;
};

export default async function DPABanner({ clinicId }: Props) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("is_pilot, dpa_accepted_at")
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !data) return null;

  // P14: pilots NO ven banner nunca (decisión Sprint 7.6 Fase 2).
  if (data.is_pilot === true) return null;

  // Ya firmado → nada que recordar.
  if (data.dpa_accepted_at) return null;

  return <DPABannerClient />;
}
