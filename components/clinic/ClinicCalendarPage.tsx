"use client";

import { ClinicSetupBanner } from "@/components/clinic/ClinicSetupBanner";
import {
  CalendarLayout,
  type CalendarViewMode,
} from "@/components/clinic/calendar/CalendarLayout";
import {
  EditAppointmentModal,
  type EditableAppointment,
  type ReschedulePayload,
} from "@/components/clinic/EditAppointmentModal";
import { formatDateInput, parseDateInput } from "@/lib/calendar/dateHelpers";
import {
  useCalendarData,
  type AppointmentRow,
} from "@/lib/calendar/useCalendarData";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { getTodayInputValue } from "@/lib/dateFormat";
import { clinicHasFeature } from "@/lib/planFeatures";
import { useCallback, useMemo, useState } from "react";

type ClinicCalendarPageProps = {
  clinicSlug?: string;
  basePath?: string;
};

export function ClinicCalendarPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicCalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  const selectedDateObject = useMemo(() => parseDateInput(selectedDate), [selectedDate]);

  const { startDate, endDate } = useMemo(() => {
    if (!selectedDateObject) return { startDate: "", endDate: "" };

    if (viewMode === "week") {
      const dayOfWeek =
        selectedDateObject.getDay() === 0 ? 7 : selectedDateObject.getDay();
      const monday = new Date(selectedDateObject);
      monday.setDate(selectedDateObject.getDate() - (dayOfWeek - 1));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      return {
        startDate: formatDateInput(monday),
        endDate: formatDateInput(friday),
      };
    }

    if (viewMode === "month") {
      // Rango que cubre las 42 celdas del grid (6 semanas desde el lunes de la
      // semana que contiene el día 1 del mes).
      const firstOfMonth = new Date(
        selectedDateObject.getFullYear(),
        selectedDateObject.getMonth(),
        1,
      );
      const dow =
        firstOfMonth.getDay() === 0 ? 7 : firstOfMonth.getDay();
      const startMonday = new Date(firstOfMonth);
      startMonday.setDate(firstOfMonth.getDate() - (dow - 1));
      const endDay = new Date(startMonday);
      endDay.setDate(startMonday.getDate() + 41);
      return {
        startDate: formatDateInput(startMonday),
        endDate: formatDateInput(endDay),
      };
    }

    return { startDate: selectedDate, endDate: selectedDate };
  }, [viewMode, selectedDate, selectedDateObject]);

  const {
    clinic,
    clinicHours,
    appointmentsByDate,
    loading,
    error: errorMessage,
    refetch,
  } = useCalendarData({ clinicSlug, startDate, endDate });

  const availableViews = useMemo<CalendarViewMode[]>(() => {
    const canMonth = clinic
      ? clinicHasFeature(
          { plan: clinic.plan ?? null, is_pilot: clinic.is_pilot ?? null },
          "month_view",
        )
      : false;
    return canMonth ? ["day", "week", "month"] : ["day", "week"];
  }, [clinic]);

  const handleAppointmentClick = useCallback((appointment: AppointmentRow) => {
    setEditingAppointment(appointment);
  }, []);

  const showFeedback = useCallback((tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const handleSavePatient = useCallback(
    async (data: {
      token: string;
      patient_name: string;
      patient_email: string | null;
      patient_phone: string | null;
      modality: string;
      video_link: string | null;
    }) => {
      const response = await fetch("/api/appointments/update-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { appointment?: AppointmentRow; error?: string };
      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo actualizar");
      }

      setEditingAppointment(null);
      refetch();
      showFeedback("success", "Datos del paciente actualizados");
    },
    [refetch, showFeedback],
  );

  const handleReschedule = useCallback(
    async (payload: ReschedulePayload) => {
      const response = await fetch("/api/clinic/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        appointment?: AppointmentRow;
        error?: string;
        calendarWarning?: string | null;
      };
      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo reagendar la cita");
      }

      setEditingAppointment(null);
      refetch();

      if (result.calendarWarning) {
        showFeedback(
          "error",
          `Cita reagendada, pero Google Calendar no se sincronizó: ${result.calendarWarning}`,
        );
      } else {
        showFeedback("success", "Cita reagendada correctamente");
      }
    },
    [refetch, showFeedback],
  );

  const formatDateForModal = useCallback((scheduledAt: string | null, fallback: string) => {
    if (!scheduledAt) return fallback;
    const dt = new Date(scheduledAt);
    if (Number.isNaN(dt.getTime())) return fallback;
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dt);
  }, []);

  return (
    <div className="space-y-8">
      {editingAppointment ? (
        <EditAppointmentModal
          appointment={editingAppointment as EditableAppointment}
          clinicSlug={clinicSlug}
          clinicPlan={clinic?.plan ?? "free"}
          basePath={basePath}
          formatDate={formatDateForModal}
          onSavePatient={handleSavePatient}
          onReschedule={handleReschedule}
          onClose={() => setEditingAppointment(null)}
        />
      ) : null}

      {feedback ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-[10px] px-4 py-3 text-sm font-medium shadow-lg ${
            feedback.tone === "success"
              ? "border-[1.5px] border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-[1.5px] border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <ClinicSetupBanner clinicSlug={clinicSlug} basePath={basePath} />

      <CalendarLayout
        clinicHours={clinicHours}
        appointmentsByDate={appointmentsByDate}
        selectedDate={selectedDate}
        viewMode={viewMode}
        availableViews={availableViews}
        basePath={basePath}
        onSelectedDateChange={setSelectedDate}
        onViewModeChange={setViewMode}
        onAppointmentClick={handleAppointmentClick}
        loading={loading}
        errorMessage={errorMessage}
      />
    </div>
  );
}

export default function ClinicCalendarRoute() {
  return <ClinicCalendarPage />;
}
