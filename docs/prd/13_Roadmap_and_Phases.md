# PRD 13 · Roadmap & Phases

## Fase 0 — Skeleton (HOY · este turno)
**Objetivo:** UI completa del Golden Path navegable, estado global cableado, IA del Paso 1 funcional.

- [x] Store Zustand con `currentStep`, `completedSteps`, `userTier`, `blueprints`.
- [x] Stepper de 6 pasos (gated, animado).
- [x] Paso 1 — Motor Ikigai con `aiGenerateBlueprints` server fn.
- [x] `PricingModal` 4 tiers con decoy pricing.
- [x] `RichEditor` SSR-safe.
- [x] Reutilización de tabs existentes como contenido de pasos 2-6.
- [x] Suite de 15 PRDs en `docs/prd/`.

## Fase 1 — Ikigai real + DNA (sem 1-3)
- Auth real (email + Google) con Supabase.
- Migración del schema (`projects`, `blueprints`, `audits`, `exports`).
- Whisper transcription en `aiTranscribeAudio`.
- OCR multimodal en `aiOCRNotes` (Gemini Pro).
- Deep scraping LinkedIn/blog con allowlist.
- RLS + buckets privados.
- Trial 14 días Pro.

## Fase 2 — Editor pro + Export pro (sem 4-7)
- Tiptap streaming IA (typewriter).
- Auditor en background (worker queue).
- PDF KDP-ready con validador de gutter.
- ePub con TOC navegable.
- ISBN/EAN-13 embebido en cover.
- Stripe live + Customer Portal.
- Dark mode.

## Fase 3 — Launch & Audiolibro (sem 8-11)
- ElevenLabs voice cloning real.
- Render MP3 por capítulo + ZIP de audiolibro completo.
- ACX scripts + SSML descargables.
- Traducción EN/ZH con DNA preservation y sliders.
- Marketing kit (TikTok, blog SEO, emails).

## Fase 4 — Distribución autónoma (sem 12-16)
- API KDP (manual asistido inicialmente).
- IngramSpark integration.
- Apple Books Connect.
- Kobo Writing Life.
- Dashboard de ventas consolidado (Fase 4.5).

## Fase 5 — Inteligencia de mercado (sem 17+)
- KDP trends cron + dashboard de oportunidades.
- A/B testing de portadas con audiencia real (Meta Ads).
- Recomendaciones de relanzamiento (re-cover, re-price).
- Marketplace de ghostwriters humanos para tier Empire+.

## Hiring milestones
- 0 → 2 ingenieros (fundadores).
- Post-seed (Fase 2): +2 full-stack, +1 ML eng, +1 designer.
- Post-Serie A (Fase 4): +6 ingeniería, +3 GTM, +1 head of content.

## Métricas de gate (para subir fase)
- Fase 0 → 1: stepper QA pass.
- Fase 1 → 2: 100 usuarios activos completan Paso 2.
- Fase 2 → 3: 30 libros exportados a PDF KDP.
- Fase 3 → 4: 10 audiolibros rendered.
- Fase 4 → 5: 1k$ MRR pago.
