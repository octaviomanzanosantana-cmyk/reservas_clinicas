# SPRINT 1 — Stripe LIVE setup (sin flip)

**Owner:** Octavio
**Fecha:** 2026-04-28
**Cutover previsto:** 26 may - 1 jun 2026
**Objetivo del sprint:** dejar la infraestructura LIVE preparada para que el día del flip baste con cambiar `STRIPE_MODE=test` → `STRIPE_MODE=live` en Vercel.

> **Importante:** durante este sprint **NO se hace flip**. `STRIPE_MODE` permanece en `test`. Toda la actividad en LIVE se limita a configurar dashboard y env vars; ningún tráfico real va contra LIVE hasta el cutover.

---

## 1. Stripe Dashboard LIVE — Producto y precios a crear

### 1.1 Crear producto "Appoclick Starter"

1. Acceder a Stripe Dashboard en **modo LIVE** (toggle arriba-izquierda).
2. **Products** → **+ Add product**.
3. Rellenar:
   - **Name:** `Appoclick Starter`
   - **Description:** `Plan Starter de Appoclick: gestión de citas, recordatorios automáticos y panel de clínica.`
   - **Image:** (opcional, omitir en este sprint)
   - **Statement descriptor:** `APPOCLICK` (9 chars). Aparece en extractos bancarios — identifica solo la marca, no el plan. Razón: si mañana añadimos Pro, "APPOCLICK STARTER" sería incorrecto para esos clientes y los extractos antiguos no se actualizan retroactivamente. El plan ya queda identificado en la factura Holded. Si en el futuro quisiéramos sufijo dinámico tipo `APPOCLICK* STARTER`, Stripe lo soporta vía `statement_descriptor_suffix` por charge. **Modificable en cualquier momento** desde Stripe Dashboard → Settings → Public details.
   - **Tax behavior:** `Exclusive`. Los precios mostrados son **sin impuestos**. Stripe Checkout calcula y muestra IGIC/IVA según los datos fiscales del cliente al confirmar el cobro. La lógica fiscal final (`tax_regime`, mención ISP en factura) la gestiona nuestro código y Holded — Stripe Tax NO se usa. Régimen confirmado por asesoría externa (Davinia Arteaga, BiPlaza/Marrero Asesores): ISP para empresas/autónomos peninsulares y UE; IGIC 7% para Canarias; IVA 21% solo para particular consumidor final peninsular.

> No marcar "Stripe Tax" — usamos `tax_regime` propio. Confirmado en `app/api/stripe/webhook/route.ts:337`.

### 1.2 Precio mensual — €19/mes EUR recurrente

Dentro del producto recién creado, sección **Pricing** → **+ Add another price**:

- **Pricing model:** `Standard pricing`
- **Price:** `19.00`
- **Currency:** `EUR — Euro`
- **Type:** `Recurring`
- **Billing period:** `Monthly`
- **Usage type:** `Licensed` (por defecto)
- **Price description (interno):** `Starter mensual`
- Click **Add price**.

**Anotar:** copiar el `price_id` resultante (formato `price_1...`) → guardar como **`STRIPE_PRICE_STARTER_MONTHLY_LIVE`** (lo necesitas en sección 3).

### 1.3 Precio anual — €190/año EUR recurrente

Repetir **+ Add another price** dentro del mismo producto:

- **Pricing model:** `Standard pricing`
- **Price:** `190.00`
- **Currency:** `EUR — Euro`
- **Type:** `Recurring`
- **Billing period:** `Yearly`
- **Price description (interno):** `Starter anual`
- Click **Add price**.

**Anotar:** copiar el `price_id` resultante → guardar como **`STRIPE_PRICE_STARTER_YEARLY_LIVE`**.

> **NO crear Pro en LIVE.** El producto Pro está archivado en LIVE y no existe en TEST por decisión explícita. Cualquier intento de comprar Pro hoy devuelve `undefined` en `PLAN_PRICES.pro` (`lib/stripe.ts:96-99`), lo cual es correcto: Pro no es comprable hasta activar la lista de espera.

