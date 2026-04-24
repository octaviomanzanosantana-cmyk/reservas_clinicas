import "server-only";

import { wrapEmailHtml } from "@/lib/emailLayout";
import { sendEmail } from "./sendEmail";

type SendSignupConfirmationEmailParams = {
  to: string;
  confirmUrl: string;
  clinicName: string;
};

function getEmailConfig() {
  return {
    apiKey: process.env.EMAIL_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(params: SendSignupConfirmationEmailParams): string {
  const safeClinic = escapeHtml(params.clinicName);
  const safeUrl = escapeHtml(params.confirmUrl);

  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
      Confirma tu email y empieza con ${safeClinic}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#1A1A1A;line-height:1.7;">
      Bienvenido a AppoClick. Para activar tu panel y empezar a recibir reservas, confirma tu
      email pulsando el botón:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#0E9E82;border-radius:10px;">
          <a href="${safeUrl}"
             style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
            Confirmar mi email
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 10px;font-size:13px;color:#6B7280;">
      Si el botón no funciona, copia este enlace en tu navegador:
    </p>
    <p style="margin:0 0 28px;font-size:13px;word-break:break-all;">
      <a href="${safeUrl}" style="color:#0E9E82;text-decoration:underline;">${safeUrl}</a>
    </p>
    <div style="padding-top:20px;border-top:1px solid #E5E7EB;">
      <p style="margin:0 0 10px;font-size:13px;color:#6B7280;line-height:1.6;">
        El enlace expira en 24 horas. Si expira, entra a tu panel y reenvía el email desde ahí.
      </p>
      <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
        ¿No creaste esta cuenta? Ignora este email — no se activará nada sin tu confirmación.
      </p>
    </div>
  `;

  return wrapEmailHtml(body);
}

function buildText(params: SendSignupConfirmationEmailParams): string {
  return [
    `Confirma tu email y empieza con ${params.clinicName}`,
    "",
    "Bienvenido a AppoClick. Para activar tu panel, confirma tu email visitando:",
    "",
    params.confirmUrl,
    "",
    "El enlace expira en 24 horas.",
    "Si no creaste esta cuenta, ignora este email.",
    "",
    "— AppoClick",
  ].join("\n");
}

export async function sendSignupConfirmationEmail(
  params: SendSignupConfirmationEmailParams,
): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  await sendEmail({
    apiKey,
    from,
    to: [params.to],
    subject: `Confirma tu email — ${params.clinicName}`,
    html: buildHtml(params),
    text: buildText(params),
  });
}
