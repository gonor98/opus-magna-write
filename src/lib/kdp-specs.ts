/**
 * Amazon KDP specifications + validators.
 *
 * Sources (KDP help center, last revised 2025):
 *  - Print cover calculator: spine width = pages * paper_thickness
 *  - Bleed required for cover/print interior: 0.125" all sides
 *  - Safe area inside trim: 0.25" (text/critical art must clear)
 *  - Min DPI for print: 300 DPI at trim size
 *  - eBook cover (KDP/Kindle): 2560 × 1600 px (1.6:1 ratio), JPG/TIFF, RGB, < 50 MB
 *  - Trim sizes most used for non-fiction: 6x9, 5.5x8.5, 5x8
 *  - Paper thickness (in): white = 0.002252, cream = 0.0025, color = 0.002347
 *  - Gutter (KDP minimum): 24–150p → 0.375"; 151–300 → 0.5"; 301–500 → 0.625"; 501–700 → 0.75"; 701–828 → 0.875"
 */

export type TrimKey = "6x9" | "5.5x8.5" | "5x8" | "8.5x11";
export type PaperKey = "white" | "cream" | "color";

export const TRIM_PRESETS: Record<TrimKey, { wIn: number; hIn: number; label: string }> = {
  "6x9":     { wIn: 6,   hIn: 9,    label: 'Trade paperback (6 × 9")' },
  "5.5x8.5": { wIn: 5.5, hIn: 8.5,  label: 'Digest (5.5 × 8.5")' },
  "5x8":     { wIn: 5,   hIn: 8,    label: 'Mass-market (5 × 8")' },
  "8.5x11":  { wIn: 8.5, hIn: 11,   label: 'Letter / workbook (8.5 × 11")' },
};

export const PAPER_THICKNESS: Record<PaperKey, number> = {
  white: 0.002252,
  cream: 0.0025,
  color: 0.002347,
};

export const KDP_BLEED = 0.125;
export const KDP_SAFE = 0.25;
export const KDP_MIN_DPI = 300;
export const EBOOK_COVER = { w: 2560, h: 1600, ratio: 1.6 };

export function gutterFor(pages: number): number {
  if (pages <= 150) return 0.375;
  if (pages <= 300) return 0.5;
  if (pages <= 500) return 0.625;
  if (pages <= 700) return 0.75;
  return 0.875;
}

export function spineWidth(pages: number, paper: PaperKey = "white"): number {
  return +(pages * PAPER_THICKNESS[paper]).toFixed(4);
}

export type CoverSpec = {
  trim: TrimKey;
  paper: PaperKey;
  pages: number;
  spineIn: number;
  /** Final flattened spread including bleed (cover + spine + back) */
  spreadWidthIn: number;
  spreadHeightIn: number;
  /** Pixel dimensions @ 300 DPI for print-ready upload */
  spreadWidthPx: number;
  spreadHeightPx: number;
  /** Single front cover only (used for ebook KDP) */
  frontPxWidth: number;
  frontPxHeight: number;
  gutterIn: number;
  bleedIn: number;
  safeIn: number;
};

export function buildCoverSpec(
  trim: TrimKey,
  pages: number,
  paper: PaperKey = "white",
): CoverSpec {
  const t = TRIM_PRESETS[trim];
  const spine = spineWidth(pages, paper);
  const spreadW = t.wIn * 2 + spine + KDP_BLEED * 2;
  const spreadH = t.hIn + KDP_BLEED * 2;
  return {
    trim,
    paper,
    pages,
    spineIn: spine,
    spreadWidthIn: +spreadW.toFixed(4),
    spreadHeightIn: +spreadH.toFixed(4),
    spreadWidthPx: Math.round(spreadW * KDP_MIN_DPI),
    spreadHeightPx: Math.round(spreadH * KDP_MIN_DPI),
    frontPxWidth: Math.round((t.wIn + KDP_BLEED * 2) * KDP_MIN_DPI),
    frontPxHeight: Math.round((t.hIn + KDP_BLEED * 2) * KDP_MIN_DPI),
    gutterIn: gutterFor(pages),
    bleedIn: KDP_BLEED,
    safeIn: KDP_SAFE,
  };
}

/* -------------------- Validators -------------------- */

export type Finding = {
  id: string;
  level: "ok" | "warn" | "error";
  label: string;
  detail?: string;
};

export type ValidationReport = {
  ok: boolean;
  warnings: number;
  errors: number;
  findings: Finding[];
};

