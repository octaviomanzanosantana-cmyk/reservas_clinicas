import type { ClinicHourRow } from "./useCalendarData";

export type MonthGridDay = {
  date: Date;
  dateString: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number;
};

export function parseDateInput(dateInput: string): Date | null {
  const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSlotKey(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function getSchedulesForDate(
  date: Date,
  clinicHours: ClinicHourRow[],
): ClinicHourRow[] {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  return clinicHours.filter((item) => item.day_of_week === dayOfWeek);
}

// month es 1-12 (1=Enero). Devuelve 42 celdas (6 filas × 7 columnas) empezando en lunes.
// today opcional para testabilidad (fija "hoy" para isToday).
export function getMonthGrid(
  year: number,
  month: number,
  today: Date = new Date(),
): MonthGridDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstDayOfWeek =
    firstOfMonth.getDay() === 0 ? 7 : firstOfMonth.getDay();

  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - (firstDayOfWeek - 1));

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  const targetMonthIndex = month - 1;

  const grid: MonthGridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay() === 0 ? 7 : date.getDay();
    grid.push({
      date,
      dateString: formatDateInput(date),
      dayOfMonth: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === year && date.getMonth() === targetMonthIndex,
      isToday:
        date.getFullYear() === todayYear &&
        date.getMonth() === todayMonth &&
        date.getDate() === todayDate,
      dayOfWeek: dow,
    });
  }
  return grid;
}

export function isOperatingDay(
  dayOfWeek: number,
  clinicHours: ClinicHourRow[],
): boolean {
  return clinicHours.some(
    (h) => h.day_of_week === dayOfWeek && h.active === true,
  );
}
