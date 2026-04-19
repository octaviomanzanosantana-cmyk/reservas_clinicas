"use client";

import { ClinicBlocksSection } from "@/components/clinic/ClinicBlocksSection";
import { LogoUpload } from "@/components/clinic/LogoUpload";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import {
  isGoogleCalendarConnected,
  type GoogleCalendarStatus,
} from "@/lib/googleCalendarStatus";
import { useEffect, useState } from "react";

type ClinicResponse = {
  clinic?: {
    id?: string;
    slug?: string;
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    theme_color: string | null;
    booking_enabled?: boolean;
    notification_email: string | null;
    review_url: string | null;
    reminder_hours: number;
    offers_presencial: boolean;
    offers_online: boolean;
    logo_has_dark_bg: boolean;
    whatsapp_daily_reminders_enabled?: boolean;
  };
  error?: string;
};

type ClinicSettingsPageProps = {
  clinicSlug?: string;
};

const INPUT_CLASS =
  "mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]";

export function ClinicSettingsPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicSettingsPageProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reminderHours, setReminderHours] = useState(48);
  const [offersPresencial, setOffersPresencial] = useState(true);
  const [offersOnline, setOffersOnline] = useState(false);
  const [logoHasDarkBg, setLogoHasDarkBg] = useState(false);
  const [whatsappDailyRemindersEnabled, setWhatsappDailyRemindersEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [clinicResponse, googleResponse] = await Promise.all([
          fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`),
          fetch(`/api/google/status?clinicSlug=${encodeURIComponent(clinicSlug)}`),
        ]);
        const clinicData = (await clinicResponse.json()) as ClinicResponse;
        const googleData = (await googleResponse.json()) as GoogleCalendarStatus;

        if (!active) return;

        if (!clinicResponse.ok || !clinicData.clinic) {
          throw new Error(clinicData.error ?? "No se pudo cargar la clínica");
        }

        if (!googleResponse.ok) {
          throw new Error(googleData.error ?? "No se pudo cargar Google Calendar");
        }

        setName(clinicData.clinic.name ?? "");
        setDescription(clinicData.clinic.description ?? "");
        setAddress(clinicData.clinic.address ?? "");
        setPhone(clinicData.clinic.phone ?? "");
        setLogoUrl(clinicData.clinic.logo_url ?? "");
        setThemeColor(clinicData.clinic.theme_color ?? "");
        setNotificationEmail(clinicData.clinic.notification_email ?? "");
        setReviewUrl(clinicData.clinic.review_url ?? "");
        setReminderHours(clinicData.clinic.reminder_hours ?? 48);
        setOffersPresencial(clinicData.clinic.offers_presencial ?? true);
        setOffersOnline(clinicData.clinic.offers_online ?? false);
        setLogoHasDarkBg(clinicData.clinic.logo_has_dark_bg ?? false);
        setWhatsappDailyRemindersEnabled(clinicData.clinic.whatsapp_daily_reminders_enabled ?? false);
        setGoogleConnected(isGoogleCalendarConnected(googleData));
        setGoogleEmail(googleData.email ?? null);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la clínica");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadClinic();
    return () => { active = false; };
  }, [clinicSlug]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinics/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: clinicSlug,
          name,
          description,
          address,
          phone,
          logo_url: logoUrl,
          theme_color: themeColor,
          notification_email: notificationEmail || null,
          review_url: reviewUrl || null,
          reminder_hours: reminderHours,
          offers_presencial: offersPresencial,
          offers_online: offersOnline,
          logo_has_dark_bg: logoHasDarkBg,
          whatsapp_daily_reminders_enabled: whatsappDailyRemindersEnabled,
        }),
      });

      const data = (await response.json()) as ClinicResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar la clínica");
      }

      setMessage("Guardado correctamente");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la clínica");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicSlug }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo desconectar Google Calendar");
      }

      setGoogleConnected(false);
      setGoogleEmail(null);
      setMessage("Google Calendar desconectado");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Google Calendar",
      );
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Configuración de clínica
        </h1>
        <p className="mt-2 text-sm text-muted">Editar datos de {clinicSlug}</p>
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        {loading ? (
          <p className="text-sm text-muted">Cargando clinica...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-[14px] border-[0.5px] border-border bg-background p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Datos básicos</p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Nombre clínica</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Descripción</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={INPUT_CLASS} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Dirección</span>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLASS} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Teléfono</span>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLASS} />
                  <p className="mt-1.5 text-xs text-muted">Se muestra a los pacientes en la pagina de reservas.</p>
                </label>

                <LogoUpload
                  currentUrl={logoUrl}
                  onUploaded={(url) => setLogoUrl(url)}
                />

                <label className="flex items-center gap-3 rounded-[10px] border border-border bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={logoHasDarkBg}
                    onChange={(e) => setLogoHasDarkBg(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <span className="text-sm text-foreground">Logo con fondo corporativo</span>
                    <p className="text-xs text-muted">Activa esto si tu logo es blanco o claro y necesita fondo de color para verse.</p>
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Color corporativo</span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor || "#0E9E82"}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="h-11 w-14 rounded-[10px] border border-border bg-white p-1"
                    />
                    <input type="text" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className={INPUT_CLASS} />
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-[14px] border-[0.5px] border-border bg-background p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Notificaciones y reseñas</p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Email de notificación</span>
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="clinica@ejemplo.com"
                    className={INPUT_CLASS}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Opcional. Recibe una copia de cada confirmación de cita en este email.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Enlace de reseñas Google</span>
                  <input
                    type="url"
                    value={reviewUrl}
                    onChange={(e) => setReviewUrl(e.target.value)}
                    placeholder="https://g.page/r/..."
                    className={INPUT_CLASS}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Opcional. Se muestra al paciente tras reservar y en el email de confirmación.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">Recordatorio antes de la cita</span>
                  <select
                    value={reminderHours}
                    onChange={(e) => setReminderHours(Number(e.target.value))}
                    className={INPUT_CLASS}
                  >
                    <option value={24}>24 horas antes</option>
                    <option value={48}>48 horas antes</option>
                    <option value={72}>72 horas antes</option>
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    Cuando enviar el email de recordatorio al paciente.
                  </p>
                </label>

                <div className="rounded-[10px] border border-border bg-white p-4">
                  <p className="font-heading text-sm font-semibold text-foreground">
                    Recordatorios por WhatsApp
                  </p>
                  <label className="mt-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={whatsappDailyRemindersEnabled}
                      onChange={(e) => setWhatsappDailyRemindersEnabled(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        Enviar email diario con recordatorios
                      </span>
                      <p className="mt-1 text-xs text-muted">
                        Cada mañana a las 9:00 recibirás un email con las citas del día siguiente.
                        Cada cita incluye un botón para enviar un recordatorio por WhatsApp con un
                        solo clic. También puedes gestionarlas desde Gestión → Recordatorios en tu
                        panel.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border-[0.5px] border-border bg-background p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Modalidades de cita</p>
              <p className="mt-1 text-xs text-muted">Selecciona qué modalidades ofrece tu clínica. Si ambas están activas, el paciente podrá elegir al reservar.</p>

              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-[10px] border border-border bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={offersPresencial}
                    onChange={(e) => setOffersPresencial(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">Presencial</span>
                </label>
                <label className="flex items-center gap-3 rounded-[10px] border border-border bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={offersOnline}
                    onChange={(e) => setOffersOnline(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">Online</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
      </section>

      <ClinicBlocksSection clinicSlug={clinicSlug} />

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Google Calendar</h2>
            <p className="mt-2 text-sm text-muted">
              {googleConnected
                ? `Conectado${googleEmail ? ` como ${googleEmail}` : ""}.`
                : "No conectado."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!googleConnected ? (
              <a
                href={`/api/google/connect?clinicSlug=${encodeURIComponent(clinicSlug)}`}
                className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
              >
                Conectar Google Calendar
              </a>
            ) : null}

            {googleConnected ? (
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={disconnectingGoogle}
                className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnectingGoogle ? "Desconectando..." : "Desconectar"}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ClinicSettingsRoute() {
  return <ClinicSettingsPage />;
}
