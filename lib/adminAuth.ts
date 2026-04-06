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
  console.log("[adminAuth] ADMIN_EMAILS configured:", adminEmails.length, "emails:", adminEmails);

  if (adminEmails.length === 0) {
    console.log("[adminAuth] No admin emails configured — check ADMIN_EMAILS env var in Vercel");
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  console.log("[adminAuth] getUser result — user:", data.user?.email ?? "null", "error:", error?.message ?? "none");

  if (!data.user?.email) return null;

  const email = data.user.email.trim().toLowerCase();
  const isAdmin = adminEmails.includes(email);
  console.log("[adminAuth] email check:", email, "isAdmin:", isAdmin);

  if (!isAdmin) return null;

  return { id: data.user.id, email };
}
