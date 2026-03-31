import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Cargar .env.local manualmente (Node.js no lo hace por defecto)
try {
  const envPath = resolve(import.meta.dirname ?? ".", "..", ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // No .env.local — depende de variables de entorno del sistema
}

function parseArgs(argv) {
  const args = {};

  for (const item of argv) {
    if (!item.startsWith("--")) continue;

    const [rawKey, ...rawValueParts] = item.slice(2).split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();

    if (!key) continue;

    if (key === "service") {
      args.service = args.service ?? [];
      args.service.push(value);
      continue;
    }

    args[key] = value === "" ? true : value;
  }

  return args;
}

function normalizeSlug(value) {
  return value.trim().toLowerCase();
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function parseService(value) {
  const [namePart, durationPart] = value.split(":");
  const name = namePart?.trim();
  const duration = Number(durationPart?.trim());

  if (!name || Number.isNaN(duration) || duration <= 0) {
    throw new Error(`Servicio inválido: "${value}". Usa el formato "Nombre:30"`);
  }

  return {
    name,
    duration_minutes: duration,
    active: true,
  };
}

function buildDefaultHours(clinicSlug) {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    clinic_slug: clinicSlug,
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "18:00",
    active: true,
    updated_at: new Date().toISOString(),
  }));
}

function buildDefaultServices(clinicSlug) {
  return [
    { clinic_slug: clinicSlug, name: "Primera consulta", duration_minutes: 30, active: true },
    { clinic_slug: clinicSlug, name: "Revisión", duration_minutes: 20, active: true },
    { clinic_slug: clinicSlug, name: "Seguimiento", duration_minutes: 30, active: true },
  ];
}

function printUsage() {
  console.log(`
Uso:
  npm run clinic:create -- --name="Clínica Atlas" --slug=atlas --phone="+34 600 000 000" --address="Calle Real 12" --color="#0F766E"

Opciones:
  --name=...                  Nombre de la clínica
  --slug=...                  Slug único
  --phone=...                 Teléfono de contacto
  --address=...               Dirección
  --color=...                 Color principal
  --description=...           Descripción opcional
  --logo-url=...              URL de logo opcional
  --seed-default-services     Crea 3 servicios base
  --seed-default-hours        Crea horario base L-V 09:00-18:00
  --service="Nombre:30"       Servicio personalizado. Repetible
  --booking-enabled=true      Opcional, por defecto true
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const name = typeof args.name === "string" ? args.name.trim() : "";
  const slug = typeof args.slug === "string" ? normalizeSlug(args.slug) : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const address = typeof args.address === "string" ? args.address.trim() : "";
  const color = typeof args.color === "string" ? args.color.trim() : "#2563EB";
  const description = typeof args.description === "string" ? args.description.trim() : null;
  const logoUrl = typeof args["logo-url"] === "string" ? args["logo-url"].trim() : null;
  const bookingEnabled =
    typeof args["booking-enabled"] === "string"
      ? parseBoolean(args["booking-enabled"], true)
      : true;

  if (!name || !slug || !phone || !address || !color) {
    printUsage();
    throw new Error("Faltan argumentos requeridos: --name, --slug, --phone, --address, --color");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clinicPayload = {
    slug,
    name,
    phone,
    address,
    description,
    logo_url: logoUrl,
    theme_color: color,
    booking_enabled: bookingEnabled,
  };

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .insert(clinicPayload)
    .select("*")
    .single();

  if (clinicError) {
    throw new Error(`No se pudo crear la clínica: ${clinicError.message}`);
  }

  const customServices = Array.isArray(args.service) ? args.service.map(parseService) : [];
  const servicesToSeed =
    customServices.length > 0
      ? customServices.map((item) => ({ ...item, clinic_slug: slug }))
      : parseBoolean(String(args["seed-default-services"] ?? ""), false)
        ? buildDefaultServices(slug)
        : [];

  if (servicesToSeed.length > 0) {
    const { error: servicesError } = await supabase
      .from("services")
      .insert(servicesToSeed);

    if (servicesError) {
      throw new Error(`Clínica creada, pero falló la siembra de servicios: ${servicesError.message}`);
    }
  }

  const shouldSeedHours = parseBoolean(String(args["seed-default-hours"] ?? ""), false);
  if (shouldSeedHours) {
    const { error: hoursError } = await supabase
      .from("clinic_hours")
      .upsert(buildDefaultHours(slug), {
        onConflict: "clinic_slug,day_of_week",
      });

    if (hoursError) {
      throw new Error(`Clínica creada, pero falló la siembra de horarios: ${hoursError.message}`);
    }
  }

  console.log(`Clínica creada: ${clinic.name} (${clinic.slug})`);
  console.log(`URL pública: /b/${clinic.slug}`);
  console.log(`Teléfono: ${clinic.phone ?? "-"}`);
  console.log(
    `Siguiente paso manual: si quieres usar el panel actual para esta clínica, cambia PANEL_CLINIC_SLUG en lib/clinicPanel.ts a "${clinic.slug}".`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