> ⚠️ **IMPORTANTE — Comunicación de precio en landing/UI:** la decisión final es mostrar **`€19/mes` SIN asteriscos ni notas**. Stripe Checkout (modo `Exclusive`) muestra el desglose fiscal al cliente automáticamente al confirmar el cobro. Esta decisión se aplica en **Sprint 1.5** (NUEVO en plan, 1-2h). Aquí en Sprint 1 solo configuramos Stripe LIVE con `Exclusive`; la limpieza de cualquier disclaimer existente en landing/UI/emails va en Sprint 1.5.

---

## 2. Stripe Dashboard LIVE — Webhook a configurar

### 2.1 Crear el endpoint

En LIVE: **Developers** → **Webhooks** → **+ Add endpoint**.

- **Endpoint URL:** `https://app.appoclick.com/api/stripe/webhook`
- **Description:** `Webhook producción Appoclick — handlers de subscriptions, invoices y checkout sessions`
- **Events to send:** seleccionar los 7 eventos de la tabla 2.2 (uno a uno con el selector "+ Select events").
- **API version:** dejar el default del workspace LIVE (ya alineado con `2026-03-25.dahlia` que usa el SDK — `lib/stripe.ts:40`). Si Stripe sugiere otra, aceptar el default — la firma se valida igualmente.
- Click **Add endpoint**.

### 2.2 Eventos a habilitar (exactamente 7)

| # | Evento | Tipo | Justificación |
|---|---|---|---|
| 1 | `customer.subscription.created` | Real | Sincroniza creación de suscripción → `clinics.subscription_status`, `plan`, `plan_expires_at`, `trial_ends_at`. |
| 2 | `customer.subscription.updated` | Real | Refleja cambios de plan, fin de trial, `cancel_at_period_end` → estado interno de la clínica. |
| 3 | `customer.subscription.deleted` | Real | Downgrade a `free` cuando Stripe cancela definitivamente la suscripción. |
| 4 | `invoice.payment_succeeded` | Real | Promueve `past_due → active`, escribe fila en `invoices` con `tax_regime`, envía email "Cobro procesado". |
| 5 | `invoice.payment_failed` | Real | Marca `subscription_status='past_due'`, envía email "No hemos podido cobrar". |
| 6 | `checkout.session.completed` | Real | (mode=setup) Crea la Subscription en Stripe tras añadir tarjeta, persiste `stripe_subscription_id`, envía email "Tarjeta añadida". |
| 7 | `setup_intent.succeeded` | **Defensivo** | No procesa; solo `console.info`. Está aquí por **defensa en profundidad**: handler ya existe, reclama idempotencia, coste cero, prepara terreno para un futuro handler real y da visibilidad operativa en logs. **Documentar como "no procesa, red de seguridad".** |

> **NO añadir** `customer.subscription.trial_will_end`, `invoice.created`, `invoice.finalized`, `payment_intent.*` ni ningún otro: caen en el `default` del switch (`app/api/stripe/webhook/route.ts:831`), que reclama el evento como procesado silenciosamente — riesgo de "consumir" eventos sin manejarlos. Disciplina de configuración = único safeguard hasta Sprint 7.

### 2.3 Anotar el signing secret

Tras crear el endpoint, en su pantalla de detalle:

1. Sección **Signing secret** → click **Reveal**.
2. Copiar el valor (formato `whsec_...`).
3. **Anotar como `STRIPE_WEBHOOK_SECRET_LIVE`** (lo necesitas en sección 3).

> **Importante sobre `.env.local`:** ya hay un valor antiguo `STRIPE_WEBHOOK_SECRET_LIVE=whsec_D4q1...` que **NO sirve** (corresponde a un endpoint distinto y/o al Stripe CLI). Ese valor **debe sobrescribirse** con el signing secret nuevo del endpoint que acabas de crear, tanto en `.env.local` como en Vercel.

---

## 3. Variables de entorno Vercel — añadir SIN cambiar `STRIPE_MODE`

En **Vercel → Project settings → Environment Variables**, añadir las 5 variables siguientes. Para cada una, marcar **Production** y **Preview** (Development opcional, no afecta al flip).

