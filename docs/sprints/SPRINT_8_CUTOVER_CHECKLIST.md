# Sprint 8 · Checklist congelado del flip a LIVE

**Fecha ejecución:** lunes 19 mayo 2026
**Hora recomendada:** 10:00-11:00 Canarias (08:00-09:00 UTC)
**Duración esperada:** ~30 min flip + 15 min smoke = 45 min total
**Responsable:** Octavio Manzano Santana
**Contacto respaldo S1:** Antonio Peñate (`+34 699 33 84 34`)

---

## 0. Pre-requisitos antes de empezar

Marcar antes de la hora cero:

- [ ] Estás en casa o sitio con conexión estable (no datos móviles)
- [ ] Tienes café o lo que necesites para 60 min sin distracción
- [ ] Móvil silencio salvo Antonio
- [ ] `docs/runbooks/INCIDENT_RESPONSE.md` abierto en pestaña (por si algo)
- [ ] Bookmark `https://status.stripe.com` accesible
- [ ] Bookmark `https://www.vercel-status.com` accesible
- [ ] Una verificación: ningún email reciente de Stripe sobre incidentes en su lado

**Si algo de lo anterior falla → POSPONER. No empezar el flip a medias.**

---

## 1. Apertura (T+00:00 → T+02:00)

```
[ ] T+00:00  Abrir Vercel Dashboard 
             https://vercel.com/[tu-org]/app-appoclick
             → Pestaña 1

[ ] T+00:30  Abrir Stripe Dashboard LIVE 
             https://dashboard.stripe.com
             → Verificar toggle: badge naranja "Test mode" OFF
             → Pestaña 2

[ ] T+01:00  Abrir Supabase Dashboard 
             → SQL Editor preparado para queries
             → Pestaña 3

[ ] T+01:30  Abrir app.appoclick.com en ventana incógnito
             → Verificar carga normal
             → Pestaña 4

[ ] T+02:00  Abrir PowerShell en C:\Users\oms_g\reservas_clinicas
             → git status (esperado: clean salvo migration RLS)
             → git log --oneline -3 (esperado: c65f9b7 al menos)
```

**Checkpoint 1:** las 4 pestañas + terminal abiertas. Si alguna falla en cargar, parar y diagnosticar antes de seguir.

---

## 2. Snapshot del estado pre-flip (T+02:00 → T+05:00)

Documentar el estado actual por si necesitas rollback:

```
[ ] T+02:00  En Vercel Dashboard → Deployments
             → Anotar SHA del último deploy "Ready" verde
             → Este es tu deploy de rollback si todo se tuerce
             
             SHA pre-flip: _______________

[ ] T+03:00  En Vercel → Settings → Environment Variables
             → Localizar STRIPE_MODE
             → Click en el ojo 👁
             → Confirmar valor literal: "test"
             → Si vieras cualquier otro valor: PARAR, contactar Antonio

[ ] T+04:00  En Stripe Dashboard LIVE → Developers → Webhooks
             → Click en endpoint we_1TJN39AL0qP42ZSxAOiVmfBO
             → Anotar: "Eventos fallidos últimos 7 días": _______
             → Si > 0: PARAR, investigar antes de flip

[ ] T+04:30  En Supabase SQL Editor, ejecutar:
             
             SELECT COUNT(*) FROM clinics WHERE stripe_subscription_id IS NOT NULL;
             
             → Anotar resultado: _______ 
             → Esperado: 2 (b2-fix, blocker-fix de TEST)
             → Si > 2: hay sub LIVE pre-existente, raro pero no bloqueante
```

**Checkpoint 2:** SHA rollback anotado + STRIPE_MODE=test confirmado + webhook 0 fallos + count baseline. Sin estos 4 datos, no avanzar.

---

## 3. Hardening previo de env vars LIVE (T+05:00 → T+10:00)

Unificar scope de las env vars LIVE a "Production and Preview" como las TEST:

