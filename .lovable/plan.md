# Plan — Opus Magna Studio V11 "Golden Path" Skeleton + PRD Suite

## Contexto
El proyecto ya tiene una base sólida (TanStack Start, Tiptap, Zustand, export DOCX/PDF/ePub, ACX, audit, uploads a Cloud Storage). Vamos a **reorganizar** la UX existente alrededor del **Golden Path lineal de 6 pasos** definido en `Opus_Magna_Master_PRD_V11.md`, sin tirar lo construido. También entregaremos una **suite de PRDs** dentro de `/docs` y como artefactos descargables en `/mnt/documents`.

> Nota: no usaremos `npm install` literal — la stack es TanStack Start + Bun. Las deps clave (`@tiptap/*`, `docx`, `bwip-js`, `sonner`, `lucide-react`, `@supabase/supabase-js`) ya están instaladas. Añadiré `vite-plugin-pwa` y `bwip-js` si faltan. No usaré React Router DOM.

---

## Parte A — Skeleton Golden Path (código)

### 1. Estado global (`src/lib/store.ts`)
Extender (no romper) el store actual:
- `currentStep: 1..6`, `completedSteps: Set<number>`, `setStep`, `markStepComplete`
- `userTier: 'FREE' | 'PRO' | 'PUBLISHER' | 'EMPIRE'`
- `blueprints: Blueprint[]` (resultado del Motor Ikigai) + `selectedBlueprintId`
- `authorDNA` ya existe — añadir `audioSamples: AssetRef[]`, `ocrNotes: string`
- Persistencia: mantener `persist` actual; excluir blueprints volátiles

### 2. Layout + Stepper
- Nuevo `src/components/layout/GoldenPathStepper.tsx`: barra superior estilo Linear, 6 nodos numerados con estado (locked / current / done), animación de progreso, navegación bloqueada hacia pasos no desbloqueados
- Refactor de `src/routes/index.tsx` para usar el Stepper en vez de los Tabs actuales; cada step renderiza un componente

### 3. Rutas de los 6 pasos (file-based, sin romper `/`)
Mantenemos `/` como shell. Cada paso vive en una sub-ruta para deep-linking y SSR-meta propias:
- `/routes/step.ikigai.tsx` → Paso 1
- `/routes/step.dna.tsx` → Paso 2 (reutiliza `AuthorDNATab`)
- `/routes/step.matrix.tsx` → Paso 3 (reutiliza estructura/capítulos)
- `/routes/step.editor.tsx` → Paso 4 (Tiptap, reutiliza `TiptapEditor` + audit)
- `/routes/step.design.tsx` → Paso 5 (portada, tipografía, export)
- `/routes/step.launch.tsx` → Paso 6 (marketing, ACX, traducción, paywall)
- Cada ruta con `head()` propio (title/description/og)
- `routeTree.gen.ts` se regenera solo

### 4. Paso 1 — Motor Ikigai (`src/components/steps/IkigaiEngine.tsx`)
- Textarea grande "¿A qué te dedicas o qué te apasiona?"
- Botones: subir CV (.pdf/.docx → `manuscript-parser`), subir audio (.mp3/.wav → almacenamiento Cloud)
- Server fn nueva `aiGenerateBlueprints` en `src/lib/ai.functions.ts` que devuelve 3-5 blueprints `{ title, subtitle, synopsis, demandBadge: 'high'|'medium'|'niche', niche, kdpScore }`
- Tarjetas glassmorphism con CTA "Elegir este bestseller" → guarda en `bookContext` + `markStepComplete(1)` + navega a step 2

### 5. Paso 4 — Editor (`src/components/RichEditor.tsx`)
- Wrapper SSR-safe sobre el `TiptapEditor` existente, con `'use client'` semántico (comentario; no es Next)
- Floating bubble menu: Bold, Italic, H1, H2, Quote, + acciones IA ("Expandir", "Reescribir", "Cita bestseller")
- Parser inline para `[DIAGRAMA_AUTO: ...]` → botón "Generar infografía"

### 6. Paywall (`src/components/PricingModal.tsx`)
- Dialog 4 columnas: Gratis $0, Pro $49, Publisher $119, **Empire $149** (ring-primary, badge "Mejor Valor", glow)
- Decoy pricing: Publisher visualmente menos atractivo que Empire
- Hook desde Header (botón "Upgrade") y desde acciones bloqueadas por tier

### 7. Design system
- Asegurar tokens Linear/Vercel en `src/styles.css`: `--surface-glass`, `--shadow-soft`, `--ring-primary-glow`
- Fuente Inter para UI (ya), serif para editor (ya)

