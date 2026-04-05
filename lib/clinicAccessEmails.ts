import "server-only";

import { wrapEmailHtml } from "@/lib/emailLayout";

type SendClinicAccessRecoveryEmailInput = {
  to: string;
  clinicName: string;
  resetLink: string;
};

function getEmailConfig() {
  const apiKey = process.env.EMAIL_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";

  if (!apiKey || !from) {
    throw new Error("Missing email configuration for clinic access");
  }

  return { apiKey, from };
}

export async function sendClinicAccessRecoveryEmail(
  input: SendClinicAccessRecoveryEmailInput,
): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const to = input.to.trim().toLowerCase();

  if (!to) {
    throw new Error("Missing destination email for clinic access");
  }

  const subject = `Acceso a ${input.clinicName}`;
  const text = [
    `Hola,`,
    "",
    `Ya tienes acceso a ${input.clinicName}.`,
    "Usa este enlace para establecer o cambiar tu contrasena:",
    input.resetLink,
    "",
    "Si no esperabas este correo, puedes ignorarlo.",
  ].join("\n");

  const html = wrapEmailHtml(`
    <p style="margin:0 0 8px">Hola,</p>
    <p style="margin:0 0 24px;color:#374151">
      Ya tienes acceso a <strong>${input.clinicName}</strong>.
      Usa el enlace de abajo para establecer tu contraseña.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="border-radius:8px;background-color:#0E9E82;">
          <a href="${input.resetLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
            Configurar contraseña
          </a>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#6B7280;margin:0">
      Si no esperabas este correo, puedes ignorarlo.
    </p>
  `);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `No se pudo enviar el email de acceso (${response.status}): ${responseText}`,
    );
  }
}
