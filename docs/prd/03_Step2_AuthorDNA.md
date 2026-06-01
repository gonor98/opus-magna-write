# PRD 03 · Paso 2 — Author DNA (Clonación de Identidad Multimodal)

## Objetivo
Capturar la "huella estilística" del autor (voz, ritmo, modismos, valores, prohibiciones) en un objeto `AuthorDNA` reusable por todos los prompts de escritura. Sin esto, la IA escribe genérico; con esto, escribe **como el autor**.

## Subsistemas

### A. Voice-to-DNA
- Input: notas de voz `.mp3`/`.m4a`/`.ogg` (típicamente WhatsApp exports).
- Pipeline: subida a bucket privado `voice-samples/{userId}/` → server fn `aiTranscribeAudio({ assetPath })` → Whisper-1 (OpenAI) o `gemini-2.5-flash` multimodal → texto + análisis prosódico (muletillas, pausas marcadas con `[...]`, tono dominante).
- Salida: agregada a `authorDNA.voiceSamples` (string concatenado, max 8k chars).

### B. Vision OCR de apuntes
- Input: fotos de cuadernos, mapas mentales, post-its.
- Pipeline: subida → `aiOCRNotes({ imagePaths[] })` con `google/gemini-2.5-pro` multimodal → extracción + estructuración → `authorDNA.extractedPersona` y/o `storyBible`.
- Soporta caligrafía cursiva en español/inglés.

### C. Bio + Misión + Foto
- Inputs estructurados (textareas + file picker).
- Foto opcional (max 2MB, jpg/png) → dataURL en `authorDNA.photoDataUrl` (usado en back cover y página "Sobre el autor").

### D. Persona Synthesis
- Server fn existente `aiPersona` consume todo y devuelve un **Voice & Tone Bible** en markdown con 4 secciones: Arquetipo, Ritmo, Vocabulario, Prohibiciones.

## State shape
```ts
type AuthorDNA = {
  bio: string;
  mission: string;
  voiceSamples: string;         // concatenated transcriptions
  extractedPersona: string;     // markdown bible from aiPersona
  photoDataUrl?: string | null;
  audioSamples?: AssetRef[];    // pointers a Cloud Storage
  ocrNotes?: string;            // raw OCR output
};
```

## Storage & RLS
- Bucket privado `voice-samples` (existente: `book-uploads`).
- Path: `{device_id}/voice/{uuid}.mp3` y `{device_id}/notes/{uuid}.jpg`.
- Signed URLs con TTL 1h.
- Migración Fase 1 cuando agreguemos auth real: cambiar `device_id` → `user_id`.

## Server functions
| Nombre | Método | Tipo |
|--------|--------|------|
| `aiTranscribeAudio` | POST | Whisper transcription |
| `aiOCRNotes` | POST | Gemini Pro multimodal OCR |
| `aiPersona` | POST | Persona bible synth (ya existe) |

## UX
- Card "Cuéntanos quién eres" (bio, misión, foto).
- Card "Tu voz" con drop zone para audios. Por cada audio: preview HTML5 player + transcripción colapsable.
- Card "Tus apuntes" con upload múltiple de imágenes.
- Botón final: "🧬 Sintetizar mi ADN" → corre `aiPersona`, muestra bible en markdown, marca step completo.

## Criterios de aceptación
- [ ] Subir 3 audios y ver transcripción combinada.
- [ ] Subir 2 fotos de notas y ver texto extraído.
- [ ] El "Voice Bible" generado se inyecta en todos los prompts de generación de capítulos.
- [ ] Bucket privado, signed URLs, no exposición pública.

## Métricas
- `dna_voice_samples_added` (avg per user).
- `dna_ocr_uploads`.
- `dna_synthesis_completed`.
- `dna_inferred_quality_score` (heurística: longitud + diversidad léxica).
