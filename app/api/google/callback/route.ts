import { getClinicById } from "@/lib/clinics";
import { completeGoogleCalendarOAuth, parseGoogleOAuthState } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state")?.trim();

  if (!code) {
    return new NextResponse("Falta el parámetro code", { status: 400 });
  }

  if (!state) {
    return new NextResponse("Falta el parámetro state", { status: 400 });
  }

  try {
    const clinicId = parseGoogleOAuthState(state);
    const clinic = await getClinicById(clinicId);

    if (!clinic) {
      return new NextResponse("Clínica no encontrada", { status: 404 });
    }

    await completeGoogleCalendarOAuth(code, clinicId);
    const settingsHref = `/clinic/${clinic.slug}/settings?google=connected`;
    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Google Calendar conectado</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
            .card { max-width: 520px; margin: 40px auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: white; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
            a { display: inline-block; margin-top: 12px; color: #2563eb; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Google Calendar conectado</h1>
            <p>Ya puedes volver a configuración para crear citas con evento automático.</p>
            <a href="${settingsHref}">Volver a configuración</a>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "No se pudo completar la autorización",
      { status: 500 },
    );
  }
}
