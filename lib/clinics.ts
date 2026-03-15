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

export async function createClinic(
  input: Pick<
    ClinicRow,
    "slug" | "name" | "description" | "address" | "phone" | "theme_color" | "booking_enabled"
  > & {
    logo_url?: string | null;
  },
): Promise<ClinicRow> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .insert({
      slug,
      name,
      description: input.description?.trim() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      theme_color: input.theme_color?.trim() || null,
      booking_enabled: input.booking_enabled,
    })
    .select("*")
    .single<ClinicRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la clínica");
  }

  return data;
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
