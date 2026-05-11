# Opus Magna Studio — Plan de Construcción

App SaaS Enterprise para autores que escriben Bestsellers con IA. Diseño lujoso, minimalista (inspirado en Notion/Stripe/Vellum).

## Arquitectura

- **Stack**: TanStack Start (React 19 + Vite) — el template del proyecto.
- **Estilos**: Tailwind v4 + tokens semánticos en `src/styles.css` (oklch).
- **UI**: Shadcn (Button, Card, Dialog, Tabs, Toast/Sonner, Tooltip, DropdownMenu, Input, Textarea, Badge).
- **Iconos**: lucide-react.
- **Estado global**: Zustand para el "Book Object" (autor, capítulos, diseño, marketing).
- **IA**: Lovable AI Gateway vía `createServerFn` (NO se llama Gemini directo desde el cliente). Endpoints en `src/lib/ai.functions.ts` con `LOVABLE_API_KEY` server-side.
- **Imágenes IA**: `google/gemini-3.1-flash-image-preview` para portadas/diagramas.
- **Persistencia**: localStorage + import/export `.opus` JSON backup.

## Diseño / Tokens

- Fondo `#fafafa` (slate-50), tarjetas blancas con sombra suave.
- Acentos: **Indigo oscuro** (primary), **Emerald** (success), **Amber** (acciones IA).
- Tipografías: Inter (UI), Lora/Crimson Pro/Merriweather (preview manuscrito) — Google Fonts.
- Micro-interacciones: transitions, fade+zoom para modales, sonner toasts inferior-derecha.
- Header sticky con marca, contador de palabras, autosave indicator, modo focus.

## Pestañas (Tabs principales)

1. **ADN del Autor** — bio/misión/voz, foto, investigación web (con grounding via search), extracción de Persona Editorial.
2. **Manuscrito** — contexto del libro, generación de estructura, vista corcho/capítulos, editor con barra Markdown, edición IA inline (expandir/reescribir/cita), generación de imágenes inline, snapshots/historial, fact-check, beta-reader crítico, autoescritura completa con cancelación.
3. **Front/Back Matter** — dedicatoria, prólogo, epílogo, agradecimientos.
4. **Diseño & Portada** — agente publicador (rellena metadatos animado), generación de portada IA, spread completo descargable, configuración tipográfica, calculadora regalías (KDP).
5. **Marketing** — kit de lanzamiento (emails PAS, redes AIDA, guion trailer).
6. **Exportar** — modal con KDP/A4/EPUB.

## Archivos a Crear

- `src/styles.css` — design tokens lujosos.
- `src/lib/store.ts` — Zustand store con persistencia.
- `src/lib/ai.functions.ts` — server fns: `aiText`, `aiJson`, `aiImage`, `aiSearch`.
- `src/lib/ai-gateway.ts` — provider helper.
- `src/components/layout/Header.tsx`, `Sidebar.tsx`.
- `src/components/tabs/AuthorDNATab.tsx`
- `src/components/tabs/ManuscriptTab.tsx`
- `src/components/tabs/MatterTab.tsx`
- `src/components/tabs/DesignTab.tsx`
- `src/components/tabs/MarketingTab.tsx`
- `src/components/manuscript/ChapterEditor.tsx`, `Corkboard.tsx`, `MarkdownToolbar.tsx`, `InlineAIBar.tsx`.
- `src/components/modals/*` (Title, History, Export, BetaReader, FactCheck).
- `src/routes/index.tsx` — orquesta el shell + tabs.
- Habilitar **Lovable Cloud** para `LOVABLE_API_KEY`.

## Detalles Técnicos

- Server functions con `createServerFn` + Zod input validation, llamando al gateway con `streamText`/`generateText`.
- Imágenes devueltas como base64 data URI desde el server fn.
- Snapshots persistidos por capítulo (últimos 5).
- Confirm dialogs nativos reemplazados por `<AlertDialog>` shadcn.
- Sonner toasts (ya en root).
- Modo Focus oculta header/sidebar y centra el editor en max-w-3xl.
- Sin claves API en el cliente. Sin `alert()` nativos.

## Verificación

- Build pasa.
- Cada tab renderiza.
- Una llamada IA real (e.g. generar título) funciona.