```
[ ] T+05:00  En Vercel → Settings → Environment Variables
             → Buscar STRIPE_SECRET_KEY_LIVE
             → Click "..." → Edit
             → Sección "Environment" verifica que esté en:
               ☒ Production
               ☒ Preview
               ☐ Development
             → Save

[ ] T+06:30  Repetir para STRIPE_WEBHOOK_SECRET_LIVE
             → Mismo scope: Production + Preview, NO Development

[ ] T+07:30  Repetir para NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE
             → Mismo scope

[ ] T+08:30  Verificar STRIPE_PRICE_STARTER_MONTHLY_LIVE
             → Ya está en "Production and Preview" + marcada Sensitive
             → No tocar, solo verificar

[ ] T+09:00  Verificar STRIPE_PRICE_STARTER_YEARLY_LIVE
             → Ya está en "Production and Preview" + Sensitive
             → No tocar, solo verificar
```

**Checkpoint 3:** las 5 env vars LIVE en scope "Production and Preview", ninguna leak a Development.

---

## 4. EL FLIP (T+10:00 → T+12:00)

**El punto de no retorno empieza aquí.** Una vez ejecutado el redeploy, producción está en modo LIVE.

```
[ ] T+10:00  En Vercel → Settings → Environment Variables
             → Localizar STRIPE_MODE
             → Click "..." → Edit
             
[ ] T+10:30  Cambiar valor:
             
             ANTES: test
             DESPUÉS: live
             
             ⚠️ ESCRIBIR LITERALMENTE: l-i-v-e
             ⚠️ MINÚSCULAS, SIN ESPACIOS, SIN COMILLAS
             ⚠️ NO copiar/pegar, escribir manual para evitar caracteres invisibles
             
             → Save

[ ] T+11:00  Verificar visualmente:
             → Click 👁 sobre STRIPE_MODE recién guardado
             → Confirmar "live" exacto (no "Live", no "LIVE", no "live ")
             → Si ves cualquier variante: editar otra vez, escribir bien
             
             ⚠️ Recordatorio: lib/stripe.ts hace match estricto 
             sobre "live" minúsculas. Cualquier otro valor 
             cae al default "test" silenciosamente.

[ ] T+12:00  CHECKPOINT MENTAL antes del redeploy:
             → ¿Tienes algún cliente en producción ahora mismo 
               haciendo signup o pago? (improbable, domingo/lunes 
               temprano, pero verificar Vercel Analytics si dudas)
             → ¿Estás listo para el flip? (sí/no)
             → Si "no" por cualquier razón: PARAR. El flip puede 
               esperar 30 min más sin problema.
```

**Checkpoint 4:** `STRIPE_MODE=live` guardado en Vercel pero **el código aún no lo está usando** (lambdas warm siguen con `test`). El siguiente paso lo activa.

---

## 5. Redeploy y activación (T+12:00 → T+17:00)

```
[ ] T+12:00  En Vercel → Deployments → último deploy "Ready" verde
             → Click "..." (tres puntos a la derecha)
             → "Redeploy"
             → Pop-up: dejar "Use existing Build Cache" MARCADO 
               (acelera el redeploy, no afecta env vars)
             → Confirm

[ ] T+12:30  Esperar redeploy. Tiempo esperado: 1-2 min.
             → Verás "Building..." → "Deploying..." → "Ready"
             → NO recargar la página de Vercel cada 5 segundos. 
               Te da ansiedad sin acelerar nada.

[ ] T+14:00  Cuando aparezca "Ready":
             → Verificar visualmente el badge verde
             → Anotar timestamp exacto: _______________
             
             A partir de este momento producción está en LIVE.

[ ] T+15:00  Primera verificación silenciosa:
             → En ventana incógnito de pestaña 4
             → Recargar app.appoclick.com
             → ¿Carga normal? Sí → seguir. No → ir a CONTINGENCIA A.

[ ] T+16:00  Verificar endpoint webhook responde:
             → En navegador: https://app.appoclick.com/api/stripe/webhook
             → Esperado: HTTP 405 (Method Not Allowed)
             → Si ves 500: ir a CONTINGENCIA B
             → Si ves 404: ir a CONTINGENCIA C
```

**Checkpoint 5:** redeploy en "Ready", app carga, webhook endpoint responde 405. **El flip ha terminado técnicamente.** Lo siguiente es validar que LIVE funciona, no que el flip se hizo.

---

