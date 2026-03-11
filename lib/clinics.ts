import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  theme_color: string | null;
  booking_enabled: boolean;
};

export async function getClinicBySlug(slug: string): Promise<ClinicRow | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("slug", safeSlug)
    .maybeSingle<ClinicRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function listClinics(): Promise<ClinicRow[]> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateClinicBySlug(
  slug: string,
  input: Partial<
    Pick<
      ClinicRow,
      "name" | "description" | "address" | "phone" | "logo_url" | "theme_color" | "booking_enabled"
    >
  >,
): Promise<ClinicRow | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", safeSlug)
    .select("*")
    .maybeSingle<ClinicRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}
