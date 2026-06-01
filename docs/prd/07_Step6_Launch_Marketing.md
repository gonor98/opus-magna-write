# PRD 07 · Paso 6 — Launch & Marketing

## Objetivo
Producir todo el material de lanzamiento (audiolibro, traducciones, scripts sociales, blog SEO, emails) y preparar la distribución multi-canal.

## Sub-módulos

### A. Audiolibro ACX
- Server fn `aiACXScript({ chapters, voiceHint })` produce script con marcadores ACX estándar:
  - `[PAUSA: 2s]`, `[RESPIRA]`, `[TONO: cálido]`, `[PRON: María /ma'ɾi.a/]`
  - Máx 70 palabras por toma (155 WPM target).
- Conversión a SSML 1.1: `acxToSSML()` mapea a `<break>`, `<prosody>`, `<phoneme>`.
- Validador `validateACXChapter()` da checklist por capítulo.
- **Voice clone (Fase 2):** integración ElevenLabs.
  - Endpoint: `POST /api/elevenlabs/clone` (envuelve API ElevenLabs).
  - Subida de muestra 1-3 min → voiceId.
  - Render audio por capítulo en MP3 192kbps.
  - Mientras tanto: Web Speech API mock con modulación pitch/rate.

### B. Traducción con DNA Preservation
- Server fn `aiTranslate({ markdown, targetLang: 'en'|'zh', dna, literalness, tone, style })`.
- Prompt clave: "Preserva los modismos, ironía y ADN del autor. Transcrea, no traduzcas literal. literalness=0.3 muy creativo / 0.9 muy fiel."
- Output: nuevo `chapters` paralelo en idioma destino.

### C. Marketing kit
- TikTok / Reels: `aiSocialScript({ chapter, format: 'tiktok-45s' })`.
- Blog SEO: `aiBlogPost({ topic, keywords, words: 1500 })`.
- Email launch sequence: 5 emails (anuncio, anclaje, social proof, urgencia, día de lanzamiento).

### D. Distribución (Fase 3)
| Canal | Integración |
|-------|-------------|
| Amazon KDP | Upload PDF + Cover via API privada (manual mientras tanto). |
| IngramSpark | Spec sheet + ISBN + archivos a `ingest@ingramspark`. |
| Apple Books | iTunes Producer / Books Connect. |
| Google Play Books | Partner Center. |
| Kobo Writing Life | API directa. |
| ACX (audio) | Upload manual; portal Audible. |

## Compliance
- Toda obra IA-asistida lleva watermark legal en página de créditos: *"Contenido producido con asistencia de IA generativa."*

## Criterios de aceptación
- [ ] Script ACX cumple checklist (70w/toma, pausas, secciones).
- [ ] SSML por capítulo descargable y válido contra esquema W3C.
- [ ] Traducción en/zh preserva 3 muletillas del autor (test manual).
- [ ] Marketing kit genera 5 piezas en < 60s.

## Métricas
- `acx_scripts_generated`, `acx_validation_pass_rate`.
- `translation_languages` (count by lang).
- `marketing_kit_pieces_generated`.
- `audiobook_minutes_rendered` (Fase 2).
