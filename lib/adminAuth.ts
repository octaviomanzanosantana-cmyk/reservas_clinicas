import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    console.warn("[adminAuth] No admin emails configured");
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user?.email) return null;

  const email = data.user.email.trim().toLowerCase();
  const isAdmin = adminEmails.includes(email);

  if (!isAdmin) return null;

  return { id: data.user.id, email };
}