| Variable | Valor a pegar | Origen |
|---|---|---|
| `STRIPE_SECRET_KEY_LIVE` | `sk_live_...` | Stripe Dashboard LIVE → Developers → API keys → Secret key. Reveal y copiar. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` | `pk_live_...` | Stripe Dashboard LIVE → Developers → API keys → Publishable key. Copiar tal cual. |
| `STRIPE_WEBHOOK_SECRET_LIVE` | `whsec_...` | El signing secret obtenido en el paso 2.3 (NO el valor antiguo de `.env.local`). |
| `STRIPE_PRICE_STARTER_MONTHLY_LIVE` | `price_...` | El price_id del paso 1.2. |
| `STRIPE_PRICE_STARTER_YEARLY_LIVE` | `price_...` | El price_id del paso 1.3. |

### Recordatorios críticos

- **`STRIPE_MODE` permanece en `test`.** No tocar esta variable en Vercel durante el sprint.
- **Las variables `_TEST` existentes en Vercel no se tocan.** Siguen alimentando el código en runtime.
- Tras añadir las 5 variables, Vercel ofrecerá redeploy. **Acepta el redeploy** — es seguro: el código sigue leyendo `_TEST` mientras `STRIPE_MODE=test`, las nuevas variables solo quedan disponibles en `process.env`. Verifica que el deploy queda en estado **Ready** sin errores.

### Sincronizar `.env.local` (opcional pero recomendable para futuros tests locales)

Añadir/sobrescribir en `c:\Users\oms_g\reservas_clinicas\.env.local`:

```
STRIPE_PRICE_STARTER_MONTHLY_LIVE=<price_id mensual>
STRIPE_PRICE_STARTER_YEARLY_LIVE=<price_id anual>
STRIPE_WEBHOOK_SECRET_LIVE=<whsec del nuevo endpoint>
```

(`STRIPE_SECRET_KEY_LIVE` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` ya están en `.env.local`, mantenerlos.)

---

## 4. Test e2e en TEST mode (validación post-setup)

**Objetivo:** confirmar que el flujo TEST sigue intacto tras añadir las env vars LIVE en Vercel. No prueba LIVE — solo verifica que la introducción de variables nuevas no rompió nada.

**Cuenta de test:** `octaviomanzanosantana+sprint1@gmail.com`
**Tarjeta TEST:** `4242 4242 4242 4242`, exp `12/30`, CVC `123`, código postal cualquiera.

### Paso 1 — Registro

- [ ] Abrir ventana de incógnito en `https://app.appoclick.com` (o el dominio de producción actual).
- [ ] Registrarse con `octaviomanzanosantana+sprint1@gmail.com` y contraseña nueva.
- [ ] **Validar:** correo de confirmación recibido en la bandeja `octaviomanzanosantana@gmail.com`.

### Paso 2 — Confirmación de email

- [ ] Click en el enlace de confirmación.
- [ ] **Validar:** redirección a la app, sesión iniciada.
- [ ] **Validar SQL** (Supabase → SQL Editor):
  ```sql
  SELECT id, email, email_confirmed_at FROM auth.users
   WHERE email = 'octaviomanzanosantana+sprint1@gmail.com';
  ```
  → `email_confirmed_at` debe ser NOT NULL.

### Paso 3 — Crear clínica + completar onboarding hasta `Mi plan`

- [ ] Completar el onboarding hasta llegar a la sección **Mi plan** (incluyendo datos fiscales — son requisito previo a `setup-checkout` por `app/api/billing/setup-checkout/route.ts:134-143`).
- [ ] **Validar SQL:**
  ```sql
  SELECT c.id, c.slug, c.subscription_status, c.plan, c.trial_ends_at,
         td.tax_regime, td.tax_id, td.address_country
    FROM clinics c
    LEFT JOIN tax_data td ON td.clinic_id = c.id
   WHERE c.id IN (
     SELECT clinic_id FROM clinic_users WHERE user_id = (
       SELECT id FROM auth.users WHERE email = 'octaviomanzanosantana+sprint1@gmail.com'
     )
   );
  ```
  → `subscription_status='trial'`, `plan='free'` (o el default del onboarding), `trial_ends_at` futuro, `tax_data` con `tax_regime` poblado (`'isp'` si CIF español B-).

