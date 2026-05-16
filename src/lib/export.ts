import jsPDF from "jspdf";
import JSZip from "jszip";
import type {
  Chapter,
  BookContext,
  PublishingForm,
  FrontBackMatter,
  AuthorDNA,
} from "@/lib/store";

export type ExportPayload = {
  bookContext: BookContext;
  publishingForm: PublishingForm;
  frontBackMatter: FrontBackMatter;
  chapters: Chapter[];
  authorDNA: AuthorDNA;
  bookCover: string | null;
};

export type ProgressStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

export type OnProgress = (steps: ProgressStep[]) => void;

export type ExportOptions = {
  /** 1-indexed inclusive chapter range. Omit to export all chapters. */
  chapterRange?: { from: number; to: number };
  signal?: AbortSignal;
};

export class ExportStepError extends Error {
  stepId: string;
  constructor(stepId: string, message: string) {
    super(message);
    this.stepId = stepId;
    this.name = "ExportStepError";
  }
}

export class ExportAbortError extends Error {
  constructor() {
    super("Exportación cancelada");
    this.name = "AbortError";
  }
}

const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new ExportAbortError();
};

const sliceChapters = (chs: Chapter[], range?: ExportOptions["chapterRange"]) => {
  if (!range) return chs;
  const from = Math.max(1, Math.min(chs.length, range.from)) - 1;
  const to = Math.max(from + 1, Math.min(chs.length, range.to));
  return chs.slice(from, to);
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slugify = (s: string) =>
  (s || "libro")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "libro";

const anchorize = (s: string) => slugify(s).slice(0, 40) || "section";

function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/** Extract H2/H3 headings from chapter markdown for richer TOC */
export function extractHeadings(md: string): { level: 2 | 3; text: string; id: string }[] {
  const out: { level: 2 | 3; text: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const raw of (md || "").split(/\n/)) {
    const line = raw.trim();
    let m;
    if ((m = /^##\s+(.+)$/.exec(line))) {
      let id = anchorize(m[1]);
      let i = 2;
      while (seen.has(id)) id = `${anchorize(m[1])}-${i++}`;
      seen.add(id);
      out.push({ level: 2, text: m[1].replace(/\*\*?/g, ""), id });
    } else if ((m = /^###\s+(.+)$/.exec(line))) {
      let id = anchorize(m[1]);
      let i = 2;
      while (seen.has(id)) id = `${anchorize(m[1])}-${i++}`;
      seen.add(id);
      out.push({ level: 3, text: m[1].replace(/\*\*?/g, ""), id });
    }
  }
  return out;
}

function mdToHtml(md: string, images: string[] = [], imgRefBuilder?: (idx: number) => string | null) {
  if (!md) return "";
  const parts = md.split(/\[ILUSTRACION:(\d+)\]/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        const idx = parseInt(part);
        const ref = imgRefBuilder ? imgRefBuilder(idx) : images[idx];
        return ref ? `<figure><img src="${ref}" alt=""/></figure>` : "";
      }
      const lines = part.split(/\n/);
      const html: string[] = [];
      let buf: string[] = [];
      const seen = new Set<string>();
      const headingId = (text: string) => {
        let id = anchorize(text);
        let n = 2;
        while (seen.has(id)) id = `${anchorize(text)}-${n++}`;
        seen.add(id);
        return id;
      };
      const flush = () => {
        if (buf.length) {
          html.push(`<p>${buf.join(" ")}</p>`);
          buf = [];
        }
      };
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
          flush();
          continue;
        }
        if (line.startsWith("### ")) {
          flush();
          const t = line.slice(4);
          html.push(`<h3 id="${headingId(t)}">${inline(t)}</h3>`);
        } else if (line.startsWith("## ")) {
          flush();
          const t = line.slice(3);
          html.push(`<h2 id="${headingId(t)}">${inline(t)}</h2>`);
        } else if (line.startsWith("# ")) {
          flush();
          html.push(`<h1>${inline(line.slice(2))}</h1>`);
        } else if (line.startsWith("> ")) {
          flush();
          html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
        } else {
          buf.push(inline(line));
        }
      }
      flush();
      return html.join("\n");
    })
    .join("\n");
}

