/**
 * Utilidades para exportar citas a Google Calendar, Apple Calendar e .ics genérico.
 * Client-safe — sin dependencias de servidor.
 */

type CalendarEventInput = {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  durationMinutes: number;
};

function toGoogleCalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function getEndDate(input: CalendarEventInput): Date {
  return new Date(input.startDate.getTime() + input.durationMinutes * 60_000);
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const end = getEndDate(input);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toGoogleCalendarDate(input.startDate)}/${toGoogleCalendarDate(end)}`,
    details: input.description,
    location: input.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(input: CalendarEventInput): string {
  const end = getEndDate(input);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@appoclick`;
  const now = toIcsDate(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Appoclick//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(input.startDate)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `LOCATION:${escapeIcsText(input.location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcsFile(input: CalendarEventInput, filename = "cita.ics"): void {
  const content = buildIcsContent(input);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseDurationFromLabel(durationLabel: string): number {
  const match = durationLabel.match(/\d+/);
  return match ? Number(match[0]) : 30;
}
