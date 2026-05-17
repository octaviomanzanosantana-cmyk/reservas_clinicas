# Plan de respuesta a incidentes — Appoclick

**Vigencia:** Sprint 8 soft launch (19-25 mayo 2026) y siguientes
**Última actualización:** 17 mayo 2026
**Responsable:** Octavio Manzano Santana

---

## 0. Cómo usar este documento

En medio de un incidente la cognición es escasa. Este documento está pensado para abrirse, encontrar el escenario, ejecutar el procedimiento y comunicar — sin tener que pensar.

**Si estás en pánico, lee solo esto:**

1. ¿Hay clientes afectados ahora mismo? Sí → severidad **S1**. No → respira, sigue leyendo
2. Mira la **sección 3** y localiza el escenario que más se parece a lo que ves
3. Ejecuta los pasos en orden, NO los saltes
4. Comunica con el template de la **sección 6** mientras investigas

**No improvises bajo presión.** Si el escenario no encaja con ninguno, ve a la sección 4 (escalado a Antonio).

---

## 1. Señales de incidente

Detecta antes de que un cliente reporte. Revisa estas fuentes en este orden:

| Frecuencia | Fuente | Qué mirar |
|---|---|---|
| 1× al día (mañana) | Vercel → Deployments → último deploy | Que esté en "Ready" verde |
| 1× al día (mañana) | Stripe Dashboard LIVE → Developers → Webhooks | % errores > 0% en últimas 24h |
| 1× al día (mañana) | Supabase → Logs | Errores 5xx o spikes anómalos |
| Si recibes email | Stripe alertas | Subject "[Stripe] Action required" |
| Si recibes email | Vercel alertas | Subject "Deployment failed" o "Function errors" |
| Si recibes email | Resend dashboard | Bounce rate > 5% |

**Señales fuertes de incidente activo:**
- Cliente envía email a `hola@appoclick.com` reportando algo roto
- Vercel muestra deployment failed en `main`
- Stripe webhook muestra >0% errores con tendencia subiendo
- `app.appoclick.com` no carga (probar desde móvil con datos, no wifi)

---

## 2. Clasificación de severidad

| Severidad | Definición | Tiempo respuesta | Comunicación cliente |
|---|---|---|---|
| **S1 Crítico** | Producción caída, clientes no pueden usar app o cobros bloqueados | Inmediato (< 15 min) | Sí, proactiva |
| **S2 Alto** | Funcionalidad importante rota (cobros aislados, emails no llegan, partes del panel) | < 2h | Sí, al cliente afectado |
| **S3 Medio** | Bug aislado o degradación menor, workaround disponible | < 24h | Solo si pregunta |
| **S4 Bajo** | Cosmético, edge case raro, mejora | Próximo sprint | No |

**Regla de oro:** ante duda, sube de severidad. Es peor minimizar un S1 que tratar un S3 como S2.

---

## 3. Procedimientos por escenario

### C1 · Webhook Stripe falla o no responde

**Síntomas:**
- Stripe Dashboard → Webhooks muestra % errores creciente
- Clientes pagan pero su estado en Appoclick no se actualiza
- Tabla `stripe_events_processed` deja de crecer en BD

**Diagnóstico (5 min):**

1. Stripe Dashboard LIVE → Developers → Webhooks → click en endpoint `we_1TJN39AL0qP42ZSxAOiVmfBO`
2. Ver últimos intentos fallidos: pestaña "Event deliveries"
3. Anotar:
   - Código HTTP devuelto (4xx, 5xx, timeout)
   - Cuerpo de la respuesta (suele dar pista del error)
   - Tipo de evento que falla (¿solo uno o varios?)
4. Vercel → Logs → filtrar por `/api/stripe/webhook`. Buscar el timestamp del último fallo y leer stacktrace

**Acción según diagnóstico:**

| Código | Causa probable | Acción |
|---|---|---|
| 401/403 | Firma webhook secret incorrecta | Verificar `STRIPE_WEBHOOK_SECRET_LIVE` en Vercel. Si cambió Stripe lo, rotar |
| 500 + stacktrace BD | Supabase caído o RLS bloqueando | Ir a escenario **C3** |
| 500 + error TypeError | Bug en handler | Capturar logs, escalar a Antonio si crítico |
| Timeout 30s | Handler tarda mucho, lambda Vercel reventando | Hot-fix: simplificar handler o mover lógica a async |
| 410 Gone | URL webhook desconfigurada | Verificar URL endpoint sigue siendo `https://app.appoclick.com/api/stripe/webhook` |

