# PRD 05 · Paso 4 — Editor Tiptap (Co-creación IA)

## Objetivo
Editor WYSIWYG headless que se siente como Notion + Linear, con IA contextual flotante (bubble menu) que escribe **como el autor** gracias al ADN del Paso 2.

## Stack
- `@tiptap/react` v3 + `@tiptap/starter-kit` + `@tiptap/extension-placeholder`.
- Contenido almacenado como **markdown** en Zustand (`Chapter.content`), convertido a HTML solo para Tiptap (`mdToEditorHtml` / `editorHtmlToMd`).
- SSR-safe vía wrapper `RichEditor.tsx` que monta tras hidratación.

## Componentes
- `RichEditor.tsx` (wrapper SSR-safe).
- `TiptapEditor.tsx` (componente real, ya existe).
- `ChapterSidebar` (lista con drag, add, delete, snapshots).
- `ManuscriptHeader` (título, contador, % vs target).
- `AuditPanel` (existente: `aiAuditManuscript`).

## Bubble Menu (selección de texto)
| Acción | Implementación |
|--------|----------------|
| **B** Bold | `editor.chain().toggleBold().run()` |
| **I** Italic | toggleItalic |
| **H2** | toggleHeading({level:2}) |
| **H3** | toggleHeading({level:3}) |
| **❝** Quote | toggleBlockquote |
| **•** List | toggleBulletList |
| **Expandir** | `aiInlineEdit({text, action:'expand', dna})` |
| **Reescribir** | `aiInlineEdit({text, action:'rewrite', dna})` |
| **Cita bestseller** | `aiInlineEdit({text, action:'bestseller', dna})` |
| **Acortar** | `aiInlineEdit({text, action:'shorten', dna})` |

## Auto-visuals: `[DIAGRAMA_AUTO: prompt]`
- Parser que escanea el contenido y, al detectar el token, renderiza un botón inline "🎨 Generar infografía: {prompt}".
- Click → llama `aiImage({prompt})` → reemplaza el token con `![alt](dataUrl)`.

## Snapshots
- Cada vez que IA sobrescribe contenido o el usuario hace "Save snapshot", `saveSnapshot(id, type)` push al array (max 8).
- UI: HistoryPanel con preview y restore.

## Auditor (existente)
- `aiAuditManuscript` retorna `AuditReport` con scores y recomendaciones accionables.
- Cada recomendación tiene un botón "Aplicar" que llama `aiHumanize` o `aiRewrite` sobre el snippet.

## Atajos de teclado
- `⌘B`, `⌘I`, `⌘⇧2`, `⌘⇧3` nativos de Tiptap.
- `⌘E` → expandir selección con IA.
- `⌘⇧R` → reescribir.
- `⌘Z` / `⌘⇧Z` undo/redo nativo Tiptap (no Zustand).

## Performance
- Debounce de `onMarkdownChange` a 400ms para evitar re-render del store en cada keystroke.
- Snapshots solo si el contenido cambió desde el último.

## Criterios de aceptación
- [ ] Escribir 5k palabras sin lag (< 16ms por keystroke).
- [ ] Bubble menu aparece en < 100ms tras selección.
- [ ] IA "Expandir" preserva tono del autor (validado con DNA bible).
- [ ] Snapshots persisten entre sesiones (Zustand persist).
