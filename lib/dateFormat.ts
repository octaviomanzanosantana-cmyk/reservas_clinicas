/**
 * Utilidades de formato de fecha compartidas entre la reserva pública,
 * el panel de clínica, la gestión del paciente y la API de reschedule.
 */

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayInputValue(): string {
  return toDateInputValue(new Date());
}

/**
 * Genera el label "Lunes · 09:30" a partir de un Date.
 * Si se pasa timezone, formatea en esa zona horaria.
 */
export function buildDateTimeLabel(date: Date, timezone?: string): string {
  const tzOptions: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};

  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", ...tzOptions }).format(date);
  const weekdayTitle = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  const timeLabel = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...tzOptions,
  }).format(date);

  return `${weekdayTitle} · ${timeLabel}`;
}

/**
 * Genera el label "Lunes · 09:30" a partir de strings de fecha e input de hora.
 * Usado por la reserva pública y el panel de creación de citas.
 * El timeInput ya viene en hora local del cliente, no necesita conversión.
 */
export function buildDateTimeLabelFromInputs(dateInput: string, timeInput: string): string {
  const date = new Date(`${dateInput}T${timeInput}:00`);
  if (Number.isNaN(date.getTime())) {
    return `${dateInput} · ${timeInput}`;
  }

  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const weekdayTitle = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${weekdayTitle} · ${timeInput}`;
}