**Contención mientras se arregla:**

- Stripe reintentará automáticamente los eventos fallidos hasta 3 días (configuración por defecto). Por tanto el flujo se "auto-recupera" cuando el bug se arregle
- NO desactivar el endpoint webhook salvo emergencia: si lo desactivas, los reintentos se pierden permanentemente
- Si el bug es muy específico (ej: solo falla `invoice.payment_failed`), comunicar a clientes afectados manualmente

---

### C2 · Stripe API caído

**Síntomas:**
- Clientes no pueden añadir método de pago (form de Stripe no carga)
- Customer Portal devuelve error
- Cobros automáticos no se ejecutan

**Diagnóstico:**

1. Comprobar https://status.stripe.com (debería estar como bookmark)
2. Si Stripe lo confirma como incidente → **no hay nada que hacer en Appoclick**. Esperar
3. Si Stripe dice "operational" pero ves errores → es problema nuestro de credenciales/config

**Acción:**

- Si es Stripe global: comunicar a clientes que pidan ayuda con un template "estamos al tanto, dependemos de Stripe, te avisamos cuando se restablezca"
- Reagendar cualquier acción que requiera Stripe (no insistir, multiplicaría carga sobre Stripe)
- Si dura > 30 min, monitorear y avisar de progreso cada hora

---

### C3 · Supabase caído

**Síntomas:**
- App.appoclick.com carga pero login devuelve 500
- Panel queda en estado de carga eterna
- Webhook Stripe falla con error de conexión BD

**Diagnóstico:**

1. Comprobar https://status.supabase.com
2. Supabase Dashboard → Settings → Database → ver métricas de conexión
3. Si todo verde en status pero falla → revisar logs Supabase por errores específicos

**Acción:**

- Si Supabase global: esperar, no hay nada que hacer
- Si es nuestro proyecto: verificar pool de conexiones agotado (Supabase tiene límite)
- Si crítico: contactar soporte Supabase desde Dashboard (Pro plan tiene chat)

**Riesgo conocido:** la BD es compartida entre dev y prod (deuda técnica pendiente sprint dedicado post-cutover). Si algo en dev satura conexiones, afecta a prod. Si pasa, identificar y matar la conexión problemática.

---

### C4 · Vercel caído o deployment failed

**Síntomas:**
- `app.appoclick.com` devuelve 500/502/503 desde todos los dispositivos
- Vercel dashboard muestra último deploy con estado "Error"

**Diagnóstico:**

1. https://www.vercel-status.com
2. Vercel Dashboard → Deployments → ver estado del último deploy
3. Si deploy falló: leer build logs

**Acción:**

| Caso | Acción |
|---|---|
| Vercel global down | Esperar, no hay alternativa inmediata |
| Build falló (TypeScript error, etc.) | Rollback a deploy anterior funcional desde Vercel UI |
| Build OK pero runtime error | Logs Vercel → identificar función que rompe |
| Lambda timeouts masivos | Revisar si hay loop infinito o llamada externa lenta |

**Rollback inmediato Vercel (1 minuto):**

1. Vercel Dashboard → Deployments
2. Localizar el último deploy que estaba "Ready" verde (anterior al malo)
3. Click en `...` → "Promote to Production"
4. Verificar `app.appoclick.com` vuelve a cargar

---

### C5 · Cobro fallido masivo (varios clientes a la vez)

**Síntomas:**
- Varios eventos `invoice.payment_failed` en Stripe Dashboard en corto periodo
- Múltiples clínicas en estado `past_due`

**Diagnóstico:**

1. Stripe Dashboard LIVE → Billing → Invoices → filtrar por estado "Past due" últimas 24h
2. ¿Es 1-2 clientes (probablemente tarjeta caducada del cliente) o 5+ (problema sistémico)?
3. Si sistémico: revisar si hubo cambio reciente en config Stripe (precios, tax, etc.)

**Acción:**

- 1-2 clientes: Stripe ya gestiona reintentos automáticos durante 3 semanas. Email auto enviado al cliente para actualizar método. Esperar.
- 5+ clientes: incidente real. Verificar config Stripe vs lo que esperaba el código. Posiblemente:
  - Cambio accidental de price ID
  - Cambio accidental de tax_behavior
  - Bug introducido en último deploy

---

### C6 · Email Resend no llega

