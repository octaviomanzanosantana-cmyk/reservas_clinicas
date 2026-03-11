type AvailabilityAppointment = {
  scheduled_at: string | null;
  duration_label?: string | null;
  token?: string | null;
  status?: string | null;
};

export type BusyRange = {
  start: Date;
  end: Date;
};

export type GetAvailableSlotsParams = {
  date: Date;
  busyRanges: BusyRange[];
  slotMinutes?: number;
  dayStartHour?: number;
  dayEndHour?: number;
};

export type AvailableSlot = {
  value: string;
  label: string;
};

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_DAY_START_HOUR = 9;
const DEFAULT_DAY_END_HOUR = 18;

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

export function buildDaySlots(
  date: Date,
  slotMinutes = DEFAULT_DURATION_MINUTES,
  dayStartHour = DEFAULT_DAY_START_HOUR,
  dayEndHour = DEFAULT_DAY_END_HOUR,
): Date[] {
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : DEFAULT_DURATION_MINUTES;
  const safeDayStartHour =
    typeof dayStartHour === "number" && Number.isFinite(dayStartHour)
      ? dayStartHour
      : DEFAULT_DAY_START_HOUR;
  const safeDayEndHour =
    typeof dayEndHour === "number" && Number.isFinite(dayEndHour)
      ? dayEndHour
      : DEFAULT_DAY_END_HOUR;
  if (safeDayEndHour <= safeDayStartHour) {
    return [];
  }
  const start = new Date(date);
  start.setHours(safeDayStartHour, 0, 0, 0);

  const end = new Date(date);
  end.setHours(safeDayEndHour, 0, 0, 0);

  const slots: Date[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + safeSlotMinutes * 60_000)) {
    slots.push(new Date(cursor));
  }

  return slots;
}

export function buildDaySlotsFromTimeRange(
  date: Date,
  startTime: string,
  endTime: string,
  slotMinutes = DEFAULT_DURATION_MINUTES,
): Date[] {
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : DEFAULT_DURATION_MINUTES;
  const slotDurationMs = safeSlotMinutes * 60_000;
  const startMatch = startTime.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  const endMatch = endTime.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!startMatch || !endMatch) {
    return [];
  }

  const startHours = Number.parseInt(startMatch[1], 10);
  const startMinutes = Number.parseInt(startMatch[2], 10);
  const endHours = Number.parseInt(endMatch[1], 10);
  const endMinutes = Number.parseInt(endMatch[2], 10);

  const start = new Date(date);
  start.setHours(startHours, startMinutes, 0, 0);

  const end = new Date(date);
  end.setHours(endHours, endMinutes, 0, 0);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return [];
  }

  const slots: Date[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() + slotDurationMs <= end.getTime();
    cursor = new Date(cursor.getTime() + slotDurationMs)
  ) {
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

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

export function getBusyRangesFromAppointments(params: {
  date: Date;
  appointments: AvailabilityAppointment[];
  excludeToken?: string;
}): BusyRange[] {
  const { date, appointments, excludeToken } = params;

  return appointments
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
    .filter((item): item is BusyRange => Boolean(item));
}

export function getAvailableSlotsForDate(params: GetAvailableSlotsParams): AvailableSlot[] {
  const {
    date,
    busyRanges,
    slotMinutes = DEFAULT_DURATION_MINUTES,
    dayStartHour = DEFAULT_DAY_START_HOUR,
    dayEndHour = DEFAULT_DAY_END_HOUR,
  } = params;
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : DEFAULT_DURATION_MINUTES;
  const slotDurationMs = safeSlotMinutes * 60_000;

  const slots = buildDaySlots(date, safeSlotMinutes, dayStartHour, dayEndHour);

  return slots
    .filter((slotStart) => {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
      return !busyRanges.some((occupied) =>
        rangesOverlap(slotStart, slotEnd, occupied.start, occupied.end),
      );
    })
    .map((slot) => ({
      value: slot.toISOString(),
      label: formatTimeLabel(slot),
    }));
}