### Paso 4 — Añadir método de pago

- [ ] En **Mi plan**, seleccionar intervalo (mensual o anual, indistinto para el test).
- [ ] Click **Añadir método de pago**.
- [ ] **Validar:** redirección a Stripe Checkout en TEST mode (URL contiene `checkout.stripe.com`, badge "Test mode" visible).
- [ ] Introducir tarjeta `4242 4242 4242 4242`, exp `12/30`, CVC `123`. Confirmar.
- [ ] **Validar:** redirección de vuelta a `/mi-plan?checkout=success`.
- [ ] **Validar email:** "Tarjeta añadida correctamente" recibido (asunto exacto según `lib/billingEmails.ts`).
- [ ] **Validar SQL:**
  ```sql
  SELECT id, slug, stripe_customer_id, stripe_subscription_id, subscription_status
    FROM clinics WHERE slug = '<slug-de-la-clinica>';
  ```
  → `stripe_customer_id` y `stripe_subscription_id` ambos NOT NULL.
- [ ] **Validar Stripe Dashboard TEST:**
  - **Customers:** existe el customer con email `octaviomanzanosantana+sprint1@gmail.com`.
  - **Subscriptions:** existe la subscription, status = `trialing`, próximo cobro = `trial_ends_at`.

### Paso 5 — Forzar cobro inmediato desde Stripe Dashboard TEST

Stripe no permite "forzar cobro" trivialmente desde UI. La opción más limpia es **terminar el trial ahora**, lo que dispara una invoice inmediata que se cobrará automáticamente con la tarjeta guardada:

- [ ] Stripe Dashboard TEST → **Subscriptions** → click en la subscription recién creada.
- [ ] Botón **Actions** (arriba derecha) → **End trial now**.
- [ ] Confirmar.
- [ ] Stripe genera invoice por importe completo (€19 o €190) y la cobra contra la tarjeta `4242`.

### Paso 6 — Verificar webhook + INSERT invoices + email

Tras el "End trial now" se disparan en cadena (en orden aproximado):
1. `customer.subscription.updated` (status pasa de `trialing` a `active`)
2. `invoice.created` → cae en `default` (silenciosamente reclamado, no procesa)
3. `invoice.finalized` → ídem
4. `invoice.payment_succeeded` → handler real

> Nota: `invoice.created` e `invoice.finalized` no están suscritos en TEST tampoco, así que **no llegan al webhook** — solo `customer.subscription.updated` y `invoice.payment_succeeded`.

- [ ] **Validar Stripe Dashboard TEST → Webhooks → endpoint TEST → tab Events:** los 2 eventos arriba aparecen con status `200 OK`. Si alguno está en `Failed`, revisar en Vercel.
- [ ] **Validar logs Vercel:** project → Deployments → latest → Functions → `/api/stripe/webhook`. Buscar entradas:
  - `[stripe-webhook] customer.subscription.updated <evt_id> — clinic <slug> updated`
  - `[stripe-webhook] invoice.payment_succeeded <evt_id> — clinic <slug> payment succeeded`
  - `[stripe-webhook] invoice.payment_succeeded <evt_id> — payment_succeeded email sent`
- [ ] **Validar SQL — clínica actualizada:**
  ```sql
  SELECT subscription_status, plan, plan_expires_at, trial_ends_at
    FROM clinics WHERE slug = '<slug-de-la-clinica>';
  ```
  → `subscription_status='active'`, `plan='starter'`, `plan_expires_at` ≈ ahora + 1 mes (o + 1 año), `trial_ends_at=NULL`.
