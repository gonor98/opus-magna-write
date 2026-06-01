# PRD 08 · AI Stack

## Gateway
**Lovable AI Gateway** — wrapper unificado, sin necesidad de API keys del usuario.
- Implementación: `src/lib/ai-gateway.ts` (provider AI SDK estilo OpenAI compatible).
- Env: `LOVABLE_API_KEY` (server-only).

## Modelo routing por tarea

| Tarea | Modelo default | Modelo Empire | Razón |
|-------|----------------|---------------|-------|
| Blueprints Ikigai | `google/gemini-3-flash-preview` | `google/gemini-2.5-pro` | rápido + creativo |
| Persona synthesis | `google/gemini-2.5-flash` | `openai/gpt-5` | razonamiento estructurado |
| Estructura capítulos | `google/gemini-3-flash-preview` | `google/gemini-2.5-pro` | balance |
| Escritura de capítulo | `google/gemini-2.5-pro` | `openai/gpt-5` | calidad prosa |
| Bubble menu inline | `google/gemini-2.5-flash-lite` | `google/gemini-2.5-flash` | latencia |
| Auditor manuscrito | `google/gemini-2.5-pro` | `openai/gpt-5.4` | reasoning |
| ACX script | `google/gemini-2.5-flash` | `openai/gpt-5` | formato estricto |
| Traducción | `google/gemini-2.5-pro` | `openai/gpt-5.4` | calidad cross-cultural |
| OCR notas | `google/gemini-2.5-pro` (multimodal) | mismo | único capaz |
| Transcripción audio | Whisper-1 (vía gateway) | mismo | estándar |
| Generación portada | `google/gemini-3.1-flash-image-preview` | `google/gemini-3-pro-image-preview` | calidad |

## Rate limits por tier
| Tier | Tokens/día | Imágenes/día |
|------|-----------|--------------|
| FREE | 50k | 4 |
| PRO | 500k | 40 |
| PUBLISHER | 2M | 150 |
| EMPIRE | ilimitado fair-use | ilimitado fair-use |

## Fallback strategy
1. Si modelo primario falla (429/500) → retry con backoff exponencial (3 intentos).
2. Si sigue fallando → fallback al siguiente modelo de la familia (Pro → Flash → Flash-Lite).
3. Si todo falla → respuesta stub + toast al usuario.

## Prompt engineering principles
- **System prompts cortos**, ricos en rol y restricciones.
- **Schemas Zod** siempre para outputs estructurados (`generateObject`).
- **Few-shot mínimo**, preferir descripción de criterios.
- **DNA inyectado en cada generación** de contenido del libro.

## Streaming
- Fase 2: bubble menu y generación de capítulos usan `streamText` con UI tipo "typewriter".
- Reduce percepción de latencia ~60%.

## Observabilidad
- Log estructurado en server fns: `{ fn, model, tokens, ms, status }`.
- Dashboard interno (Fase 2) con costo por usuario / por tarea.