## 6. Smoke test post-flip (T+17:00 → T+27:00)

**Importante:** ningún cliente está usando LIVE todavía. Tienes ventana de 10-15 min para validar antes de invitar a alguien.

```
[ ] T+17:00  Verificar que getStripe() resuelve a LIVE
             
             En PowerShell:
             curl.exe "https://app.appoclick.com/api/stripe/webhook" -X POST -H "Stripe-Signature: invalid" -d "test"
             
             Esperado: HTTP 400 con mensaje de firma inválida
             (esto valida que el endpoint está construyendo el 
             cliente Stripe con la SECRET_KEY_LIVE y validando 
             firmas con WEBHOOK_SECRET_LIVE)
             
             Si vieras "Missing STRIPE_SECRET_KEY_LIVE": 
             → ir a CONTINGENCIA D (env var LIVE mal configurada)

[ ] T+19:00  Verificar Stripe Dashboard LIVE registra una petición:
             → Stripe Dashboard LIVE → Developers → Webhooks
             → Endpoint we_1TJN39AL0qP42ZSxAOiVmfBO
             → Pestaña "Event deliveries"
             → ¿Ves intento reciente? (de los retries de Stripe 
               de eventos antiguos, si los hay)
             → Si no, no pasa nada: Stripe solo manda eventos 
               cuando hay actividad real

[ ] T+21:00  Test funcional ligero — Customer Portal
             → Stripe Dashboard LIVE → Customers
             → Si hay alguno: click → "Open customer portal"
             → Verificar abre el portal con branding correcto
             → Si no hay customers en LIVE: saltar este paso

[ ] T+23:00  Verificar logs Vercel últimos 5 min
             → Vercel → Logs → filtrar por /api/stripe/webhook
             → ¿Hay errores 5xx? Sí → investigar antes de seguir
             → ¿Hay logs de tipo "Missing STRIPE_*_LIVE"? Sí → CONTINGENCIA D

[ ] T+25:00  Test final: smoke de signup público
             → app.appoclick.com en incógnito
             → Pestaña pricing → click "Empezar gratis" o equivalente
             → Verificar redirige correctamente al signup
             → NO completar el signup (no quieres crear cuenta dummy en LIVE)
             → Cerrar pestaña

[ ] T+27:00  CHECKPOINT 6: si todo lo anterior verde → flip EXITOSO
             → Anotar timestamp: _______________
             → Comunicación a Antonio: "Flip ejecutado OK, todo verde"
             → Tomarse 5 min antes de seguir con onboarding clínicas
```

**Checkpoint 6:** producción en LIVE, webhook firmando con secret LIVE, smoke verde, sin errores en logs últimos 5 min.

---

## 7. Acciones post-flip (T+27:00 → T+35:00)

```
[ ] T+27:00  Update tabla de variables Vercel — opcional pero 
             recomendado:
             → Renombrar STRIPE_MODE descripción a "live (post-cutover 19/5)"
             → Esto te recuerda en 6 meses que el flip se hizo el 19/5

[ ] T+29:00  Verificar 1 hora después (programar recordatorio):
             → Stripe Dashboard LIVE → Webhooks → fallos
             → Vercel → Logs → errores
             → Esperado: ambos a 0

[ ] T+30:00  Comunicar internamente:
             → A Antonio: "Cutover OK"
             → A ti mismo: anotar en bullet de Sprint 8 progress

[ ] T+32:00  Commit del estado (opcional, sin push):
             → No hay cambios de código en el flip 
               (la env var es Vercel, no repo)
             → No hace falta commit por el flip mismo
             → Pero SÍ puedes pushear el INCIDENT_RESPONSE.md 
               de ayer si aún no lo hiciste
```

---

## 8. CONTINGENCIAS

### CONTINGENCIA A · app.appoclick.com no carga tras redeploy

```
1. Vercel Dashboard → Deployments → último
2. ¿Estado "Error" o "Building..."? 
   → Esperar 2 min más. A veces tarda en propagar.
3. ¿Sigue mal después de 3 min?
4. ROLLBACK INMEDIATO:
   → Deployments → buscar el SHA pre-flip anotado en checkpoint 2
   → Click "..." → "Promote to Production"
   → Verificar app carga
5. Investigar causa con cabeza fría:
   → ¿Build logs muestran error?
   → ¿Algún env var rota la build?
6. NO reintentar flip hasta tener fix
```

