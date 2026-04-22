import { getAdminUser } from "@/lib/adminAuth";
import { NextResponse } from "next/server";

function verifyAdmin(
  request: Request,
  admin: { id: string; email: string } | null,
): boolean {
  if (admin) return true;
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret && secret === process.env.ADMIN_API_SECRET?.trim());
}

/**
 * Sanitiza un mensaje para la respuesta JSON pública:
 *  - reemplaza cualquier token que parezca email por "[email]"
 *  - trunca a 200 chars
 */
function sanitizeErrorForResponse(msg: string): string {
  const scrubbed = msg.replace(/\S+@\S+\.\S+/g, "[email]");
  return scrubbed.length > 200 ? scrubbed.slice(0, 200) : scrubbed;
}

/**
 * POST /api/admin/run-daily-lifecycle
 *
 * Trigger manual (desde el panel admin) del cron de ciclo de vida de trials.
 * Reenvía la request al endpoint cron interno con CRON_SECRET en la auth
 * header, y devuelve la respuesta del cron tal cual al cliente.
 *
 * Auth dual (patrón común de /api/admin/*): sesión admin vía getAdminUser()
 * o fallback con header x-admin-secret == ADMIN_API_SECRET.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!verifyAdmin(request, admin)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.APP_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "https://app.appoclick.com";
  const cronUrl = `${baseUrl}/api/cron/daily-lifecycle`;

  try {
    const cronResponse = await fetch(cronUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    });

    const rawText = await cronResponse.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch {
      console.error("[run-daily-lifecycle] non-JSON response from cron", {
        status: cronResponse.status,
        body: rawText.slice(0, 500),
      });
      return NextResponse.json(
        {
          error: `Failed to execute cron: non-JSON response (${cronResponse.status})`,
        },
        { status: 500 },
      );
    }

    // Spec: devolver el JSON tal cual con status 200, independientemente del
    // status del cron. El cliente decide si hay `error` en el payload.
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const fullMsg = err instanceof Error ? err.message : String(err);
    console.error("[run-daily-lifecycle] fetch failed", { error: fullMsg });
    return NextResponse.json(
      {
        error: `Failed to execute cron: ${sanitizeErrorForResponse(fullMsg)}`,
      },
      { status: 500 },
    );
  }
}
