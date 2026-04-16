import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const BUCKET = "clinic-logos";

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCurrentClinicForApi();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG, SVG o WebP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 2MB." },
        { status: 400 },
      );
    }

    await ensureBucket();

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${access.clinicSlug}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update clinic logo_url
    await supabaseAdmin
      .from("clinics")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", access.clinicId);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir el logo" },
      { status: 500 },
    );
  }
}
