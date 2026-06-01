# PRD 02 · Paso 1 — Motor Ikigai Literario

## Objetivo
Convertir el perfil humano del autor (pasión + trayectoria + voz) en **3 Blueprints de Bestseller** validados contra demanda real de Amazon KDP (algoritmo A9), en menos de **30 segundos** desde el primer keystroke.

## User stories
- *"Como coach ejecutiva, quiero contar lo que hago y ver 3 ideas de libro que sé que se venderán."*
- *"Como novelista indie, quiero subir mi CV creativo y que la IA detecte mi nicho subexplotado."*
- *"Como ejecutiva en transición, quiero grabar un audio de 90s describiendo mi vida y que se transcriba e ingiera."*

## Requisitos funcionales
| ID | Requisito |
|----|-----------|
| F-1.1 | Textarea principal con placeholder dinámico (rotativo cada 5s entre 3 ejemplos). |
| F-1.2 | Botón "Subir CV" acepta `.pdf`, `.docx`, `.md`, `.txt` (≤ 5MB). Parser cliente vía `manuscript-parser`. |
| F-1.3 | Botón "Subir audio" acepta `.mp3`, `.wav`, `.m4a` (≤ 25MB). Sube a bucket privado; transcripción Whisper diferida. |
| F-1.4 | Opcional: campo "Tu LinkedIn o blog" → dispara Deep Scraping server fn (Fase 1). |
| F-1.5 | Server fn `aiGenerateBlueprints` retorna **3-5** blueprints. |
| F-1.6 | Cada Blueprint Card muestra: título, subtítulo, sinopsis, niche, demand badge (high/medium/niche), KDP score 0-100, "Por qué tú". |
| F-1.7 | Click en Card → guarda en `bookContext`, `selectBlueprint(id)`, `markStepComplete(1)`, navega a Paso 2. |
| F-1.8 | Toast de éxito con ARIA live region. |

## Requisitos no funcionales
- P95 latencia generación: < 4.5s con streaming opcional (Fase 2).
- Accesibilidad: todos los inputs labeled, focus visible, tab order natural.
- Errores IA: fallback a 3 blueprints stub con disclaimer.

## Contrato del server function

```ts
// src/lib/ai.functions.ts
export const aiGenerateBlueprints = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    passion: z.string().min(10),
    cvText: z.string().optional(),
    audioTranscript: z.string().optional(),
    publicPresence: z.string().optional(),
  }).parse)
  .handler(async ({ data }) => {
    // returns { blueprints: Blueprint[] }
  });

export type Blueprint = {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  niche: string;                     // Amazon KDP category path
  demandBadge: "high" | "medium" | "niche";
  kdpScore: number;                  // 0-100
  whyYou: string;
};
```

## Prompt canónico (resumido)
> "Eres el Motor Ikigai Literario. Cruza el perfil del autor con la demanda del algoritmo A9 de Amazon KDP. Genera 3 blueprints brutalmente honestos. demandBadge='high' si compite con bestsellers actuales; 'niche' si océano azul. KDP score 0-100 sin inflar."

## Deep Scraping (Fase 1 — fuera del MVP)
- Server route `POST /api/public/scrape` (no, mejor server fn) `aiDeepScrape({ url })`.
- Usa `fetch` + parser HTML → extrae bio, headline, últimos posts.
- Para YouTube: transcripción vía caption track pública (sin tocar API privada).
- Datos no se almacenan persistentemente; se usan inline en el prompt.

## A9 / KDP integration (Fase 2)
- Cache diario de top-100 keywords por categoría vía scraping autorizado (`api.scrapfly.io` o partner).
- Tabla `public.kdp_trends (category, keyword, volume, competition, updated_at)`.
- El prompt recibe los top-20 keywords del nicho declarado por el usuario.

## Criterios de aceptación
- [x] Generar 3-5 blueprints en < 5s P95.
- [x] Cards renderizan con badges de color correcto.
- [x] Seleccionar avanza al Paso 2 y persiste selección en Zustand.
- [ ] Fase 1: Whisper transcribe audio < 30s para clip de 90s.
- [ ] Fase 1: Deep Scraping LinkedIn con success rate > 80%.

## Métricas
- `ikigai_blueprints_generated` (count).
- `ikigai_blueprint_selected` (con tier del usuario).
- `ikigai_regenerate` (proxy de insatisfacción).
- `ikigai_time_to_selection` P50/P95.

## Riesgos
- **Calidad IA inconsistente:** mitigar con few-shot examples y validador Zod estricto.
- **Costos token:** Gemini Flash por defecto; Pro solo para tier Empire.
- **Scraping legal:** usar caches de terceros, no scrapear directo.