- [ ] **Validar SQL — invoice insertada:**
  ```sql
  SELECT clinic_id, stripe_invoice_id, amount_cents, currency, tax_regime, issued_at
    FROM invoices
   WHERE clinic_id = (SELECT id FROM clinics WHERE slug = '<slug-de-la-clinica>')
   ORDER BY issued_at DESC LIMIT 1;
  ```
  → `currency='EUR'`. `amount_cents` y `tax_regime` dependen del NIF usado en el alta:

  **Recomendación: usar CIF B- español o NIF peninsular en el test e2e.**
  - Si **CIF B- (empresa peninsular)**: `amount_cents=1900` mensual o `19000` anual, `tax_regime='isp'`.
  - Si **DNI peninsular dado de alta como autónomo**: `amount_cents=1900` / `19000`, `tax_regime='isp'` (mismo régimen que empresa, confirmado por asesoría — ISP también para autónomo profesional).
  - Si **NIF Canarias**: `amount_cents=2033` mensual o `20330` anual, `tax_regime='igic_7'`.

  > ⚠️ Si en el test e2e con DNI peninsular el código asigna `tax_regime='iva_21'` en lugar de `'isp'`, es **BUG** y debe revisarse en Sprint 2 (ver D8 en sección 8 — anotado en backlog bugs latentes Tier 1).
- [ ] **Validar SQL — idempotencia:**
  ```sql
  SELECT stripe_event_id, event_type, processed_at
    FROM stripe_events_processed
   ORDER BY processed_at DESC LIMIT 5;
  ```
  → Aparecen `customer.subscription.updated` e `invoice.payment_succeeded` con timestamps recientes.
- [ ] **Validar email:** "Cobro procesado" recibido en la bandeja, con importe correcto y próxima fecha de cobro.
- [ ] **Validar Sentry:** no hay errores nuevos asociados a `/api/stripe/webhook` durante el test.

### Paso 7 — Limpieza

- [ ] Stripe Dashboard TEST → la subscription puede dejarse activa o cancelarse manualmente. No afecta a producción real.
- [ ] La cuenta `+sprint1@gmail.com` y su clínica pueden borrarse vía SQL si molestan. No es bloqueante.

---

## 5. Checklist final — Sprint 1 completo

Marcar todo lo siguiente antes de cerrar el sprint:

### Stripe Dashboard LIVE
- [ ] Producto "Appoclick Starter" creado.
- [ ] Precio mensual €19 EUR recurrente creado, `price_id` anotado.
- [ ] Precio anual €190 EUR recurrente creado, `price_id` anotado.
- [ ] Webhook `https://app.appoclick.com/api/stripe/webhook` creado con los 7 eventos (6 reales + `setup_intent.succeeded` defensivo).
- [ ] Signing secret del webhook anotado.

