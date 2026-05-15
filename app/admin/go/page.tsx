import { getAdminUser } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import AdminGoForm from "./AdminGoForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ slug?: string }>;
};

export default async function AdminGoPage({ searchParams }: PageProps) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/login?next=/admin/go");
  }

  const params = await searchParams;
  const initialSlug = params.slug?.trim().toLowerCase() ?? "";

  return <AdminGoForm initialSlug={initialSlug} />;
}
