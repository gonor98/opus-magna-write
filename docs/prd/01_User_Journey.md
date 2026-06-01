# PRD 01 · User Journey & Personas

## Personas

### 1. "Carolina, Coach Ejecutiva" (60% del mercado)
- 38 años, $120k ingresos, 8k seguidores LinkedIn.
- **JTBD:** "Quiero un libro que valide mi autoridad y genere leads para mi consultoría."
- **Dolor:** Empezó tres veces y nunca terminó. No sabe editar ni diseñar.
- **Win:** Manuscrito de 30k palabras listo para KDP en 6 semanas + landing page de captación.

### 2. "Diego, Novelista Indie" (25%)
- 29 años, escritor amateur con borrador de 80k palabras en Google Docs.
- **JTBD:** "Quiero publicar en Amazon sin pagar US$ 4k a un editor freelance."
- **Win:** Importa su .docx → Opus lo audita, mejora, maqueta y publica en KDP/IngramSpark.

### 3. "Elena, Ejecutiva en transición" (15%)
- 51 años, exVP de un Fortune 500, quiere contar su historia.
- **JTBD:** "Quiero dejar un legado y abrir charlas pagadas."
- **Win:** Memoir + audiolibro narrado con su voz clonada + traducción a inglés.

## Golden Path (6 pasos · canónico)

```text
[1] IKIGAI           → [2] AUTHOR DNA     → [3] BESTSELLER MATRIX
     Idea validada       Voz + persona         Estructura Save the Cat
         ↓                    ↓                       ↓
[6] LAUNCH           ← [5] DESIGN & EXPORT ← [4] EDITOR TIPTAP
     Audio + traduc.     Cover + KDP PDF        Co-creación IA
```

Cada paso desbloquea el siguiente. El stepper visualiza progreso. No hay forma de "saltar" el orden (gating UX), pero se puede volver atrás.

## Activation funnel (Fase 1 esperado)
| Etapa | Conversión esperada |
|-------|---------------------|
| Landing → Signup | 12% |
| Signup → Paso 1 completo | 78% |
| Paso 1 → Paso 2 completo | 65% |
| Paso 2 → Paso 3 completo | 54% |
| Paso 3 → Paso 4 (escribiendo) | 47% |
| Paso 4 → Export PDF KDP | 31% |
| Export → Paid plan | 18% |
| Paid → Libro publicado en KDP | 22% |

## Momentos "Aha"
1. **Paso 1, segundo 18:** las 3 cards de Blueprint aparecen con KDP score. → "Esto me conoce."
2. **Paso 4, primera vez que selecciona texto:** el bubble menu IA aparece con "Expandir / Reescribir / Cita". → "Es mi co-autor."
3. **Paso 5, descarga PDF KDP:** abre el PDF, ve gutter perfecto, números de página. → "Esto va a Amazon hoy."

## UX Pillars
- **Cero modales innecesarios.** Solo paywall y export.
- **Toast > banner.** Feedback efímero, no contaminar el canvas.
- **Skeleton states con personalidad.** Nunca un spinner pelado.
- **Undo siempre disponible.** Ctrl+Z funciona globalmente (excepto en Tiptap, donde el editor toma control).
- **Dark mode automático** (Fase 2).

## Métricas de éxito
- **Step Completion Rate** por paso (dashboard interno).
- **Time per Step** P50/P95.
- **AI Acceptance Rate** (cuando IA sugiere texto, % que el usuario acepta sin editar).
- **Cover Regeneration Count** (proxy de fricción en Paso 5).
