---
versión: v1.4
periodo: Abril 2026 → Mayo 2026
archivado: 2026-05-11
sustituido por: v1.5
motivo: bump tras audit sprints 1-7.6, añade Google LLC subencargado + 7 medidas seguridad + 3 datos tratados + 1 clarificación WhatsApp
origen: snapshot inmutable extraído de app/dpa/page.tsx tal y como estaba antes del bump v1.5 (commit b476ef9 incluyó la propuesta; commit del bump aplicará v1.5)
fuente: app/dpa/page.tsx @ b476ef9
---

# Contrato de Encargo de Tratamiento (DPA)

**Versión 1.4 · Abril 2026**

**Encargado:** ANALÓGICAMENTE DIGITALES, SOCIEDAD LIMITADA (AppoClick)
NIF: B76357201 · Calle Fresno, 2 · 35200 Telde · Las Palmas
Email: hola@appoclick.com

---

## 1. Objeto

El presente contrato regula las condiciones en las que AppoClick, como **Encargado del Tratamiento**, trata datos personales de los pacientes en nombre de la clínica (**Responsable del Tratamiento**), conforme al artículo 28 del RGPD y la LOPDGDD.

## 2. Datos tratados

- **Categorías de interesados:** pacientes de la clínica
- **Tipos de datos:** nombre, email, teléfono, fecha/hora de cita, tipo de consulta, modalidad (presencial/online)
- **No se tratan:** historiales médicos, diagnósticos, datos clínicos ni contenido sanitario

## 3. Obligaciones de AppoClick

- Tratar los datos únicamente según las instrucciones documentadas del Responsable
- No utilizar los datos para fines propios ni cederlos a terceros
- Garantizar que las personas autorizadas para tratar datos se han comprometido a respetar la confidencialidad
- Implementar medidas técnicas y organizativas adecuadas (Art. 32 RGPD)
- Asistir al Responsable en el cumplimiento de sus obligaciones RGPD (derechos de los interesados, notificación de brechas, evaluaciones de impacto)
- Suprimir o devolver los datos al término del contrato, salvo obligación legal de conservación
- Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento

## 4. Subencargados

AppoClick utiliza los siguientes subencargados del tratamiento, con los que mantiene contratos equivalentes al presente DPA:

| Proveedor      | Función                                              | Ubicación         |
|----------------|------------------------------------------------------|-------------------|
| Supabase Inc.  | Base de datos y autenticación                        | UE (Frankfurt)    |
| Vercel Inc.    | Infraestructura y hosting                            | UE / EE.UU. (DPF) |
| Resend Inc.    | Envío de emails transaccionales                      | EE.UU. (DPF)      |
| Stripe Inc.    | Procesamiento de pagos (solo datos de clínicas)      | UE / EE.UU. (DPF) |

El Responsable autoriza al Encargado a contratar nuevos subencargados, previa notificación. El Responsable puede oponerse en un plazo de 15 días.

## 5. Transferencias internacionales

Las transferencias a países fuera del EEE se realizan exclusivamente con garantías adecuadas: Cláusulas Contractuales Tipo de la Comisión Europea o Data Privacy Framework UE-EE.UU.

## 6. Medidas de seguridad

- Cifrado HTTPS/TLS en todas las comunicaciones
- Separación de datos por clínica (Row-Level Security)
- Autenticación segura con 2FA obligatorio
- Tokens únicos con caducidad por cita
- Rate limiting en login (protección fuerza bruta)
- Backups automáticos cifrados
- Notificación de brechas a la AEPD en menos de 72 horas

## 7. Obligaciones de la clínica

- Garantizar la base legal para el tratamiento de datos de pacientes
- Informar a los pacientes sobre el tratamiento de sus datos
- Atender los derechos ARCO de los pacientes (acceso, rectificación, supresión, portabilidad)
- No introducir datos especialmente protegidos (origen étnico, salud detallada, orientación sexual) en los campos de texto libre de AppoClick

**Gestión de solicitudes de supresión (derecho al olvido):** el sistema identifica a los pacientes por dirección de email. Si un mismo paciente ha realizado reservas utilizando emails distintos, la clínica deberá eliminar sus datos de forma separada para cada email utilizado, desde el panel Pacientes. La identificación de todos los emails asociados a un paciente es responsabilidad de la clínica como Responsable del Tratamiento.

## 8. Duración y resolución

Este contrato tiene la misma duración que la relación de servicio entre AppoClick y la clínica. Al finalizar, AppoClick suprimirá los datos en un plazo máximo de 30 días, salvo obligación legal de conservación. La clínica puede solicitar una copia de los datos antes de la supresión.

## 9. Responsabilidad

Cada parte responderá de los daños causados por el incumplimiento de sus obligaciones conforme al RGPD. AppoClick responde por los daños derivados del tratamiento si ha actuado al margen de las instrucciones del Responsable o incumpliendo sus obligaciones como Encargado.

## 10. Legislación aplicable

Este contrato se rige por el Reglamento General de Protección de Datos (RGPD), la Ley Orgánica 3/2018 de Protección de Datos (LOPDGDD) y la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de Las Palmas de Gran Canaria.

Autoridad de control competente: Agencia Española de Protección de Datos (AEPD) — www.aepd.es

---

AppoClick · ANALÓGICAMENTE DIGITALES, S.L. · B76357201 · hola@appoclick.com