### 8. Compatibilidad
- Mantener componentes actuales (`MarketingTab`, `DesignTab`, `ExportModal`, `MatterTab`) como contenido interno de los nuevos steps — cero pérdida de features
- Tabs antiguos accesibles vía modo "Pro view" (toggle en Header)

---

## Parte B — Suite de PRDs (documentación)

Crear en `docs/prd/` y exportar copias a `/mnt/documents/opus-magna-prd/`:

1. **00_Vision_and_Meta.md** — Visión, misión, mercado (TAM/SAM/SOM), posicionamiento vs Vellum/Atticus/Reedsy
2. **01_User_Journey.md** — Personas (Coach, Novelista, Ejecutivo), journey mapping de los 6 pasos, métricas de activación, drop-off esperado, NSM
3. **02_Step1_Ikigai_Engine.md** — Inputs, deep-scraping (LinkedIn/blog/YouTube vía edge fn), fusión con A9/KDP, prompt engineering, schema de Blueprint, criterios de "demand badge"
4. **03_Step2_AuthorDNA.md** — Voice-to-DNA (Whisper), Vision OCR (Gemini 2.5 Pro multimodal), pipeline de extracción de persona, almacenamiento en bucket privado
5. **04_Step3_Bestseller_Matrix.md** — Save the Cat beats, generación de TOC, pacing, prompts y validadores
6. **05_Step4_Editor.md** — Tiptap extensions, floating menu IA, diagramas auto, snapshots, undo/redo, auditor de manuscrito
7. **06_Step5_Design_Export.md** — Portada (Gemini image), KDP PDF con `@page` + gutter asimétrico, DOCX styles, ePub, ISBN/EAN-13 con bwip-js, perfiles de impresión
8. **07_Step6_Launch_Marketing.md** — TikTok/Reels scripts, blog SEO, ACX + SSML, ElevenLabs voice clone, traducción con DNA preservation, distribución (KDP/IngramSpark/Apple)
9. **08_AI_Stack.md** — Modelos Lovable AI Gateway (Gemini 2.5 Pro/Flash, GPT-5, Nano Banana), routing por tarea, costos por tier, fallback, rate limits, prompts canónicos
10. **09_Backend_Architecture.md** — TanStack server fns vs server routes, Supabase schema (proyectos, blueprints, chapters, assets, audits, exports), RLS, GRANTs, Storage buckets, edge cron
11. **10_Design_System.md** — Tokens oklch, tipografía, glassmorphism, motion (Motion for React), accesibilidad WCAG AA, dark mode
12. **11_Monetization_and_Paywall.md** — 4 tiers, decoy pricing, gating por feature, Stripe/Polar, trial, upgrade prompts contextuales
13. **12_Security_and_Compliance.md** — RLS, copyright/IP, GDPR, AI disclosure, watermark "[Contenido asistido por IA]"
14. **13_Roadmap_and_Phases.md** — Fase 0 (skeleton — este turno), Fase 1 (Ikigai real + DNA), Fase 2 (Editor pro), Fase 3 (Export + portada), Fase 4 (Launch + audiolibro), Fase 5 (Distribución autónoma)
15. **INDEX.md** — índice navegable

Cada PRD incluye: objetivo, user stories, requisitos funcionales/no funcionales, contratos de API/server fn (con TypeScript types), schemas Zod, prompts IA literales, criterios de aceptación, métricas, riesgos.

Tamaño objetivo: 800-1500 palabras por PRD, ~15-20k palabras totales.

---

## Detalles técnicos

- **Stack:** TanStack Start (no Vite plano), Bun (no npm), React 19, Tailwind v4, Shadcn, Zustand, Tiptap, Supabase (vía Lovable Cloud), Lovable AI Gateway
- **No tocar:** `client.ts`, `client.server.ts`, `types.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `.env`, `routeTree.gen.ts` (autogen)
- **Server fns nuevas:** `aiGenerateBlueprints`, `aiDeepScrape` (mock), `aiTranscribeAudio` (mock con stub Whisper-ready), `aiOCRNotes` (mock multimodal)
- **Migración DB:** añadir tabla `blueprints` opcional (puedo posponer si prefieres mantenerlo solo en Zustand este turno — recomendado para Fase 0)
- **Verificación:** typecheck implícito por build runner; QA visual del stepper en preview

---

## Entregables de este turno

1. Skeleton Golden Path funcional (Stepper + 6 rutas + Paso 1 cableado + PricingModal + RichEditor refactor)
2. 15 archivos PRD en `docs/prd/` + copias en `/mnt/documents/opus-magna-prd/` como artefactos descargables
3. Mantener todas las features actuales accesibles

## Fuera de alcance (siguiente turno)
- Cover Engine real, Deep Scraping real, integración Stripe/Polar, edge cron de tendencias, ElevenLabs real, distribución KDP API