### CONTINGENCIA B · Webhook devuelve 500

```
1. Vercel → Logs → filtrar /api/stripe/webhook
2. Buscar stacktrace del 500
3. Causa más probable:
   → Falta STRIPE_SECRET_KEY_LIVE o WEBHOOK_SECRET_LIVE en env vars
   → Verificar en Settings → Env Vars que ambas existen y 
     están en scope Production
4. Si las env vars están OK pero sigue fallando:
   → Posible bug en handler con firma LIVE
   → Rollback STRIPE_MODE a "test" + redeploy
   → Investigar sin presión
```

### CONTINGENCIA C · Webhook devuelve 404

```
Esto NO debería pasar si el flip solo cambió env vars.
Si pasa, indica que el deploy no se ejecutó o se desplegó 
desde una rama equivocada.

1. Verificar Vercel → Deployments → último
2. ¿Branch source es main? Sí → seguir. No → corregir.
3. ¿Build logs OK? Sí → seguir. No → leer error.
4. Si todo OK pero 404 persiste:
   → Rollback al SHA pre-flip
   → Contactar Antonio (esto es raro)
```

### CONTINGENCIA D · "Missing STRIPE_SECRET_KEY_LIVE" en logs

```
Causa: env var LIVE no existe o no aplica al entorno Production.

1. Vercel → Settings → Env Vars → STRIPE_SECRET_KEY_LIVE
2. Verificar que existe
3. Verificar scope: ¿incluye "Production"?
4. Si scope solo era "Preview" o "Development":
   → Editar → marcar también "Production"
   → Save
   → REDEPLOY OTRA VEZ (env var no aplica hasta redeploy)
5. Si el problema persiste:
   → ROLLBACK STRIPE_MODE a "test" + redeploy
   → Investigar
```

### CONTINGENCIA E · Algo inclasificable / pánico

```
1. Respira 30 segundos.
2. Rollback STRIPE_MODE a "test":
   → Vercel → Env Vars → STRIPE_MODE → Edit → "test" → Save
   → Deployments → Redeploy
3. Verificar app carga, webhook responde
4. Llamar a Antonio: +34 699 33 84 34
5. Comunicar el incidente con template D del INCIDENT_RESPONSE.md 
   si hubo impacto a clientes (improbable en lunes 10am pre-launch)
```

---

## 9. Anti-checklist · qué NO hacer durante el flip

- ❌ NO commit + push de código nuevo durante el flip. Cero cambios de código entre T+00:00 y T+27:00.
- ❌ NO invitar clínicas a registrarse hasta haber pasado checkpoint 6
- ❌ NO tocar Stripe Dashboard configuración (productos, precios, webhooks) durante el flip
- ❌ NO tocar Supabase schema o RLS durante el flip
- ❌ NO empezar Sprint 9 features mientras dura el cutover
- ❌ NO contestar mensajes de WhatsApp/email no urgentes durante el flip
- ❌ NO entrar al admin a "echar un vistazo" — no toques nada hasta checkpoint 6
- ❌ NO marcar Sprint 8 como cerrado hasta haber visto webhook LIVE procesar al menos 1 evento real (puede ser días después)

---

## 10. Definición de "Flip exitoso"

Marcar al final:

- [ ] STRIPE_MODE=live en Vercel, verificado visualmente
- [ ] Redeploy en estado "Ready" verde
- [ ] app.appoclick.com carga normalmente
- [ ] Webhook endpoint responde 405 a GET, 400 a POST sin firma
- [ ] Sin errores 5xx en logs Vercel últimos 5 min
- [ ] Sin errores en Stripe Dashboard → Webhooks últimos 5 min
- [ ] SHA pre-flip documentado para rollback futuro
- [ ] Antonio notificado del éxito

**Si las 8 cajas están marcadas → flip exitoso. Mover Sprint 8 a "Cutover técnico cerrado · soft launch en curso".**

---

**Fin del checklist · congelado 17 mayo 2026 · ejecutar tal cual el lunes**
