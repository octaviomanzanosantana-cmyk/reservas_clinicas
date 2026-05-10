# Sprint 7.6 — DPA Banner Visibility

**Fecha inicio:** 9 mayo 2026
**Fecha cierre:** 10 mayo 2026
**Estado:** ⚠️ Cerrado parcialmente — Fase 3 revertida, escalada a Tier 2
**Sprint:** 7.6
**Bloqueante Sprint 8 cutover:** NO (banner en home cubre soft-launch básico)

## Objetivo original

Hacer visible el banner DPA pendiente de aceptación en TODAS las subrutas
del panel clínica `/clinic/[slug]/*`, no solo en home, antes del soft-launch
del 19 mayo. Mínimo viable: banner informativo cerrable con cooldown 24h,
exclusión explícita pilots por código (P14).

## Resultado real

- ✅ Fase 1 arqueología completa (commit 6c49bb8) — diagnóstico Escenario A
- ✅ Fase 2 decisión scope confirmada (Opción 1 completa)
- ⚠️ Fase 3 implementación 3A+3B intentada (commit 794a4ac) — REVERTIDA
- ❌ Fase 3 sub-bloque 3C no ejecutado
- ❌ Tests funcionales T1-T6 no ejecutados (validación visual reveló bug
     antes de tests)

## Bug encontrado

Tras el commit 794a4ac que monta DPABanner en el slot banner del layout
`(by-slug)/[slug]/layout.tsx`:

- Banner aparece correctamente en `/clinic/[slug]` (home) ✅
- Banner NO aparece en `/clinic/[slug]/calendar`, `/services`, `/patients` ❌
- DOM search confirma "0 of 0": banner ausente del HTML servido en subrutas
- Análisis estático de layouts y pages NO encuentra layout intermedio
  que sobrescriba el slot

**Hipótesis de la causa:** comportamiento Next.js no documentado relacionado
con route groups, parallel routes, cache de build, o middleware. Requiere
debugging runtime que excede scope 7.6.

## Estado tras revert

- Código en estado idéntico a pre-Sprint 7.6 (commit 794a4ac revertido)
- Banner DPA inline en `ClinicDashboardPage.tsx:453-465` sigue funcionando
  como antes (visible solo en home, condición `dpa_accepted_at IS NULL`)
- Componentes `DPABanner.tsx` y `DPABannerClient.tsx` eliminados por revert
- Doc audit 7.6 (commit 6c49bb8) preservado como evidencia histórica

## Impacto soft-launch (19 mayo)

**No bloqueante.** Las clínicas reales del soft-launch:
1. Tras signup vía `/register`, reciben email de verificación
2. Click en link → `/auth/confirm` → provisioning con `dpa_accepted_at = NOW()`
   (checkbox required en RegisterForm)
3. Aterrizan ya con DPA aceptado, no ven banner

El banner cubría únicamente clínicas pre-DPA o creadas por script admin.
Las 2 clínicas pendientes en BD (`sprint-7-c5-clock`, `cl-nica-en-modo-recuperaci-n`)
son testing del propio Octavio, no clientes reales.

## Hallazgos preservados de Bloque B (BD prod)

- 12 clínicas en producción (al inicio del sprint, hoy 13 tras `rotation-final-2026-05-09`)
- 2 pending DPA (testing): `sprint-7-c5-clock`, `cl-nica-en-modo-recuperaci-n`
- 10 accepted DPA (incluidos pilots Miriam y Symbios, ambas v1.4)
- Pilots accepted_at via backfill, NO firma física (deuda Sprint 8)

## Tier 2 escalados a sprint dedicado

### T2-DPA-1 (PRIORIDAD ALTA — antes de cutover si tiempo)

**Bug Next.js: banner del slot banner no aparece en subrutas con slug.**
Investigación pendiente:
- ¿Hay middleware interceptando subrutas?
- ¿Cache de Vercel sirviendo HTML antiguo?
- ¿Route groups `(by-slug)` causando layout split?
- ¿Componente cliente `ClinicPanelLayout` re-monta en navegación entre subrutas?

Aproximación recomendada:
1. Reproducir local con `next dev`, observar Network panel y comparar HTML
   servido en home vs subruta
2. Si comportamiento se reproduce local: añadir `console.log` en server
   component DPABanner para confirmar si se invoca o no en subrutas
3. Si no se invoca: el problema está en el ciclo del layout
4. Si se invoca pero no aparece en HTML: problema de streaming/RSC

Estimación: 1-3h debugging + fix.

### T2-DPA-2 (PRIORIDAD MEDIA)

**Cobertura de rutas legacy (default)**

`app/clinic/(default)/patients/page.tsx` no redirige (única page default sin
redirect), renderiza directo sin banner.

`app/mi-plan/layout.tsx` y `/mi-plan/datos-fiscales` montan `ClinicPanelLayout`
sin prop banner.

Cuando T2-DPA-1 resuelto, replicar patrón en estos 2 layouts.

### T2-DPA-3 (PRIORIDAD MEDIA — ya estaba registrada en memoria)

**Vista admin de aceptaciones DPA.** Hoy solo via SQL:

```sql
SELECT slug, legal_name, dpa_accepted_at, dpa_version, dpa_ip
FROM clinics WHERE dpa_accepted_at IS NOT NULL;
```

Crear vista en panel admin para listar y exportar.

### T2-DPA-4 (PRIORIDAD BAJA)

**Archivo inmutable de versiones DPA.** Cuando se bumpee a v1.5, guardar
snapshot HTML/PDF en Storage etiquetado por versión, para evidencia legal
si auditoría AEPD pide "qué texto firmó cliente X en fecha Y".

### T2-DPA-5 (PRIORIDAD ALTA — operacional)

**Firma física presencial pilots Miriam y Symbios.** Ya estaba registrado en
memoria como pendiente Sprint 8. Documentar y archivar en Drive RGPD.

### T2-DPA-6 (PRIORIDAD BAJA — optimización)

**SubscriptionBanner y DPABanner hacen 2 SELECTs separados a `clinics`.**
Cuando T2-DPA-1 resuelto y banner reactivado, considerar helper único que
lea todos los campos relevantes en una query y devuelva states para ambos.
No bloqueante. Coste actual: ~1 query extra por carga de panel.

## Lección aprendida (P-nuevo)

**Verificación visual humana NO es opcional para cambios de layout en
Next.js.** El análisis estático de "el componente está en el layout que
envuelve a las hijas" NO garantiza que se renderice. Route groups, parallel
routes y mecanismos de cache pueden romper esta intuición.

Para futuros sprints que toquen layouts:
1. Validación visual obligatoria ANTES del commit, no después
2. Si la app requiere sesión autenticada y Code no puede validar local,
   pausar para validación Octavio antes de commit
3. No certificar "por arquitectura" sin reproducción runtime confirmada

## Próximos pasos

1. Sprint dedicado para T2-DPA-1 (1-3h, semana del 19-23 mayo si tiempo,
   sino post-cutover)
2. Resto de T2-DPA-* en backlog Mes 1 post-launch
3. Soft-launch arranca lunes 19 mayo SIN bloqueante DPA
4. Pilots intactos durante todo Sprint 7.6 (P14 cumplido)