function mdToPlain(md: string) {
  return (md || "")
    .replace(/\[ILUSTRACION:\d+\]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^>\s+/gm, "");
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------- Preview -------------------- */

export type PreviewSection = {
  id: string;
  label: string;
  kind: "front" | "chapter" | "back";
  excerpt?: string;
  subItems?: { id: string; text: string; level: 2 | 3 }[];
};

export type ExportPreview = {
  title: string;
  subtitle: string;
  author: string;
  description: string;
  keywords: string;
  cover: string | null;
  totalWords: number;
  toc: PreviewSection[];
  firstPages: { title: string; excerpt: string }[];
};

export function buildPreview(p: ExportPayload, options?: ExportOptions): ExportPreview {
  const toc: PreviewSection[] = [];
  const fm = p.frontBackMatter;
  const chapters = sliceChapters(p.chapters, options?.chapterRange);
  const offset = options?.chapterRange ? Math.max(0, options.chapterRange.from - 1) : 0;

  if (fm.dedication) toc.push({ id: "dedication", label: "Dedicatoria", kind: "front" });
  if (fm.prologue) toc.push({ id: "prologue", label: "Prólogo", kind: "front" });

  chapters.forEach((ch, i) => {
    const headings = extractHeadings(ch.content || "");
    toc.push({
      id: `chapter-${i}`,
      label: `${offset + i + 1}. ${ch.title}`,
      kind: "chapter",
      excerpt: mdToPlain(ch.content || ch.description).slice(0, 180),
      subItems: headings.slice(0, 8).map((h) => ({ id: h.id, text: h.text, level: h.level })),
    });
  });

  if (fm.epilogue) toc.push({ id: "epilogue", label: "Epílogo", kind: "back" });
  if (fm.acknowledgments) toc.push({ id: "acknowledgments", label: "Agradecimientos", kind: "back" });
  const bio = p.publishingForm.shortBio || p.authorDNA.bio;
  if (bio) toc.push({ id: "about", label: "Sobre el autor", kind: "back" });

  const firstPages = chapters.slice(0, 3).map((ch) => ({
    title: ch.title,
    excerpt: mdToPlain(ch.content || ch.description).slice(0, 360),
  }));

  const totalWords = chapters.reduce(
    (acc, c) => (c.content ? acc + c.content.trim().split(/\s+/).filter(Boolean).length : acc),
    0,
  );

  return {
    title: p.bookContext.title || "Sin título",
    subtitle: p.bookContext.subtitle || "",
    author: p.publishingForm.author || "Autor",
    description: p.publishingForm.description || "",
    keywords: p.publishingForm.keywords || "",
    cover: p.bookCover,
    totalWords,
    toc,
    firstPages,
  };
}

/* -------------------- Progress helper -------------------- */

class ProgressTracker {
  steps: ProgressStep[];
  cb?: OnProgress;
  signal?: AbortSignal;
  currentId: string | null = null;
  constructor(steps: { id: string; label: string }[], cb?: OnProgress, signal?: AbortSignal) {
    this.steps = steps.map((s) => ({ ...s, status: "pending" as const }));
    this.cb = cb;
    this.signal = signal;
    this.emit();
  }
  emit() {
    this.cb?.(this.steps.map((s) => ({ ...s })));
  }
  async start(id: string, detail?: string) {
    checkAbort(this.signal);
    this.currentId = id;
    const s = this.steps.find((x) => x.id === id);
    if (s) {
      s.status = "active";
      s.detail = detail;
    }
    this.emit();
    await sleep(40);
  }
  update(id: string, detail: string) {
    checkAbort(this.signal);
    const s = this.steps.find((x) => x.id === id);
    if (s) s.detail = detail;
    this.emit();
  }
  done(id: string, detail?: string) {
    const s = this.steps.find((x) => x.id === id);
    if (s) {
      s.status = "done";
      if (detail) s.detail = detail;
    }
    this.emit();
  }
  error(id: string, detail: string) {
    const s = this.steps.find((x) => x.id === id);
    if (s) {
      s.status = "error";
      s.detail = detail;
    }
    this.emit();
  }
  /** Wrap export body in this to translate raw errors into ExportStepError */
  async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      const id = this.currentId || "unknown";
      this.error(id, e?.message || String(e));
      throw new ExportStepError(id, e?.message || "Error desconocido");
    }
  }
}

/* -------------------- PDF -------------------- */

