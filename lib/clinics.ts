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
  google_connected: boolean;
  google_email: string | null;
  google_refresh_token: string | null;
  google_calendar_id: string | null;
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

export async function getClinicById(id: string): Promise<ClinicRow | null> {
  const safeId = id.trim();
  if (!safeId) return null;

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("id", safeId)
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
    | "slug"
    | "name"
    | "description"
    | "address"
    | "phone"
    | "theme_color"
    | "booking_enabled"
    | "google_connected"
    | "google_email"
    | "google_refresh_token"
    | "google_calendar_id"
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
      google_connected: input.google_connected,
      google_email: input.google_email?.trim() || null,
      google_refresh_token: input.google_refresh_token?.trim() || null,
      google_calendar_id: input.google_calendar_id?.trim() || null,
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
      | "name"
      | "description"
      | "address"
      | "phone"
      | "logo_url"
      | "theme_color"
      | "booking_enabled"
      | "google_connected"
      | "google_email"
      | "google_refresh_token"
      | "google_calendar_id"
    >
  >,
): Promise<ClinicRow | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const payload = {
    ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
    ...(typeof input.description === "string"
      ? { description: input.description.trim() || null }
      : input.description === null
        ? { description: null }
        : {}),
    ...(typeof input.address === "string"
      ? { address: input.address.trim() || null }
      : input.address === null
        ? { address: null }
        : {}),
    ...(typeof input.phone === "string"
      ? { phone: input.phone.trim() || null }
      : input.phone === null
        ? { phone: null }
        : {}),
    ...(typeof input.logo_url === "string"
      ? { logo_url: input.logo_url.trim() || null }
      : input.logo_url === null
        ? { logo_url: null }
        : {}),
    ...(typeof input.theme_color === "string"
      ? { theme_color: input.theme_color.trim() || null }
      : input.theme_color === null
        ? { theme_color: null }
        : {}),
    ...(typeof input.booking_enabled === "boolean"
      ? { booking_enabled: input.booking_enabled }
      : {}),
    ...(typeof input.google_connected === "boolean"
      ? { google_connected: input.google_connected }
      : {}),
    ...(typeof input.google_email === "string"
      ? { google_email: input.google_email.trim() || null }
      : input.google_email === null
        ? { google_email: null }
        : {}),
    ...(typeof input.google_refresh_token === "string"
      ? { google_refresh_token: input.google_refresh_token.trim() || null }
      : input.google_refresh_token === null
        ? { google_refresh_token: null }
        : {}),
    ...(typeof input.google_calendar_id === "string"
      ? { google_calendar_id: input.google_calendar_id.trim() || null }
      : input.google_calendar_id === null
        ? { google_calendar_id: null }
        : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .update({
      ...payload,
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
