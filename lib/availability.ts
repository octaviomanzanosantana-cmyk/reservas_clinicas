type AvailabilityAppointment = {
  scheduled_at: string | null;
  duration_label?: string | null;
  token?: string | null;
  status?: string | null;
};

type GetAvailableSlotsParams = {
  date: Date;
  appointments: AvailabilityAppointment[];
  excludeToken?: string;
  slotMinutes?: number;
};

type AvailableSlot = {
  value: string;
  label: string;
};

const DEFAULT_DURATION_MINUTES = 30;
const CLINIC_START_HOUR = 9;
const CLINIC_END_HOUR = 18;

export function parseDurationMinutes(durationLabel: string | null | undefined): number {
  if (!durationLabel) return DEFAULT_DURATION_MINUTES;

  const match = durationLabel.match(/(\d+)/);
  if (!match) return DEFAULT_DURATION_MINUTES;

  const minutes = Number.parseInt(match[1], 10);
  if (Number.isNaN(minutes) || minutes <= 0) return DEFAULT_DURATION_MINUTES;

  return minutes;
}

export function formatTimeLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function buildDaySlots(date: Date, slotMinutes = DEFAULT_DURATION_MINUTES): Date[] {
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : DEFAULT_DURATION_MINUTES;
  const start = new Date(date);
  start.setHours(CLINIC_START_HOUR, 0, 0, 0);

  const end = new Date(date);
  end.setHours(CLINIC_END_HOUR, 0, 0, 0);

  const slots: Date[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + safeSlotMinutes * 60_000)) {
    slots.push(new Date(cursor));
  }

  return slots;
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

export function getAvailableSlotsForDate(params: GetAvailableSlotsParams): AvailableSlot[] {
  const { date, appointments, excludeToken, slotMinutes = DEFAULT_DURATION_MINUTES } = params;
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : DEFAULT_DURATION_MINUTES;
  const slotDurationMs = safeSlotMinutes * 60_000;

  const slots = buildDaySlots(date, safeSlotMinutes);

  const occupiedRanges = appointments
    .filter((item) => item.status !== "cancelled")
    .filter((item) => (excludeToken ? item.token !== excludeToken : true))
    .map((item) => {
      if (!item.scheduled_at) return null;

      const start = new Date(item.scheduled_at);
      if (Number.isNaN(start.getTime())) return null;
      if (!isSameLocalDate(start, date)) return null;

      const durationMinutes = parseDurationMinutes(item.duration_label);
      const end = new Date(start.getTime() + durationMinutes * 60_000);

      return { start, end };
    })
    .filter((item): item is { start: Date; end: Date } => Boolean(item));

  return slots
    .filter((slotStart) => {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
      return !occupiedRanges.some((occupied) =>
        rangesOverlap(slotStart, slotEnd, occupied.start, occupied.end),
      );
    })
    .map((slot) => ({
      value: slot.toISOString(),
      label: formatTimeLabel(slot),
    }));
}