export async function exportPDF(p: ExportPayload, onProgress?: OnProgress, options?: ExportOptions) {
  const tracker = new ProgressTracker(
    [
      { id: "init", label: "Inicializando documento A5" },
      { id: "cover", label: "Renderizando portada" },
      { id: "title", label: "Componiendo portadilla" },
      { id: "front", label: "Front matter (dedicatoria, prólogo)" },
      { id: "chapters", label: "Maquetando capítulos" },
      { id: "back", label: "Back matter (epílogo, créditos)" },
      { id: "save", label: "Guardando archivo" },
    ],
    onProgress,
    options?.signal,
  );

  const chapters = sliceChapters(p.chapters, options?.chapterRange);
  const offset = options?.chapterRange ? Math.max(0, options.chapterRange.from - 1) : 0;

  return tracker.wrap(async () => {

  await tracker.start("init");
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Print-ready gutter margins (asymmetric: inner edge wider for binding)
  const GUTTER = 64;
  const OUTER = 40;
  const TOP = 56;
  const BOTTOM = 64;
  // Page numbering: tracked so we can stamp folios only on body matter
  let chapterStartPage: number | null = null;
  // Margins for the *current* page (recto = odd, verso = even).
  // Recto (odd) pages: gutter on the LEFT (binding side).
  // Verso (even) pages: gutter on the RIGHT.
  const marginsForPage = (n: number) => {
    const odd = n % 2 === 1;
    return odd
      ? { left: GUTTER, right: OUTER }
      : { left: OUTER, right: GUTTER };
  };
  const currentMargins = () => marginsForPage(doc.getNumberOfPages());
  const innerWForPage = () => {
    const m = currentMargins();
    return pageW - m.left - m.right;
  };
  tracker.done("init");

  await tracker.start("cover");
  if (p.bookCover) {
    try {
      const { mime } = dataUrlToBytes(p.bookCover);
      const fmt = mime.includes("png") ? "PNG" : "JPEG";
      doc.addImage(p.bookCover, fmt, 0, 0, pageW, pageH);
    } catch {
      /* ignore */
    }
  } else {
    doc.setFillColor(28, 31, 64);
    doc.rect(0, 0, pageW, pageH, "F");
  }
  doc.addPage();
  tracker.done("cover");

  await tracker.start("title");
  const tm = currentMargins();
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 40);
  doc.text(p.bookContext.title || "Sin título", pageW / 2, pageH / 2 - 30, {
    align: "center",
    maxWidth: pageW - tm.left - tm.right,
  });
  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.text(p.bookContext.subtitle || "", pageW / 2, pageH / 2, {
    align: "center",
    maxWidth: pageW - tm.left - tm.right,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(p.publishingForm.author || "Autor", pageW / 2, pageH - BOTTOM * 2, {
    align: "center",
  });
  doc.addPage();
  tracker.done("title");

  const writeBlock = (title: string, body: string, opts?: { italic?: boolean }) => {
    if (!body && !title) return;
    let m = currentMargins();
    let innerW = pageW - m.left - m.right;
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 30);
    doc.text(title, m.left, TOP + 10, { maxWidth: innerW });
    doc.setFont("times", opts?.italic ? "italic" : "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 50);
    let y = TOP + 50;
    const paragraphs = (body || "").split(/\n{2,}/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(mdToPlain(para), innerW) as string[];
      for (const ln of lines) {
        if (y > pageH - BOTTOM) {
          doc.addPage();
          m = currentMargins();
          innerW = pageW - m.left - m.right;
          y = TOP;
        }
        doc.text(ln, m.left, y);
        y += 16;
      }
      y += 8;
    }
    doc.addPage();
  };

  await tracker.start("front");
  if (p.frontBackMatter.dedication) writeBlock("Dedicatoria", p.frontBackMatter.dedication, { italic: true });
  if (p.frontBackMatter.prologue) writeBlock("Prólogo", p.frontBackMatter.prologue);
  tracker.done("front");

  await tracker.start("chapters", `0/${chapters.length}`);
  for (let i = 0; i < chapters.length; i++) {
    if (i === 0) chapterStartPage = doc.getNumberOfPages();
    const ch = chapters[i];
    writeBlock(`${offset + i + 1}. ${ch.title}`, ch.content || ch.description);
    tracker.update("chapters", `${i + 1}/${chapters.length} · ${ch.title}`);
    if (i % 2 === 0) await sleep(0);
  }
  tracker.done("chapters", `${chapters.length} capítulos`);

  await tracker.start("back");
  if (p.frontBackMatter.epilogue) writeBlock("Epílogo", p.frontBackMatter.epilogue);
  if (p.frontBackMatter.acknowledgments) writeBlock("Agradecimientos", p.frontBackMatter.acknowledgments);
  if (p.publishingForm.shortBio || p.authorDNA.bio)
    writeBlock("Sobre el autor", p.publishingForm.shortBio || p.authorDNA.bio);
  tracker.done("back");

  await tracker.start("save");
  // Stamp folios on body matter only (no numbers in front matter)
  if (chapterStartPage) {
    const total = doc.getNumberOfPages();
    for (let pg = chapterStartPage; pg <= total; pg++) {
      doc.setPage(pg);
      const m = marginsForPage(pg);
      const folio = pg - chapterStartPage + 1;
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 130);
      // Folio at outer edge (recto = right, verso = left)
      const x = pg % 2 === 1 ? pageW - m.right : m.left;
      const align: "left" | "right" = pg % 2 === 1 ? "right" : "left";
      doc.text(String(folio), x, pageH - BOTTOM / 2, { align });
    }
  }
  const suffix = options?.chapterRange ? `-cap${options.chapterRange.from}-${options.chapterRange.to}` : "";
  doc.save(`${slugify(p.bookContext.title)}${suffix}.pdf`);
  tracker.done("save", "Descarga iniciada · márgenes gutter + folios");
  });
}