const finish = (findings: Finding[]): ValidationReport => ({
  findings,
  warnings: findings.filter((f) => f.level === "warn").length,
  errors: findings.filter((f) => f.level === "error").length,
  ok: !findings.some((f) => f.level === "error"),
});

/** Validate a raw image data URL or HTMLImageElement-style {w,h} against KDP cover specs. */
export async function validateCoverImage(
  dataUrl: string,
  spec: CoverSpec,
  side: "front" | "spread" = "front",
): Promise<ValidationReport> {
  const findings: Finding[] = [];
  const dims = await imageDims(dataUrl).catch(() => null);
  if (!dims) {
    return finish([
      { id: "decode", level: "error", label: "No se pudo decodificar la imagen de portada" },
    ]);
  }
  const targetW = side === "spread" ? spec.spreadWidthPx : spec.frontPxWidth;
  const targetH = side === "spread" ? spec.spreadHeightPx : spec.frontPxHeight;
  const ratio = dims.w / dims.h;
  const targetRatio = targetW / targetH;

  if (dims.w < targetW * 0.95 || dims.h < targetH * 0.95) {
    findings.push({
      id: "size",
      level: "error",
      label: `Resolución insuficiente (${dims.w}×${dims.h}px)`,
      detail: `KDP exige ≥ ${targetW}×${targetH}px (300 DPI) para ${spec.trim}".`,
    });
  } else if (dims.w < targetW || dims.h < targetH) {
    findings.push({
      id: "size",
      level: "warn",
      label: `Borde justo: ${dims.w}×${dims.h}px vs ${targetW}×${targetH}px`,
      detail: "Sube una versión a 300 DPI exactos para evitar interpolación.",
    });
  } else {
    findings.push({ id: "size", level: "ok", label: `Resolución OK · ${dims.w}×${dims.h}px @ 300 DPI` });
  }

  if (Math.abs(ratio - targetRatio) / targetRatio > 0.02) {
    findings.push({
      id: "ratio",
      level: "warn",
      label: `Proporción ${ratio.toFixed(3)} vs ${targetRatio.toFixed(3)} esperada`,
      detail: "KDP rellenará o recortará; evita texto cerca del borde.",
    });
  } else {
    findings.push({ id: "ratio", level: "ok", label: "Proporción correcta para el trim seleccionado" });
  }

  // ebook check
  const ebookRatio = EBOOK_COVER.ratio;
  if (Math.abs(ratio - 1 / ebookRatio) / (1 / ebookRatio) < 0.02 && dims.h >= EBOOK_COVER.w * 0.95) {
    findings.push({ id: "ebook", level: "ok", label: "También válida como portada Kindle (2560×1600)" });
  }

  return finish(findings);
}

function imageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/* -------------------- Manuscript validators -------------------- */

export type ManuscriptInput = {
  title: string;
  author: string;
  description: string;
  keywords: string;
  isbn?: string;
  chapters: { title: string; content: string }[];
  hasCover: boolean;
};

