// Plantilla compartida del mensaje que se comparte por WhatsApp tanto
// desde "Compartir cita" (botón verde del dashboard, modo confirmation)
// como desde el email matinal + panel de recordatorios (modo reminder).
//
// NO es server-only — se consume desde client components.
//
// Emojis construidos con String.fromCodePoint a RUNTIME — defensa definitiva
// contra corrupción del bundler/minifier con chars fuera del BMP. Ni la
// fuente del archivo ni el output transpilado tienen bytes multi-byte:
// el JS generado sólo contiene una llamada a función con un entero.
const EMOJI_CALENDAR = String.fromCodePoint(0x1f4c5); // 📅
const EMOJI_LOCATION = String.fromCodePoint(0x1f4cd); // 📍
const EMOJI_LAPTOP = String.fromCodePoint(0x1f4bb); // 💻
const EMOJI_VIDEO = String.fromCodePoint(0x1f3a5); // 🎥

export type AppointmentShareKind = "confirmation" | "reminder";

export type AppointmentShareParams = {
  kind: AppointmentShareKind;
  patientName: string;
  clinicName: string;
  serviceName: string;
  dateLabel: string; // caller lo pre-formatea (browser TZ o clinic TZ según contexto)
  address: string | null;
  modality: "presencial" | "online";
  videoLink: string | null;
  appointmentToken: string;
  appUrl: string; // e.g. "https://app.appoclick.com"
};

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] ?? fullName;
}

export function buildAppointmentShareMessage(params: AppointmentShareParams): string {
  const name = firstName(params.patientName);
  const serviceClause = params.serviceName.trim() ? ` de ${params.serviceName.trim()}` : "";

  const opening =
    params.kind === "reminder"
      ? `Hola ${name}, te recordamos tu cita${serviceClause} con ${params.clinicName} mañana:`
      : `Hola ${name}, te confirmamos tu cita${serviceClause} con ${params.clinicName}:`;

  const isOnline = params.modality === "online";
  const locationLine = isOnline
    ? params.videoLink
      ? `${EMOJI_LAPTOP} Consulta online`
      : `${EMOJI_LAPTOP} Consulta online (recibirás el enlace próximamente)`
    : params.address?.trim()
      ? `${EMOJI_LOCATION} ${params.address.trim()}`
      : "";
  const videoLine =
    isOnline && params.videoLink
      ? `${EMOJI_VIDEO} Enlace de consulta: ${params.videoLink}`
      : "";

  const manageUrl = `${params.appUrl.replace(/\/+$/, "")}/a/${params.appointmentToken}`;

  // Mismo patrón que el botón "Compartir" del dashboard: filter(Boolean)
  // elimina líneas vacías y junta. WhatsApp renderiza con saltos
  // suficientes.
  return [
    opening,
    `${EMOJI_CALENDAR} ${params.dateLabel}`,
    locationLine,
    videoLine,
    "",
    "Gestiona tu cita aquí:",
    manageUrl,
    "",
    `— ${params.clinicName}`,
  ]
    .filter(Boolean)
    .join("\n");
}
