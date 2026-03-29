import "server-only";

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

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hola,</p>
      <p>Ya tienes acceso a <strong>${input.clinicName}</strong>.</p>
      <p>Usa este enlace para establecer o cambiar tu contrasena:</p>
      <p><a href="${input.resetLink}">Configurar contrasena</a></p>
      <p>Si no esperabas este correo, puedes ignorarlo.</p>
    </div>
  `.trim();

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
