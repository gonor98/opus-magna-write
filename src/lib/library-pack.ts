import JSZip from "jszip";
import { useBookStore, wordCount, type Chapter } from "@/lib/store";
import {
  exportPDF,
  exportEPUB,
  exportDOCX,
  type ExportPayload,
  type ProgressStep,
} from "@/lib/export";
import { generatePrintableCoverPDF } from "@/lib/cover-print";
import { buildKDPReport } from "@/lib/kdp-report";

export type LibraryPackStep =
  | "json"
  | "epub"
  | "docx"
  | "pdf"
  | "cover_print"
  | "cover_zip"
  | "kdp_report"
  | "zip";

export type LibraryPackProgress = {
  step: LibraryPackStep;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

export type LibraryPackOptions = {
  onProgress?: (steps: LibraryPackProgress[]) => void;
  /** Optional extra cover variants to bundle (data URLs). */
  coverVariants?: { name: string; dataUrl: string }[];
  /** Optional back cover data URL for the printable spread. */
  backCoverDataUrl?: string | null;
};

const slugify = (s: string) =>
  (s || "libro")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "libro";

const dataUrlToUint8 = (dataUrl: string): Uint8Array | null => {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const extOf = (dataUrl: string): string => {
  const m = /^data:image\/([a-zA-Z0-9+]+);/.exec(dataUrl);
  if (!m) return "png";
  const e = m[1].toLowerCase();
  if (e === "jpeg") return "jpg";
  return e;
};

const buildPayload = (): ExportPayload => {
  const s = useBookStore.getState();
  return {
    bookContext: s.bookContext,
    publishingForm: s.publishingForm,
    frontBackMatter: s.frontBackMatter,
    chapters: s.chapters,
    authorDNA: s.authorDNA,
    bookCover: s.bookCover,
  };
};

const ALL_STEPS: { step: LibraryPackStep; label: string }[] = [
  { step: "json", label: "JSON del libro (manuscrito + metadata)" },
  { step: "epub", label: "EPUB 3.0 (lectores digitales)" },
  { step: "docx", label: "DOCX (manuscrito Word)" },
  { step: "pdf", label: "PDF manuscrito (KDP interior)" },
  { step: "cover_print", label: "PDF portada imprimible (front+spine+back)" },
  { step: "cover_zip", label: "ZIP de portadas (front/back/variantes)" },
  { step: "kdp_report", label: "Reporte KDP (JSON resumido)" },
  { step: "zip", label: "Empaquetando Library Pack" },
];

export async function buildLibraryPack(opts: LibraryPackOptions = {}) {
  const state = useBookStore.getState();
  const payload = buildPayload();
  const title = payload.bookContext.title || "Libro";
  const slug = slugify(title);

  const steps: LibraryPackProgress[] = ALL_STEPS.map((s) => ({
    ...s,
    status: "pending",
  }));
  const emit = () => opts.onProgress?.(steps.map((s) => ({ ...s })));
  const setStatus = (
    step: LibraryPackStep,
    status: LibraryPackProgress["status"],
    detail?: string,
  ) => {
    const s = steps.find((x) => x.step === step);
    if (s) {
      s.status = status;
      if (detail) s.detail = detail;
    }
    emit();
  };
  emit();

  const zip = new JSZip();
  const root = zip.folder(`library-pack-${slug}`)!;
  const errors: string[] = [];

  // 1. JSON dump
  try {
    setStatus("json", "active");
    const dump = {
      generatedAt: new Date().toISOString(),
      bookContext: state.bookContext,
      authorDNA: state.authorDNA,
      publishingForm: state.publishingForm,
      frontBackMatter: state.frontBackMatter,
      designConfig: state.designConfig,
      marketSignals: state.marketSignals,
      launchKit: state.launchKit,
      chapters: state.chapters.map((c: Chapter) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        wordCount: c.content?.trim().split(/\s+/).filter(Boolean).length || 0,
        content: c.content,
      })),
      totals: {
        chapters: state.chapters.length,
        wordCount: wordCount(state.chapters),
      },
    };
    root.file("book.json", JSON.stringify(dump, null, 2));
    setStatus("json", "done", `${dump.totals.chapters} capítulos · ${dump.totals.wordCount.toLocaleString()} palabras`);
  } catch (e: any) {
    errors.push(`JSON: ${e.message}`);
    setStatus("json", "error", e.message);
  }

  // 2. EPUB
  try {
    setStatus("epub", "active");
    const res = (await exportEPUB(payload, undefined, { returnBlob: true })) as
      | { blob: Blob; filename: string }
      | undefined;
    if (res?.blob) {
      root.file(res.filename, res.blob);
      setStatus("epub", "done");
    } else {
      throw new Error("EPUB no devolvió blob");
    }
  } catch (e: any) {
    errors.push(`EPUB: ${e.message}`);
    setStatus("epub", "error", e.message);
  }

  // 3. DOCX
  try {
    setStatus("docx", "active");
    const res = (await exportDOCX(payload, undefined, { returnBlob: true })) as
      | { blob: Blob; filename: string }
      | undefined;
    if (res?.blob) {
      root.file(res.filename, res.blob);
      setStatus("docx", "done");
    } else {
      throw new Error("DOCX no devolvió blob");
    }
  } catch (e: any) {
    errors.push(`DOCX: ${e.message}`);
    setStatus("docx", "error", e.message);
  }

  // 4. PDF manuscript
  try {
    setStatus("pdf", "active");
    const res = (await exportPDF(payload, undefined, { returnBlob: true })) as
      | { blob: Blob; filename: string }
      | undefined;
    if (res?.blob) {
      root.file(res.filename, res.blob);
      setStatus("pdf", "done");
    } else {
      throw new Error("PDF no devolvió blob");
    }
  } catch (e: any) {
    errors.push(`PDF: ${e.message}`);
    setStatus("pdf", "error", e.message);
  }

  // 5. Printable Cover Spread PDF
  try {
    setStatus("cover_print", "active");
    if (!payload.bookCover) {
      setStatus("cover_print", "done", "Sin portada — se omite spread imprimible");
    } else {
      const pages = Math.max(24, state.chapters.length * 12);
      const res = await generatePrintableCoverPDF({
        title,
        author: state.publishingForm.author || "Autor",
        pages,
        frontDataUrl: payload.bookCover,
        backDataUrl: opts.backCoverDataUrl ?? null,
        returnBlob: true,
      });
      const r = res as { blob?: Blob; filename?: string };
      if (r.blob && r.filename) {
        root.file(`covers/${r.filename}`, r.blob);
        setStatus("cover_print", "done");
      } else {
        throw new Error("Cover PDF no devolvió blob");
      }
    }
  } catch (e: any) {
    errors.push(`Cover PDF: ${e.message}`);
    setStatus("cover_print", "error", e.message);
  }

  // 6. Cover images ZIP folder
  try {
    setStatus("cover_zip", "active");
    let count = 0;
    if (payload.bookCover) {
      const u8 = dataUrlToUint8(payload.bookCover);
      if (u8) {
        root.file(`covers/front.${extOf(payload.bookCover)}`, u8);
        count++;
      }
    }
    if (opts.backCoverDataUrl) {
      const u8 = dataUrlToUint8(opts.backCoverDataUrl);
      if (u8) {
        root.file(`covers/back.${extOf(opts.backCoverDataUrl)}`, u8);
        count++;
      }
    }
    for (const v of opts.coverVariants || []) {
      const u8 = dataUrlToUint8(v.dataUrl);
      if (!u8) continue;
      const safe = slugify(v.name);
      root.file(`covers/variants/${safe}.${extOf(v.dataUrl)}`, u8);
      count++;
    }
    setStatus("cover_zip", "done", `${count} imagen(es) embebida(s)`);
  } catch (e: any) {
    errors.push(`Cover ZIP: ${e.message}`);
    setStatus("cover_zip", "error", e.message);
  }

  // 7. KDP Report
  try {
    setStatus("kdp_report", "active");
    const report = await buildKDPReport();
    root.file("kdp-report.json", JSON.stringify(report, null, 2));
    const summary = [
      `# KDP Report — ${report.bookTitle}`,
      `Autor: ${report.author}`,
      `Score: ${report.score}/100`,
      `Errores: ${report.totals.errors} · Advertencias: ${report.totals.warnings} · OK: ${report.totals.ok}`,
      `Palabras: ${report.meta.wordCount.toLocaleString()} · Capítulos: ${report.meta.chapterCount}`,
      "",
      "## Hallazgos",
      ...report.findings.map(
        (f) => `- [${f.level.toUpperCase()}] (${f.area}) ${f.field}: ${f.message}${f.recommendation ? ` → ${f.recommendation}` : ""}`,
      ),
    ].join("\n");
    root.file("kdp-report.md", summary);
    setStatus("kdp_report", "done", `Score ${report.score}/100`);
  } catch (e: any) {
    errors.push(`KDP Report: ${e.message}`);
    setStatus("kdp_report", "error", e.message);
  }

  // README
  root.file(
    "README.md",
    [
      `# Library Pack — ${title}`,
      `Generado: ${new Date().toLocaleString()}`,
      "",
      "## Contenido",
      "- `book.json` — Volcado completo del libro (manuscrito, metadata, ADN)",
      "- `*.epub` — EPUB 3.0 listo para KDP/Kobo/Apple Books",
      "- `*.docx` — Manuscrito Word (KDP interior alternativo)",
      "- `*.pdf` — Manuscrito PDF interior",
      "- `covers/` — Front, back, variantes y spread imprimible para imprenta KDP",
      "- `kdp-report.json` / `kdp-report.md` — Auditoría de cumplimiento KDP",
      "",
      errors.length ? `## Errores parciales\n${errors.map((e) => `- ${e}`).join("\n")}` : "✅ Sin errores.",
    ].join("\n"),
  );

  // 8. Zip
  setStatus("zip", "active");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  setStatus("zip", "done", `${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  return { blob, filename: `library-pack-${slug}.zip`, errors };
}

export function downloadLibraryPack(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
