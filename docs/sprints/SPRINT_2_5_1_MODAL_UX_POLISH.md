# SPRINT 2.5.1 — Pulido UX modal de edición de cita

**Fecha apertura:** 01/05/2026
**Fecha cierre:** 01/05/2026
**Tiempo real:** ~50 min (estimado 30 min, ampliado por iteraciones de diseño en Bloque D)
**Branch base:** `main` (sobre commit `9e2c4ef` — cierre de Sprint 2.5)
**Bloqueante para cutover:** No

---

## 1. Origen

Hallazgos UX detectados durante la validación e2e de Sprint 2.5 y promovidos a este mini-sprint. Documentados originalmente en `docs/sprints/SPRINT_2_5_EDIT_APPOINTMENTS.md` §8.

| # | Hallazgo | Bloque que lo cubre |
|---|---|---|
| 1 | Sin X de cerrar arriba a la derecha | Bloque A |
| 2 | Click en backdrop no cierra modal | Bloque B |
| 3 | Botón "Cerrar" abajo del todo, requiere scroll para alcanzarlo | Bloque C |
| 4 | Modal alta con scroll vertical (grilla de slots la hincha) | Bloque D |

---

## 2. Bloques ejecutados

### Bloque A — X cerrar arriba a la derecha
- Header del modal pasa a `flex justify-between`: título + subtítulo a la izquierda, botón X a la derecha
- SVG inline (Heroicons mini 20×20, sin dependencias nuevas)
- `aria-label="Cerrar"` + `aria-hidden` en el SVG
- Hover: `bg-[#F3F4F6]` + `text-foreground`
- Negative margins (`-mr-2 -mt-2`) para área clickable amplia sin descuadrar el título
- Commit: `2cf1a56`

### Bloque B — Handler `handleClose` unificado
- Detección de cambios sin guardar: `patientDirty` (compara name/email/phone/modality/videoLink con valores iniciales) `||` `rescheduleDirty` (slot seleccionado pero no enviado)
- `confirm()` nativo si `hasUnsavedChanges`
- Bloqueo de cierre durante operaciones en curso (`savingPatient || rescheduling`) para evitar race conditions
- Conectado a backdrop, X y botón Cerrar (este último se elimina en Bloque C)
- `e.stopPropagation()` en el panel interior — clicks dentro del modal NO disparan el handler del backdrop
- Commit: `167487f`

### Bloque C — Eliminar botón "Cerrar" inferior
- Con la X (Bloque A) y el backdrop (Bloque B), el botón "Cerrar" del fondo queda redundante
- Eliminadas 9 líneas, cero adiciones
- Botones de acción quedan dentro de su `<section>` respectiva ("Guardar cambios" en datos paciente, "Reagendar cita" en sección reschedule)
- Commit: `b8ec491`

### Bloque D — Sticky header + body scroll lock + custom scrollbar
Tres cambios consolidados en un único commit por su acoplamiento visual:

1. **Body scroll lock** vía `useEffect`: `document.body.style.overflow = "hidden"` al montar, restauración al desmontar. Evita que la página detrás del modal scrollee
2. **Header sticky** dentro del panel: `sticky top-0 z-10 -mx-6 -mt-6 bg-white px-6 pt-6 pb-3 shadow-[0_1px_0_rgba(0,0,0,0.05)]`. Negative margins extienden el bg edge-to-edge del panel; padding interno preserva el spacing del título; shadow de 1px aparece como línea fina cuando hay contenido scrolleando debajo
3. **Custom scrollbar**: nueva clase `.custom-scrollbar` en `globals.css` (WebKit + Firefox), 6px de ancho, thumb `#E5E7EB` con hover `#D1D5DB`, track transparente. Aplicada al panel del modal

Commit: `c9ebcde`

---

## 3. Trade-off aceptado — Alternativa A en Bloque D

**Iteración intermedia descartada:** scroll interno propio en la grilla de slots (`max-h-[180px] overflow-y-auto rounded-[10px] border p-2`). Generaba doble scrollbar visible en días con muchos slots (uno del modal entero, otro del contenedor de slots). Ruido visual y mala UX.

**Decisión final (Alternativa A):** un único scrollbar — el del modal entero. Slots permanecen como `flex flex-wrap gap-2` plano. Más simple supera "diseño bonito pero ruidoso".

**Observación residual aceptada:** en días con muchos slots (14+), la sección reagendar domina visualmente al scrollear el modal. Mitigado por el header sticky con la X siempre accesible arriba — el usuario nunca pierde la salida del modal.

---

## 4. Tests visuales pasados

| Bloque | Tests | Estado |
|---|---|---|
| A | Captura visual: X visible, alineada con título, hover funciona, click cierra | ✅ |
| B | V5 (click backdrop sin cambios cierra), V6 (con cambios → confirm), V7 (cancel mantiene modal con datos), V10 (click neutro dentro del modal no cierra) | ✅ |
| C | W1 (sin botón Cerrar abajo), W2 (botones de acción claros en sus secciones), W3 (X mantiene comportamiento de B), W4 (backdrop mantiene comportamiento de B) | ✅ |
| D | G1 (body bloqueado al estar abierto), H1 (un único scrollbar tras Alternativa A), H3 (scrollbar discreto 6px sin botones nativos), H6 (body lock funcionando), H7+H8+H9 (header sticky con shadow + X siempre visible + handleClose unificado activo) | ✅ |

Tests no ejecutados pero asumidos por construcción: F1-F10, G2-G7, H2/H4/H5 (variantes y comportamientos derivados).

---

## 5. Archivos modificados

- `components/clinic/EditAppointmentModal.tsx` — cuatro commits incrementales (A, B, C, D)
- `app/globals.css` — clase `.custom-scrollbar` añadida en commit del Bloque D
- `docs/sprints/SPRINT_2_5_1_MODAL_UX_POLISH.md` — este documento

---

## 6. Commits del sprint

```
c9ebcde feat(sprint-2.5.1): sticky modal header + body scroll lock + custom scrollbar
b8ec491 refactor(sprint-2.5.1): remove redundant bottom close button from appointment modal
167487f feat(sprint-2.5.1): unified close handler with unsaved-changes confirmation
2cf1a56 feat(sprint-2.5.1): add close button (X) to appointment modal header
```

`tsc --noEmit` verde antes y después de cada commit.

---

## 7. Estado de push

`git push` sigue roto por token de GitHub revocado (memoria del proyecto). Los 5 commits del Sprint 2.5.1 quedan locales sobre los 5 del Sprint 2.5 — total **10 commits ahead de `origin/main`** pendientes de subir cuando Octavio rote el token.

---

## 8. Pendientes (no abiertos en este sprint)

Ninguno crítico. La modal queda en estado consistente con el patrón de Stripe/Linear/GitHub: cabe en viewport, header siempre accesible, sin doble scroll, scrollbar discreto, salida protegida frente a cambios sin guardar.

Si en futuras iteraciones aparece un día con 25+ slots y la sección reagendar resulta dominante en exceso, la solución sin reabrir esta decisión sería paginar/agrupar los slots (mañana/tarde) en lugar de reintroducir el scroll interno.
