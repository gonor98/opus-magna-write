# PRD 06 · Paso 5 — Diseño & Export (Cover Engine + KDP-ready)

## Objetivo
Producir archivos **listos para imprimir y vender** en Amazon KDP, IngramSpark, Apple Books, Kobo, y archivo Word editable. Cero intervención humana posterior necesaria.

## Sub-módulos

### A. Cover Engine
- Server fn `aiCoverPrompt` genera prompt visual basado en `bookContext.title/subtitle/niche` + arquetipo del Paso 2.
- Server fn `aiImage` (Gemini 3.1 Flash Image / Nano Banana) genera 4 variantes 1024×1536 (proporción KDP 6×9").
- Usuario elige una; opcionalmente reemplaza con upload propio.
- Componente `CoverSpread.tsx` (existente) compone frontal + lomo + contraportada con barcode EAN-13 (`bwip-js`) si ISBN presente.

### B. Tipografía y maquetación
- `DesignConfig`: `font` (Lora|Crimson Pro|Merriweather|Montserrat), `size` (10-12pt), `lineHeight` (1.3-1.7), `chapterTheme` (classic|modern|luxe).
- Preview WYSIWYG con la fuente seleccionada inyectada vía CSS.

### C. Export PDF KDP-ready
- Render en **iframe oculto** con `@page` CSS rules:
  ```css
  @page {
    size: 6in 9in;
    margin: 0.75in 0.5in 0.75in 0.875in; /* top right bottom left con gutter */
    @top-center { content: counter(page); }
  }
  @page :left { margin-left: 0.5in; margin-right: 0.875in; }
  @page :right { margin-left: 0.875in; margin-right: 0.5in; }
  ```
- Trigger via `window.print()` con CSS print profile.
- Validador KDP: páginas múltiplos de 2, gutter mínimo 0.375" para 100-300 páginas (1.6"), 0.625" para 301-500 páginas.

### D. Export DOCX (Manuscrito Word)
- Lib `docx` v9.
- Mapea markdown → Word styles nativos (`HeadingLevel.HEADING_1/2`, listas, blockquotes, horizontal rules decorativas).
- Front matter (Title page, Copyright, Dedication) + Body + Back matter (Epilogue, About author, Acknowledgments).
- Tamaño página: Letter (US) o A4 (configurable).

### E. Export ePub (Fase 1)
- Lib `epub-gen-memory` o construcción manual con JSZip.
- TOC navegable, metadata Dublin Core, cover embebido.

### F. ISBN / EAN-13
- Input ISBN; validador checksum.
- `bwip-js` genera código EAN-13 SVG → embebido en contraportada.

## Server functions
- `aiCoverPrompt({ bookContext, dna }) → { prompt }`
- `aiImage({ prompt, size: "1024x1536" }) → { dataUrl }`

## Criterios de aceptación
- [ ] Generar 4 covers en < 30s.
- [ ] PDF descargado abre en Acrobat con gutter correcto y números de página.
- [ ] DOCX abre en Word con TOC funcional y estilos.
- [ ] EAN-13 escanea correctamente con apps de barcode.

## Métricas
- `export_pdf_completed`, `export_docx_completed`, `export_epub_completed`.
- `cover_regenerate_count`.
- `export_total_size_mb`.
