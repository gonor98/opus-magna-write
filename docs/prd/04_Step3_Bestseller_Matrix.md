# PRD 04 · Paso 3 — Bestseller Matrix

## Objetivo
Generar la **estructura completa del libro** (índice de capítulos + premisas) aplicando estructuras dramáticas probadas (*Save the Cat!* para ficción, *McKee* para no-ficción) con ritmo calibrado para retención psicológica máxima.

## Inputs
- `bookContext` (del Paso 1).
- `authorDNA` (del Paso 2).
- Configuración usuario: `chapterCount` (5-30), `genre` (no-fiction|memoir|fiction|self-help|business), `targetReader` (texto libre).

## Output
```ts
type ChapterPlan = {
  title: string;
  description: string;     // 2-3 sentences premise
  beat: string;            // Save the Cat beat (e.g., "Catalyst", "All Is Lost")
  estimatedWords: number;  // for pacing
};
```

## Server function
`aiStructure` (ya existe — extender con `genre` y `beat` mapping):

```ts
prompt = `
Eres editor jefe de Penguin Random House especializado en ${genre}.
Aplica la estructura ${genre === 'fiction' ? 'Save the Cat (15 beats)' : 'McKee 3-act + 7 estaciones'}.
Devuelve ${chapterCount} capítulos. Cada uno con beat correspondiente y palabras estimadas.
Total objetivo: ${chapterCount * 2500} palabras.

ADN DEL AUTOR: ${authorDNA.extractedPersona.slice(0, 2000)}
LIBRO: ${bookContext.title} — ${bookContext.subtitle}
`;
```

## UX
- Slider para `chapterCount`.
- Select para `genre`.
- Input para `targetReader`.
- Botón "Generar Matrix" → renderiza tabla con drag-to-reorder, edit inline de título/premisa, botón "Regenerar este capítulo".
- Validador visual: total de palabras estimadas vs target del nicho (e.g., self-help bestseller: 45-65k words).

## Validadores
- Cada beat de Save the Cat aparece al menos 1 vez (si fiction).
- No duplicados de título.
- Cada premisa > 80 caracteres.

## Criterios de aceptación
- [ ] Generar 12 capítulos en < 6s.
- [ ] Reordenar capítulos con drag-and-drop (existe `moveChapter`).
- [ ] Regenerar capítulo individual sin perder el resto.
- [ ] Total palabras estimadas dentro del rango del nicho.

## Métricas
- `matrix_generated` (con genre).
- `matrix_chapter_regenerated`.
- `matrix_avg_word_target`.
