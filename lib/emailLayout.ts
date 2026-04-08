import "server-only";

/**
 * Envuelve el contenido HTML de un email con el layout de marca Appoclick:
 * - Header teal con wordmark en blanco
 * - Cuerpo sobre fondo gris claro
 * - Footer con copyright
 *
 * Compatible con los principales clientes de email (tabla-based, inline styles).
 */
export function wrapEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header teal con check + wordmark -->
          <tr>
            <td align="center" style="background-color:#0E9E82;border-radius:12px 12px 0 0;height:80px;padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
                <td style="vertical-align:middle;padding-right:12px">
                  <div style="width:40px;height:40px;border-radius:50%;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:40px">
                    <svg viewBox="0 0 30 30" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M8 15.5L12.5 20L22 10" stroke="#0E9E82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                </td>
                <td style="vertical-align:middle">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">AppoClick</span>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1A1A1A;line-height:1.7;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} Appoclick · Gestión de citas para clínicas
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