export function validateManuscriptForKDP(m: ManuscriptInput): ValidationReport {
  const f: Finding[] = [];
  if (!m.title?.trim()) f.push({ id: "title", level: "error", label: "Falta el título del libro" });
  else f.push({ id: "title", level: "ok", label: `Título: "${m.title}"` });

  if (!m.author?.trim()) f.push({ id: "author", level: "error", label: "Falta nombre del autor" });
  else f.push({ id: "author", level: "ok", label: `Autor: ${m.author}` });

  const desc = (m.description || "").trim();
  if (!desc) f.push({ id: "desc", level: "error", label: "Falta sinopsis (descripción KDP)" });
  else if (desc.length < 200) f.push({ id: "desc", level: "warn", label: `Sinopsis corta (${desc.length} caracteres)`, detail: "KDP recomienda 200–4000 chars con HTML." });
  else if (desc.length > 4000) f.push({ id: "desc", level: "error", label: `Sinopsis supera 4000 caracteres (${desc.length})` });
  else f.push({ id: "desc", level: "ok", label: `Sinopsis OK (${desc.length} chars)` });

  const kw = (m.keywords || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  if (kw.length < 3) f.push({ id: "kw", level: "warn", label: `${kw.length}/7 keywords KDP`, detail: "KDP permite hasta 7 keywords; usa al menos 5." });
  else if (kw.length > 7) f.push({ id: "kw", level: "warn", label: `${kw.length} keywords (KDP solo lee 7)` });
  else f.push({ id: "kw", level: "ok", label: `${kw.length} keywords` });

  if (m.isbn) {
    const clean = m.isbn.replace(/[-\s]/g, "");
    if (!/^\d{13}$/.test(clean)) f.push({ id: "isbn", level: "warn", label: "ISBN no es de 13 dígitos", detail: "KDP acepta sin ISBN; si lo añades, formato EAN-13." });
    else f.push({ id: "isbn", level: "ok", label: `ISBN ${clean}` });
  }

  if (!m.chapters.length) f.push({ id: "chs", level: "error", label: "No hay capítulos" });
  else {
    const empty = m.chapters.filter((c) => !c.content?.trim()).length;
    if (empty) f.push({ id: "chs", level: "error", label: `${empty}/${m.chapters.length} capítulos sin contenido` });
    else f.push({ id: "chs", level: "ok", label: `${m.chapters.length} capítulos con contenido` });
    const totalWords = m.chapters.reduce((a, c) => a + c.content.trim().split(/\s+/).filter(Boolean).length, 0);
    if (totalWords < 10000) f.push({ id: "len", level: "warn", label: `Manuscrito corto: ${totalWords.toLocaleString()} palabras`, detail: "KDP no impone mínimo, pero <10k suele clasificarse como folleto." });
    else f.push({ id: "len", level: "ok", label: `${totalWords.toLocaleString()} palabras totales` });
  }

  if (!m.hasCover) f.push({ id: "cover", level: "error", label: "Falta portada principal" });
  else f.push({ id: "cover", level: "ok", label: "Portada principal presente" });

  return finish(f);
}

/** EPUB-specific structural check (run against an exported blob if needed). */
export function validateEpubManifest(opts: {
  hasNav: boolean;
  hasCover: boolean;
  spineCount: number;
  hasMetadataTitle: boolean;
  hasMetadataAuthor: boolean;
  hasLanguage: boolean;
}): ValidationReport {
  const f: Finding[] = [];
  f.push({ id: "nav", level: opts.hasNav ? "ok" : "error", label: opts.hasNav ? "TOC navegable (nav.xhtml)" : "Falta nav.xhtml (TOC EPUB 3)" });
  f.push({ id: "cover", level: opts.hasCover ? "ok" : "warn", label: opts.hasCover ? "Portada embebida" : "EPUB sin portada — Apple Books la rechazará" });
  f.push({ id: "spine", level: opts.spineCount > 0 ? "ok" : "error", label: `Spine: ${opts.spineCount} ítems` });
  f.push({ id: "meta-title", level: opts.hasMetadataTitle ? "ok" : "error", label: opts.hasMetadataTitle ? "dc:title presente" : "Falta dc:title" });
  f.push({ id: "meta-author", level: opts.hasMetadataAuthor ? "ok" : "error", label: opts.hasMetadataAuthor ? "dc:creator presente" : "Falta dc:creator" });
  f.push({ id: "meta-lang", level: opts.hasLanguage ? "ok" : "error", label: opts.hasLanguage ? "dc:language presente" : "Falta dc:language" });
  return finish(f);
}

/** DOCX surface check (informational — docx-js handles XML schema). */
export function validateDocxIntent(opts: {
  hasTitlePage: boolean;
  hasChapters: boolean;
  hasHeadings: boolean;
  hasPageBreaks: boolean;
  hasNumbering: boolean;
  hasMetadata: boolean;
}): ValidationReport {
  const f: Finding[] = [];
  f.push({ id: "title", level: opts.hasTitlePage ? "ok" : "warn", label: opts.hasTitlePage ? "Portadilla incluida" : "Sin portadilla" });
  f.push({ id: "chs", level: opts.hasChapters ? "ok" : "error", label: opts.hasChapters ? "Capítulos presentes" : "Sin capítulos" });
  f.push({ id: "heads", level: opts.hasHeadings ? "ok" : "warn", label: opts.hasHeadings ? "Estilos Heading 1/2 mapeados" : "Sin estilos nativos" });
  f.push({ id: "pb", level: opts.hasPageBreaks ? "ok" : "warn", label: opts.hasPageBreaks ? "Saltos de página entre secciones" : "Sin saltos de página" });
  f.push({ id: "num", level: opts.hasNumbering ? "ok" : "warn", label: opts.hasNumbering ? "Numeración nativa Word" : "Listas en texto plano" });
  f.push({ id: "meta", level: opts.hasMetadata ? "ok" : "warn", label: opts.hasMetadata ? "Metadatos (autor/título/desc)" : "Metadatos incompletos" });
  return finish(f);
}
