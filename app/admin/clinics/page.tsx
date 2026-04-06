import { getAdminUser } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import AdminDemoPanel from "./AdminDemoPanel";

export const dynamic = "force-dynamic";

export default async function AdminClinicsPage() {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/login?next=/admin/clinics");
  }

  return <AdminDemoPanel />;
}