**Síntomas:**
- Cliente reporta no recibir email de confirmación, factura, o aviso
- Resend dashboard muestra estado "delivered" pero cliente no ve nada

**Diagnóstico:**

1. Resend Dashboard → Emails → buscar por email destinatario
2. Estado del email:
   - "delivered" → llegó al servidor del cliente, problema es del cliente (spam, filtros)
   - "bounced" → email rechazado, dirección inválida
   - "failed" → error en envío, problema nuestro
   - "queued" más de 5 min → problema en Resend

**Acción:**

| Estado | Acción |
|---|---|
| delivered | Pedir cliente que mire spam/promociones. Pedir que añada `citas@appoclick.com` a contactos |
| bounced | Email inválido. Pedir corrección. NO reenviar sin cambiar dirección |
| failed | Revisar logs Resend para causa. Posible límite de envío o config DNS |
| queued > 5 min | Status Resend (https://resend-status.com). Si OK, escalar |

---

### C7 · Cliente reporta cobro duplicado o erróneo

**ESCENARIO DELICADO. Cuidado especial.**

**Síntomas:**
- Cliente dice "me habéis cobrado dos veces"
- Cliente dice "me cobraron el doble"
- Cliente dice "no debería haber pagado, había cancelado"

**Diagnóstico (NO contestes aún, primero verifica):**

1. Stripe Dashboard LIVE → Customers → buscar por email del cliente
2. Ver historial de invoices y payment intents del cliente
3. Comparar con BD: `SELECT * FROM invoices WHERE clinic_id = (SELECT id FROM clinics WHERE [email del cliente])`

**Tres casos posibles:**

| Realidad | Acción |
|---|---|
| Cliente tiene razón, hay cobro duplicado | Refund inmediato desde Stripe Dashboard + email disculpa con template |
| Cliente confunde algo (ej: ve el preauth de la tarjeta como cobro) | Explicar con template "tu cobro es correcto, lo que ves es..." |
| Es un caso ambiguo o complejo | NO improvisar. Email de espera con template + escalar a Antonio |

**NUNCA prometer refund antes de verificar.** Si verificas y procede, hazlo en el momento.

---

### C8 · Rollback STRIPE_MODE live → test

**Decisión más delicada del documento.** Hacer rollback de LIVE a TEST significa:
- Stripe TEST no procesa cobros reales
- Clientes nuevos en signup quedan en limbo (intentarán pagar contra TEST)
- Clientes existentes en LIVE conservan su sub en Stripe LIVE pero la app deja de procesarlos

**Solo hacer rollback si:**
- Bug catastrófico que afecta a TODOS los cobros nuevos
- No identificable la causa en < 30 min
- Imposible hot-fix rápido

**Procedimiento:**

1. Vercel → Settings → Environment Variables
2. Editar `STRIPE_MODE` → cambiar valor de `live` a `test`
3. **CRÍTICO:** Redeploy obligatorio. Vercel no recoge cambios de env vars sin redeploy. Ir a Deployments → último → `...` → "Redeploy"
4. Verificar deploy en estado "Ready" verde
5. Smoke test:
   - `GET https://app.appoclick.com/api/stripe/webhook` debe devolver 405
   - Login al panel admin debe funcionar
6. Comunicar a clientes con sub LIVE activos: "estamos en mantenimiento, vuestras suscripciones siguen seguras en Stripe, no hay acción que tomar"

**Tras rollback:**
- Identificar bug en TEST sin presión
- No flippear de vuelta a LIVE hasta tener fix validado
- Comunicación clara con clientes sobre cuándo volveremos

---

## 4. Escalado a Antonio Peñate (AQIA)

**Contacto:**
- Email: `soporte@aqia.es`
- Teléfono: `+34 699 33 84 34`

**Cuándo escalar:**
- S1 que no resuelvas en < 30 min
- Caída de infraestructura que no sabes diagnosticar
- Sospecha de hackeo o brecha de seguridad
- Después de horas (22:00-08:00) y es S1 real

**Cómo escalar (template):**

> Hola Antonio, incidente S[1/2] en Appoclick. [Una línea de qué pasa].
> Síntomas: [...]
> Diagnóstico hecho: [...]
> Necesito tu ayuda con: [...]
> Logs/captura: [adjuntar o linkar]

**No enviar fotos confusas o info parcial.** Antonio necesita contexto compacto para actuar rápido.

---

## 5. Contactos críticos

| Rol | Persona | Canal | Cuándo |
|---|---|---|---|
| Soporte técnico respaldo | Antonio Peñate (AQIA) | soporte@aqia.es / +34 699 33 84 34 | S1 sin resolución 30 min |
| Asesoría fiscal | Davinia (BiPlaza) | [email Davinia] | Error fiscal en factura |
| Soporte Stripe | Stripe Dashboard → Help → Chat | Chat | Bug específico Stripe |
| Soporte Vercel | Vercel Dashboard → Help (Pro plan) | Chat / email | Issue Vercel infrastructure |
| Soporte Supabase | Supabase Dashboard → Help (Pro plan) | Chat | Issue BD |
| Soporte Resend | https://resend.com/support | Email | Issue emails |

**TODO post-cutover:** rellenar email Davinia, verificar nivel de plan Vercel/Supabase y SLAs.

---

## 6. Comunicación con clientes

### Template A · Acuse de recibo (uso inmediato al recibir reporte)

```
Hola [Nombre],

Gracias por avisar. He recibido tu mensaje y estoy revisando 
ahora mismo lo que comentas sobre [problema breve].

Te respondo con detalles en cuanto tenga el diagnóstico, 
máximo en [tiempo razonable: 30 min / 2h / hoy mismo].

Disculpa las molestias.

Octavio
Equipo Appoclick
```

**Cuándo usar:** siempre, en cuanto recibes el primer email del cliente. Antes de investigar nada.

---

### Template B · Resuelto, explicación

```
Hola [Nombre],

Ya está resuelto.

Lo que ha pasado: [explicación honesta y breve, máximo 3 líneas]
Lo que he hecho: [acción tomada]
Lo que puedes hacer ahora: [si aplica]

Si vuelves a ver algo raro, escríbeme directamente y miro 
al momento.

Gracias por la paciencia.

Octavio
Equipo Appoclick
```

**Reglas:**
- No echar culpa a "el sistema". Asume responsabilidad del equipo (aunque seas tú solo)
- Honesto pero no técnico. "Hubo un problema con los emails que ya está arreglado", no "el webhook de Stripe estaba devolviendo 500 por culpa del RLS"
- No prometer que no vuelva a pasar. Sí prometer que estarás atento

---

### Template C · No es nuestro problema, pero ayudamos

```
Hola [Nombre],

He revisado lo que mencionas y veo que [diagnóstico que no es 
Appoclick: cliente vacía spam, banco rechaza tarjeta, etc.].

Para resolverlo:
1. [paso 1]
2. [paso 2]
3. [paso 3]

Si haciendo esto no se arregla, escríbeme de nuevo y miro 
desde nuestro lado por si hay algo que se me escapa.

Octavio
Equipo Appoclick
```

**Cuándo usar:** cuando verificas y el problema no está en Appoclick. NO usar nunca como salida fácil sin verificar primero — el cliente nota la diferencia.

---

### Template D · Incidente en curso, varios clientes

```
Hola,

Estamos detectando un problema en [funcionalidad] que afecta 
a algunos clientes desde [hora]. 

Estamos trabajando en solucionarlo y esperamos restaurar 
el servicio en [estimación honesta].

Vuestros datos y suscripciones están seguros. No hay 
acción que necesitéis tomar.

Os escribiré de nuevo cuando esté resuelto.

Octavio
Equipo Appoclick
```

**Cuándo usar:** S1 que afecta a varios clientes. Enviar proactivamente. Mejor decirlo tú que se lo digan unos a otros.

---

## 7. Disponibilidad

**Soft launch 19-25 mayo 2026:** Octavio disponible toda la franja, todos los días.

**Post-soft-launch:** evaluar disponibilidad realista una vez vista la carga.

**Si Octavio no disponible (vacaciones, enfermedad):**
- Antonio Peñate cubre S1 técnicos
- Auto-responder en `hola@appoclick.com` indicando tiempo de respuesta extendido
- Stripe / Vercel / Supabase mantienen su disponibilidad 24/7 desde sus dashboards

---

## 8. Post-incidente

Tras cada S1 o S2 resuelto, documentar en `docs/incidents/`:

```
docs/incidents/2026-MM-DD-breve-descripcion.md

- Fecha y hora inicio
- Fecha y hora resolución
- Síntomas
- Causa raíz
- Acción tomada
- Cómo prevenir en el futuro
- Tickets/issues abiertos para hardening
```

Esto NO es burocracia: es cómo Appoclick aprende. Cada incidente bien documentado evita el siguiente.

---

**Fin del documento · v1.0 · 17 mayo 2026**