### Vercel
- [ ] `STRIPE_SECRET_KEY_LIVE` añadido (Production + Preview).
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` añadido (Production + Preview).
- [ ] `STRIPE_WEBHOOK_SECRET_LIVE` añadido con el valor del paso 2.3 (Production + Preview). NO el valor antiguo de `.env.local`.
- [ ] `STRIPE_PRICE_STARTER_MONTHLY_LIVE` añadido (Production + Preview).
- [ ] `STRIPE_PRICE_STARTER_YEARLY_LIVE` añadido (Production + Preview).
- [ ] Redeploy automático tras añadir env vars completado en estado **Ready** sin errores.
- [ ] **`STRIPE_MODE` sigue en `test`.** Confirmado visualmente.

### `.env.local` (local, opcional)
- [ ] `STRIPE_WEBHOOK_SECRET_LIVE` sobrescrito con el valor nuevo.
- [ ] `STRIPE_PRICE_STARTER_MONTHLY_LIVE` añadido.
- [ ] `STRIPE_PRICE_STARTER_YEARLY_LIVE` añadido.

### Validación e2e (TEST mode, post-setup)
- [ ] Test e2e de la sección 4 completado de principio a fin sin errores.
- [ ] Email "Tarjeta añadida" recibido.
- [ ] Email "Cobro procesado" recibido.
- [ ] Filas correctas en `clinics`, `invoices`, `stripe_events_processed`.
- [ ] Sin errores en Sentry asociados al webhook durante el test.

---

## 6. Recordatorio operativo para el flip futuro (NO en este sprint)

Cuando llegue el cutover (26 may - 1 jun 2026), el flip consistirá en cambiar `STRIPE_MODE=test` → `STRIPE_MODE=live` en Vercel.

**Importante (hallazgo D4 de la auditoría):** el cliente Stripe se cachea como singleton en `lib/stripe.ts:29-43`. En lambdas warm de Vercel, una vez instanciado, no se reinicia hasta cold start. Implicación operativa:

- ✅ **Cambiar `STRIPE_MODE` en Vercel UI o vía `vercel env` fuerza un redeploy automático** → todas las lambdas son cold-started → el singleton se reinicia correctamente con la nueva config.
- ❌ **NO hacer flip vía API de Vercel sin trigger de redeploy.** Las lambdas warm seguirían usando el cliente TEST hasta su próximo cold start, generando inconsistencia mientras tanto (algunos requests TEST, otros LIVE).
- **Procedimiento seguro recomendado para el flip:** editar `STRIPE_MODE` desde Vercel UI → verificar que el banner "Redeploying..." aparece → esperar a estado **Ready** → primer request LIVE.

---

## 7. Lo que NO hacemos en este sprint

Recordatorios explícitos para evitar atajos:

- **NO cambiar `STRIPE_MODE`.** Permanece en `test` hasta el cutover.
- **NO probar con tarjetas reales en LIVE.** Cualquier prueba post-setup se hace en TEST mode con el flujo de la sección 4.
- **NO crear el producto Pro en LIVE.** Pro está archivado y fuera de scope hasta activar la lista de espera.
- **NO commitear este documento.** Es deliverable interno de sprint; se trata como working doc hasta cierre.
- **NO suscribir eventos extra al webhook LIVE** (ej. `invoice.created`, `payment_intent.succeeded`, `customer.subscription.trial_will_end`). El `default` case del switch los reclamaría como procesados sin manejarlos — riesgo silencioso. Solo los 7 eventos de la tabla 2.2.
- **NO modificar el código del webhook.** Cualquier mejora detectada va a "Fuera de scope" más abajo.

---

## 8. Fuera de scope / Deuda técnica para sprints posteriores

Hallazgos detectados durante la auditoría (FASES 1 y 2). **No se arreglan en Sprint 1.** Anotar para Sprint 7 (limpieza post-cutover).

### D1 — Duplicación de lógica de selección de price IDs
- **Dónde:** `app/api/billing/setup-checkout/route.ts:83-98`.
- **Qué:** la selección `_TEST`/`_LIVE` del price ID se reimplementa inline con `process.env.STRIPE_MODE || "test"` en lugar de importar `PLAN_PRICES` de `lib/stripe.ts`.
- **Impacto actual:** ninguno (resultado funcional idéntico).
- **Riesgo futuro:** si `lib/stripe.ts` cambia (p.ej. añadir staging), `setup-checkout` divergiría silenciosamente.
- **Acción Sprint 7:** refactorizar para usar `PLAN_PRICES.starter[interval]`.

### D2 — Helpers definidos pero no consumidos
- **Dónde:** `lib/stripe.ts` exporta `getStripePublishableKey()` (L64-76) y `PLAN_PRICES` (L88-100).
- **Qué:** `getStripePublishableKey()` no se importa en ningún archivo. `PLAN_PRICES` solo se usa internamente para construir `PRICE_TO_PLAN`.
- **Impacto actual:** código muerto, no afecta runtime.
- **Acción Sprint 7:** eliminar si siguen sin uso, o documentar el caso de uso futuro (Stripe Elements en cliente).

### D3 — UI hardcodea precios
- **Dónde:** `components/billing/PlanIntervalSelector.tsx:20-33` (`"19 €"` y `"190 €"`).
- **Qué:** los precios mostrados al usuario son strings hardcoded, no se derivan de Stripe.
- **Impacto actual:** ninguno (precios LIVE = TEST = €19/€190).
- **Riesgo futuro:** si los precios cambian en LIVE, la UI mostraría datos antiguos hasta deploy.
- **Acción Sprint 7:** derivar los precios desde un endpoint server-side que lea `PLAN_PRICES` y consulte Stripe (`prices.retrieve`), o exponer una env var pública con el valor para mostrar.

### D4 — Singleton caching del cliente Stripe (operativo, no solo deuda)
- **Dónde:** `lib/stripe.ts:29-43`.
- **Qué:** `_stripe` se cachea por warm lambda; cambios de `STRIPE_MODE` no se reflejan hasta cold start.
- **Impacto actual:** ninguno mientras el flip se haga vía Vercel UI/CLI (que fuerza redeploy).
- **Acción operativa:** **respetar el procedimiento de la sección 6**.
- **Acción Sprint 7 (opcional):** invalidar el singleton si `STRIPE_MODE` cambia entre lecturas, o eliminar el cache (Stripe SDK ya es ligero de instanciar).

### D5 — Default case del switch reclama eventos silenciosamente
- **Dónde:** `app/api/stripe/webhook/route.ts:831`.
- **Qué:** un `event.type` no manejado loguea warn pero **no borra el claim de idempotencia**, dejando el evento "procesado" sin haberlo procesado.
- **Impacto actual:** ninguno mientras la disciplina de configuración del webhook LIVE se respete (solo los 7 eventos de la tabla 2.2).
- **Acción Sprint 7:** o bien hacer `throw` en el default (Stripe reintenta y vemos en Sentry), o bien retornar 200 sin reclamar (Stripe no reintenta, el evento queda registrado solo en Stripe Dashboard).

### D6 — No existe `.env.example`
- **Dónde:** raíz del repo.
- **Qué:** no hay plantilla de variables de entorno; `.env.local` es la única fuente.
- **Impacto actual:** ninguno mientras Octavio sea el único operador.
- **Acción Sprint 7:** generar `.env.example` con todas las variables documentadas (sin valores), commitear al repo.

### D7 — Pricing visual y comunicación
- **Decisión final:** mostrar `€19/mes` sin asteriscos ni notas. Stripe Checkout (modo `Exclusive`) muestra el desglose fiscal al cliente.
- **Razón:** la realidad fiscal es que >90% del ICP paga literalmente €19 vía ISP. Solo Canarias (IGIC 7%, €20,33) y particular consumidor final peninsular (IVA 21%, €22,99 — caso residual) verán importes distintos, y Checkout los desglosa antes del cobro.
- **Acción Sprint 1.5:** verificar que landing/UI/emails muestran `€19/mes` a secas, sin disclaimers defensivos. Eliminar cualquier asterisco o nota fiscal existente.

### D8 — Lógica `tax_regime` para autónomo peninsular (descubrimiento de asesoría)
- **Qué:** la matriz SaaS original asignaba `iva_21` a DNI peninsular. La asesoría externa (Davinia Arteaga, BiPlaza/Marrero Asesores) confirma que un **autónomo es empresario** y le aplica ISP, igual que a empresa CIF. Solo el "particular consumidor final peninsular" (DNI sin alta empresarial) lleva IVA 21%.
- **Acción Sprint 2:** auditar el código que calcula `tax_regime` en `app/api/stripe/webhook/route.ts` y `app/api/billing/setup-checkout/route.ts`. Si asigna `iva_21` a todo DNI peninsular, hay que distinguir por tipo de actividad / alta empresarial.
- **Validación en BD:** `tax_data.tax_id_type` probablemente necesita un campo nuevo o lógica adicional para distinguir 'autónomo profesional' vs 'consumidor final'.
- **Backlog:** bugs latentes Tier 1.

### D9 — VIES no aplica a Analógicamente Digitales
- **Qué:** por estar la sociedad en Canarias, no es operador intracomunitario a efectos IVA. Si el código actual valida VIES como condición previa para aplicar ISP, debe eliminarse esa validación (o usarse solo informativamente).
- **Acción Sprint 2:** auditar `setup-checkout` y la lógica de `tax_data` para detectar y eliminar (o reformular) cualquier validación VIES bloqueante.

---

## 9. Referencias rápidas

- **Webhook URL:** `https://app.appoclick.com/api/stripe/webhook`
- **Código webhook:** `app/api/stripe/webhook/route.ts`
- **Inicialización Stripe SDK:** `lib/stripe.ts` (singleton `getStripe()`)
- **Setup checkout:** `app/api/billing/setup-checkout/route.ts`
- **Email helpers:** `lib/billingEmails.ts`
- **Tabla idempotencia:** `stripe_events_processed`
- **Tabla invoices:** `invoices` (con columna `tax_regime`)
- **Tabla clínicas:** `clinics` (campos: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan`, `plan_expires_at`, `trial_ends_at`, `canceled_at`)
