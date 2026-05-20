"use client";

import { useEffect } from "react";

import { DayView } from "@/components/clinic/calendar/DayView";
import { MonthView } from "@/components/clinic/calendar/MonthView";
import { WeekView } from "@/components/clinic/calendar/WeekView";
import { formatDateInput, parseDateInput } from "@/lib/calendar/dateHelpers";
import type {
  AppointmentRow,
  ClinicHourRow,
} from "@/lib/calendar/useCalendarData";
import { getTodayInputValue } from "@/lib/dateFormat";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export type CalendarViewMode = "day" | "week" | "month";

const VIEW_TITLES: Record<CalendarViewMode, { heroLabel: string; sectionTitle: string; badge: string }> = {
  day: {
    heroLabel: "diario",
    sectionTitle: "Vista del día",
    badge: "Agenda puntual",
  },
  week: {
    heroLabel: "semanal",
    sectionTitle: "Vista de la semana",
    badge: "Semana laboral",
  },
  month: {
    heroLabel: "mensual",
    sectionTitle: "Vista del mes",
    badge: "Vista mensual",
  },
};

const VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

function formatMonthYearLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Vista del mes";
  const monthName = date.toLocaleDateString("es-ES", { month: "long" });
  const year = date.getFullYear();
  return `Vista de ${monthName} ${year}`;
}

type CalendarLayoutProps = {
  clinicHours: ClinicHourRow[];
  appointmentsByDate: Record<string, AppointmentRow[]>;
  selectedDate: string;
  viewMode: CalendarViewMode;
  availableViews: CalendarViewMode[];
  basePath: string;
  onSelectedDateChange: (dateString: string) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onAppointmentClick: (appointment: AppointmentRow) => void;
  loading: boolean;
  errorMessage: string | null;
};

export function CalendarLayout({
  clinicHours,
  appointmentsByDate,
  selectedDate,
  viewMode,
  availableViews,
  basePath,
  onSelectedDateChange,
  onViewModeChange,
  onAppointmentClick,
  loading,
  errorMessage,
}: CalendarLayoutProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!isDesktop && viewMode === "month") {
      onViewModeChange("week");
    }
  }, [isDesktop, viewMode, onViewModeChange]);

  const effectiveViewMode: CalendarViewMode = availableViews.includes(viewMode)
    ? viewMode
    : "day";

  const titles = VIEW_TITLES[effectiveViewMode];
  const sectionTitle =
    effectiveViewMode === "month"
      ? formatMonthYearLabel(selectedDate)
      : titles.sectionTitle;

  const shiftDays = (days: number) => {
    const baseDate = parseDateInput(selectedDate) ?? new Date();
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    onSelectedDateChange(formatDateInput(nextDate));
  };

  const shiftMonths = (months: number) => {
    const baseDate = parseDateInput(selectedDate) ?? new Date();
    const next = new Date(baseDate);
    next.setMonth(next.getMonth() + months);
    onSelectedDateChange(formatDateInput(next));
  };

  const handlePrev = () => {
    if (effectiveViewMode === "day") shiftDays(-1);
    else if (effectiveViewMode === "week") shiftDays(-7);
    else shiftMonths(-1);
  };

  const handleNext = () => {
    if (effectiveViewMode === "day") shiftDays(1);
    else if (effectiveViewMode === "week") shiftDays(7);
    else shiftMonths(1);
  };

  const handleDayClickFromMonth = (dateString: string) => {
    onSelectedDateChange(dateString);
    onViewModeChange("day");
  };

  const dayAppointments = appointmentsByDate[selectedDate] ?? [];

  const monthAppointments = Object.values(appointmentsByDate).flat();

  return (
    <>
      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(255,255,255,0.98))] p-7 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Agenda clínica
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
                Calendario {titles.heroLabel}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Revisa tu agenda, detecta huecos libres y accede rápido a cada cita desde una vista
                más limpia y legible.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] xl:min-w-[420px]">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/85 p-2 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => onSelectedDateChange(getTodayInputValue())}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  Siguiente →
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="rounded-[10px] border border-border bg-white p-1">
                  {availableViews.map((mode) => {
                    const isMonth = mode === "month";
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onViewModeChange(mode)}
                        className={`rounded-[8px] px-3 py-2 font-heading text-sm font-medium transition-all ${
                          isMonth ? "hidden md:inline-flex" : "inline-flex"
                        } ${
                          effectiveViewMode === mode
                            ? "bg-primary text-white"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {VIEW_LABELS[mode]}
                      </button>
                    );
                  })}
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Fecha</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => onSelectedDateChange(event.target.value)}
                    className="mt-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {sectionTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Mantén el foco en la agenda sin perder el contexto de horarios y estados.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              {titles.badge}
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-slate-600">Cargando agenda...</p>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : effectiveViewMode === "day" ? (
            <DayView
              selectedDate={selectedDate}
              basePath={basePath}
              clinicHours={clinicHours}
              appointments={dayAppointments}
              onAppointmentClick={onAppointmentClick}
            />
          ) : effectiveViewMode === "week" ? (
            <WeekView
              selectedDate={selectedDate}
              basePath={basePath}
              clinicHours={clinicHours}
              appointmentsByDate={appointmentsByDate}
              onAppointmentClick={onAppointmentClick}
            />
          ) : (
            <MonthView
              selectedDate={selectedDate}
              clinicHours={clinicHours}
              appointments={monthAppointments}
              onAppointmentClick={onAppointmentClick}
              onDayClick={handleDayClickFromMonth}
            />
          )}
        </div>
      </section>
    </>
  );
}
