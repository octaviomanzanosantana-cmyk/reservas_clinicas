import "server-only";

/**
 * Helper compartido para envío de emails vía Resend.
 *
 * Firma canónica unificada del proyecto:
 *  - to siempre array (incluso para un destinatario, envuelve en array).
 *  - Orden de campos alfabético donde tiene sentido.
 *  - Mensajes de error en inglés por defecto. Si el caller quiere un
 *    mensaje contextual (p.ej. "No se pudo enviar el email de acceso"),
 *    puede pasar errorContext.
 *
 * getEmailConfig sigue viviendo en cada archivo de emails porque cada
 * uno tiene reglas distintas (lanzar vs devolver vacío, incluir appUrl
 * extra, etc.). Refactor intencional y parcial.
 */

export type SendEmailParams = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  /**
   * Contexto opcional que se prepende al mensaje de error si la
   * petición a Resend falla. Ej: "No se pudo enviar el email de acceso".
   * Si no se pasa, se usa "Email send failed".
   */
  errorContext?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const prefix = params.errorContext?.trim() || "Email send failed";
    throw new Error(`${prefix} (${response.status}): ${responseText}`);
  }
}