/* -------------------- EPUB -------------------- */

export async function exportEPUB(p: ExportPayload, onProgress?: OnProgress, options?: ExportOptions) {
  const tracker = new ProgressTracker(
    [
      { id: "init", label: "Preparando contenedor EPUB 3.0" },
      { id: "cover", label: "Procesando portada" },
      { id: "front", label: "Front matter" },
      { id: "chapters", label: "Generando capítulos" },
      { id: "back", label: "Back matter" },
      { id: "nav", label: "Construyendo navegación enriquecida" },
      { id: "package", label: "Empaquetando archivo .epub" },
    ],
    onProgress,
    options?.signal,
  );

  const chapterSlice = sliceChapters(p.chapters, options?.chapterRange);
  const offset = options?.chapterRange ? Math.max(0, options.chapterRange.from - 1) : 0;

  return tracker.wrap(async () => {

  await tracker.start("init");
  const zip = new JSZip();
  const uid = `urn:uuid:${crypto.randomUUID?.() || Date.now().toString()}`;

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const css = `body{font-family:Georgia,serif;line-height:1.6;margin:1.2em;color:#1c1c28}
h1{font-size:2em;margin-top:2em;border-bottom:1px solid #ccc;padding-bottom:.4em}
h2{font-size:1.4em;margin-top:1.4em}
h3{font-size:1.15em}
p{text-align:justify;text-indent:1.4em;margin:.4em 0}
blockquote{font-style:italic;border-left:3px solid #888;margin:1em 0;padding:.4em 1em;color:#444}
img{max-width:100%;height:auto;display:block;margin:1em auto}
.title{text-align:center;margin-top:30%}
.title h1{font-size:2.4em;border:0}
.title .sub{font-style:italic;color:#555}
.title .author{margin-top:2em;letter-spacing:.2em;text-transform:uppercase;font-size:.9em}
nav ol{list-style:none;padding-left:1em}
nav ol ol{padding-left:1.4em;font-size:.95em;color:#555}
nav .group-title{margin-top:1em;font-weight:bold;text-transform:uppercase;letter-spacing:.1em;font-size:.8em;color:#666}`;
  zip.file("OEBPS/styles.css", css);

  type Item = {
    id: string;
    href: string;
    mime: string;
    spine?: boolean;
    label?: string;
    kind?: "front" | "chapter" | "back" | "cover";
    headings?: { id: string; text: string; level: 2 | 3 }[];
  };
  const items: Item[] = [];
  const addXhtml = (
    id: string,
    filename: string,
    body: string,
    extra?: { label?: string; kind?: Item["kind"]; headings?: Item["headings"] },
  ) => {
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"/><title>${escapeHtml(p.bookContext.title || "")}</title>
<link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>${body}</body></html>`;
    zip.file(`OEBPS/${filename}`, xhtml);
    items.push({ id, href: filename, mime: "application/xhtml+xml", spine: true, ...extra });
  };
  tracker.done("init");

  await tracker.start("cover");
  let coverHref: string | null = null;
  if (p.bookCover) {
    try {
      const { bytes, mime } = dataUrlToBytes(p.bookCover);
      const ext = mime.includes("png") ? "png" : "jpg";
      coverHref = `cover.${ext}`;
      zip.file(`OEBPS/${coverHref}`, bytes);
      items.push({ id: "cover-image", href: coverHref, mime });
      addXhtml(
        "cover",
        "cover.xhtml",
        `<div style="text-align:center;margin:0;padding:0"><img src="${coverHref}" alt="Portada"/></div>`,
        { kind: "cover", label: "Portada" },
      );
    } catch {
      /* ignore */
    }
  }
  addXhtml(
    "titlepage",
    "titlepage.xhtml",
    `<div class="title">
      <h1>${escapeHtml(p.bookContext.title || "")}</h1>
      <p class="sub">${escapeHtml(p.bookContext.subtitle || "")}</p>
      <p class="author">${escapeHtml(p.publishingForm.author || "")}</p>
    </div>`,
    { kind: "front", label: "Portadilla" },
  );
  tracker.done("cover");

  await tracker.start("front");
  const fm = p.frontBackMatter;
  if (fm.dedication)
    addXhtml("dedication", "dedication.xhtml", `<h1>Dedicatoria</h1>${mdToHtml(fm.dedication)}`, {
      kind: "front",
      label: "Dedicatoria",
    });
  if (fm.prologue)
    addXhtml("prologue", "prologue.xhtml", `<h1>Prólogo</h1>${mdToHtml(fm.prologue)}`, {
      kind: "front",
      label: "Prólogo",
    });
  tracker.done("front");

  // Chapter images (only for sliced range)
  chapterSlice.forEach((ch, ci) => {
    (ch.images || []).forEach((url, ii) => {
      try {
        const { bytes, mime } = dataUrlToBytes(url);
        const ext = mime.includes("png") ? "png" : "jpg";
        const href = `img-${ci}-${ii}.${ext}`;
        zip.file(`OEBPS/${href}`, bytes);
        items.push({ id: `img-${ci}-${ii}`, href, mime });
      } catch {
        /* ignore */
      }
    });
  });

  await tracker.start("chapters", `0/${chapterSlice.length}`);
  for (let i = 0; i < chapterSlice.length; i++) {
    const ch = chapterSlice[i];
    const headings = extractHeadings(ch.content || "");
    const parts = (ch.content || "").split(/\[ILUSTRACION:(\d+)\]/);
    const rebuilt = parts
      .map((part, idx) => {
        if (idx % 2 === 1) {
          const imgIdx = parseInt(part);
          const url = ch.images?.[imgIdx];
          if (!url) return "";
          try {
            const { mime } = dataUrlToBytes(url);
            const ext = mime.includes("png") ? "png" : "jpg";
            return `<figure><img src="img-${i}-${imgIdx}.${ext}" alt=""/></figure>`;
          } catch {
            return "";
          }
        }
        return mdToHtml(part);
      })
      .join("\n");
    addXhtml(`chapter-${i}`, `chapter-${i}.xhtml`, `<h1 id="top">${escapeHtml(ch.title)}</h1>${rebuilt}`, {
      kind: "chapter",
      label: `${offset + i + 1}. ${ch.title}`,
      headings,
    });
    tracker.update("chapters", `${i + 1}/${chapterSlice.length} · ${ch.title}`);
    if (i % 2 === 0) await sleep(0);
  }
  tracker.done("chapters", `${chapterSlice.length} capítulos`);

  await tracker.start("back");
  if (fm.epilogue)
    addXhtml("epilogue", "epilogue.xhtml", `<h1>Epílogo</h1>${mdToHtml(fm.epilogue)}`, {
      kind: "back",
      label: "Epílogo",
    });
  if (fm.acknowledgments)
    addXhtml(
      "acknowledgments",
      "acknowledgments.xhtml",
      `<h1>Agradecimientos</h1>${mdToHtml(fm.acknowledgments)}`,
      { kind: "back", label: "Agradecimientos" },
    );
  const bio = p.publishingForm.shortBio || p.authorDNA.bio;
  if (bio) addXhtml("about", "about.xhtml", `<h1>Sobre el autor</h1>${mdToHtml(bio)}`, { kind: "back", label: "Sobre el autor" });
  tracker.done("back");

  await tracker.start("nav");
  // Richer TOC: grouped, with sub-items per chapter heading
  const renderItem = (it: Item) => {
    const sub =
      it.headings && it.headings.length
        ? `<ol>${it.headings
            .map(
              (h) =>
                `<li><a href="${it.href}#${h.id}">${escapeHtml(h.text)}</a></li>`,
            )
            .join("")}</ol>`
        : "";
    return `<li><a href="${it.href}">${escapeHtml(it.label || it.id)}</a>${sub}</li>`;
  };

  const front = items.filter((it) => it.spine && (it.kind === "front" || it.kind === "cover"));
  const chapters = items.filter((it) => it.spine && it.kind === "chapter");
  const back = items.filter((it) => it.spine && it.kind === "back");

  const navBody = `
    <nav epub:type="toc" id="toc">
      <h1>Índice</h1>
      ${front.length ? `<p class="group-title">Páginas iniciales</p><ol>${front.map(renderItem).join("")}</ol>` : ""}
      ${chapters.length ? `<p class="group-title">Capítulos</p><ol>${chapters.map(renderItem).join("")}</ol>` : ""}
      ${back.length ? `<p class="group-title">Páginas finales</p><ol>${back.map(renderItem).join("")}</ol>` : ""}
    </nav>
    <nav epub:type="landmarks" hidden="">
      <h2>Landmarks</h2>
      <ol>
        ${coverHref ? `<li><a epub:type="cover" href="cover.xhtml">Portada</a></li>` : ""}
        <li><a epub:type="titlepage" href="titlepage.xhtml">Portadilla</a></li>
        <li><a epub:type="bodymatter" href="${chapters[0]?.href || "titlepage.xhtml"}">Inicio</a></li>
      </ol>
    </nav>`;

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>Índice</title>
<link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>${navBody}</body></html>`,
  );

  // Manifest + spine
  const manifestItems = items
    .map(
      (it) =>
        `<item id="${it.id}" href="${it.href}" media-type="${it.mime}"${
          it.id === "cover-image" ? ' properties="cover-image"' : ""
        }/>`,
    )
    .join("\n    ");
  const cssItem = `<item id="css" href="styles.css" media-type="text/css"/>`;
  const navItem = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`;
  const spine = items
    .filter((it) => it.spine)
    .map((it) => `<itemref idref="${it.id}"/>`)
    .join("\n    ");
  tracker.done("nav", `${chapters.length + front.length + back.length} entradas`);

  await tracker.start("package");
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeHtml(p.bookContext.title || "Sin título")}</dc:title>
    <dc:creator>${escapeHtml(p.publishingForm.author || "Autor")}</dc:creator>
    <dc:language>es</dc:language>
    <dc:description>${escapeHtml(p.publishingForm.description || "")}</dc:description>
    <dc:subject>${escapeHtml(p.publishingForm.keywords || "")}</dc:subject>
    <meta property="dcterms:modified">${new Date().toISOString().split(".")[0]}Z</meta>
    ${coverHref ? `<meta name="cover" content="cover-image"/>` : ""}
  </metadata>
  <manifest>
    ${cssItem}
    ${navItem}
    ${manifestItems}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opf);

  const blob = await zip.generateAsync({ mimeType: "application/epub+zip", type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = options?.chapterRange ? `-cap${options.chapterRange.from}-${options.chapterRange.to}` : "";
  a.download = `${slugify(p.bookContext.title)}${suffix}.epub`;
  a.click();
  URL.revokeObjectURL(url);
  tracker.done("package", "Descarga iniciada");
  });
}

/* -------------------- DOCX (Word manuscript) -------------------- */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  LevelFormat,
} from "docx";

function parseRuns(text: string): TextRun[] {
  const tokens: TextRun[] = [];
  // Match **bold**, *italic*, or `code`
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push(new TextRun(text.slice(last, m.index)));
    if (m[0].startsWith("**")) tokens.push(new TextRun({ text: m[0].slice(2, -2), bold: true }));
    else if (m[0].startsWith("`")) tokens.push(new TextRun({ text: m[0].slice(1, -1), font: "Consolas", size: 22 }));
    else tokens.push(new TextRun({ text: m[0].slice(1, -1), italics: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push(new TextRun(text.slice(last)));
  return tokens.length ? tokens : [new TextRun(text)];
}

function mdToDocxParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = (md || "").replace(/\[ILUSTRACION:\d+\]/g, "").split(/\n/);
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(" ").trim();
    if (text) out.push(new Paragraph({ children: parseRuns(text), spacing: { after: 200 }, alignment: AlignmentType.JUSTIFIED }));
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("### ")) {
      flush();
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseRuns(line.slice(4)), spacing: { before: 240, after: 160 } }));
    } else if (line.startsWith("## ")) {
      flush();
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseRuns(line.slice(3)), spacing: { before: 320, after: 200 } }));
    } else if (line.startsWith("# ")) {
      flush();
      out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: parseRuns(line.slice(2)) }));
    } else if (line.startsWith("> ")) {
      flush();
      out.push(new Paragraph({
        children: parseRuns(line.slice(2)),
        indent: { left: 720 },
        spacing: { after: 200 },
        border: { left: { style: "single", size: 12, color: "888888", space: 12 } },
      }));
    } else if (/^[-*]\s+/.test(line)) {
      flush();
      out.push(new Paragraph({
        children: parseRuns(line.replace(/^[-*]\s+/, "")),
        numbering: { reference: "om-bullets", level: 0 },
        spacing: { after: 120 },
      }));
    } else if (/^\d+\.\s+/.test(line)) {
      flush();
      out.push(new Paragraph({
        children: parseRuns(line.replace(/^\d+\.\s+/, "")),
        numbering: { reference: "om-numbers", level: 0 },
        spacing: { after: 120 },
      }));
    } else if (/^---+$/.test(line)) {
      flush();
      out.push(new Paragraph({ children: [new TextRun({ text: "✦ ✦ ✦", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } }));
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export async function exportDOCX(p: ExportPayload, onProgress?: OnProgress, options?: ExportOptions) {
  const tracker = new ProgressTracker(
    [
      { id: "init", label: "Inicializando documento Word" },
      { id: "title", label: "Componiendo portadilla" },
      { id: "front", label: "Front matter (dedicatoria, prólogo)" },
      { id: "chapters", label: "Maquetando capítulos" },
      { id: "back", label: "Back matter (epílogo, créditos)" },
      { id: "save", label: "Empaquetando .docx" },
    ],
    onProgress,
    options?.signal,
  );

  const chapters = sliceChapters(p.chapters, options?.chapterRange);
  const offset = options?.chapterRange ? Math.max(0, options.chapterRange.from - 1) : 0;

  return tracker.wrap(async () => {
    await tracker.start("init");
    const children: Paragraph[] = [];
    tracker.done("init");

    await tracker.start("title");
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: p.bookContext.title || "Sin título", bold: true, size: 56 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: p.bookContext.subtitle || "", italics: true, size: 28 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.publishingForm.author || "Autor", size: 24 })] }),
      new Paragraph({ children: [new PageBreak()] }),
    );
    tracker.done("title");

    await tracker.start("front");
    const fm = p.frontBackMatter;
    const block = (title: string, body: string) => {
      if (!body) return;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })], spacing: { before: 400, after: 200 } }));
      children.push(...mdToDocxParagraphs(body));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    };
    block("Dedicatoria", fm.dedication);
    block("Prólogo", fm.prologue);
    tracker.done("front");

    await tracker.start("chapters", `0/${chapters.length}`);
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${offset + i + 1}. ${ch.title}`, bold: true })], spacing: { before: 480, after: 240 } }));
      children.push(...mdToDocxParagraphs(ch.content || ch.description || ""));
      children.push(new Paragraph({ children: [new PageBreak()] }));
      tracker.update("chapters", `${i + 1}/${chapters.length} · ${ch.title}`);
      if (i % 2 === 0) await sleep(0);
    }
    tracker.done("chapters", `${chapters.length} capítulos`);

    await tracker.start("back");
    block("Epílogo", fm.epilogue);
    block("Agradecimientos", fm.acknowledgments);
    block("Sobre el autor", p.publishingForm.shortBio || p.authorDNA.bio);
    tracker.done("back");

    await tracker.start("save");
    const doc = new Document({
      creator: p.publishingForm.author || "Opus Magna Studio",
      title: p.bookContext.title || "Manuscrito",
      description: p.publishingForm.description || "",
      styles: {
        default: { document: { run: { font: "Georgia", size: 24 } } },
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = options?.chapterRange ? `-cap${options.chapterRange.from}-${options.chapterRange.to}` : "";
    a.download = `${slugify(p.bookContext.title)}${suffix}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    tracker.done("save", "Descarga iniciada");
  });
}
