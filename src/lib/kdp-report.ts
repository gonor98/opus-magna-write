import jsPDF from "jspdf";
import { useBookStore, wordCount } from "@/lib/store";
import {
  validateManuscriptForKDP,
  validateCoverImage,
  buildCoverSpec,
  type Finding,
} from "@/lib/kdp-specs";

const mapLevel = (l: Finding["level"]): "error" | "warning" | "info" | "ok" =>
  l === "warn" ? "warning" : l;

export type ReportFinding = {
  area: "cover" | "manuscript" | "metadata" | "epub" | "docx" | "audio";
  level: "error" | "warning" | "info" | "ok";
  field: string;
  message: string;
  recommendation?: string;
};

export type KDPReport = {
  generatedAt: string;
  bookTitle: string;
  author: string;
  totals: { errors: number; warnings: number; infos: number; ok: number };
  score: number;
  findings: ReportFinding[];
  meta: { wordCount: number; chapterCount: number; tier: string };
};

const okBadge = (cond: boolean, field: string, errMsg: string, area: ReportFinding["area"], rec?: string): ReportFinding =>
  cond
    ? { area, level: "ok", field, message: "Cumple especificación KDP." }
    : { area, level: "error", field, message: errMsg, recommendation: rec };

export async function buildKDPReport(): Promise<KDPReport> {
  const s = useBookStore.getState();
  const findings: ReportFinding[] = [];

  // Manuscript
  try {
    const m = validateManuscriptForKDP({
      title: s.bookContext.title,
      subtitle: s.bookContext.subtitle,
      author: s.publishingForm.author,
      description: s.publishingForm.description,
      keywords: s.publishingForm.keywords,
      categories: s.publishingForm.categories,
      wordCount: wordCount(s.chapters),
      chapterCount: s.chapters.length,
    } as any);
    (m?.findings || []).forEach((it) =>
      findings.push({
        area: "manuscript",
        level: mapLevel(it.level),
        field: it.id,
        message: it.label,
        recommendation: it.detail,
      }),
    );
  } catch (e) {
    findings.push({ area: "manuscript", level: "warning", field: "validator", message: (e as Error).message });
  }


  // Metadata granular
  findings.push(okBadge(!!s.publishingForm.author, "author", "Autor vacío.", "metadata", "Pon tu nombre legal o pseudónimo."));
  findings.push(okBadge((s.publishingForm.description || "").length >= 200, "description", "Descripción <200 caracteres.", "metadata", "Idealmente 500–4000 chars con bullets."));
  findings.push(okBadge(s.publishingForm.keywords.split(",").filter(Boolean).length >= 5, "keywords", "Menos de 5 keywords.", "metadata", "KDP permite hasta 7 keywords long-tail."));
  findings.push(okBadge(s.publishingForm.categories.split(",").filter(Boolean).length >= 2, "categories", "Faltan categorías BISAC.", "metadata", "Selecciona 2–3 categorías relevantes."));
  findings.push(okBadge(s.publishingForm.priceDigital >= 0.99 && s.publishingForm.priceDigital <= 9.99, "priceDigital", "Precio digital fuera de la franja royalty 70% (USD 2.99–9.99).", "metadata"));

  // Cover
  if (s.bookCover) {
    try {
      const v = await validateCoverImage(s.bookCover);
      (v?.issues || []).forEach((it: any) =>
        findings.push({
          area: "cover",
          level: it.level || "warning",
          field: it.field || "cover",
          message: it.message || String(it),
          recommendation: it.fix,
        }),
      );
      findings.push(okBadge(!!v?.ok, "resolution", "Resolución/DPI insuficientes para imprenta KDP.", "cover", "Mínimo 300 DPI, 2560×3840 px para 6x9."));
    } catch (e) {
      findings.push({ area: "cover", level: "warning", field: "validator", message: (e as Error).message });
    }
  } else {
    findings.push({ area: "cover", level: "error", field: "cover", message: "No hay portada generada." });
  }

  // EPUB/DOCX (heurísticas)
  findings.push(okBadge(s.chapters.length >= 3, "chapters", "Menos de 3 capítulos: TOC pobre en EPUB.", "epub", "Idealmente 8–20 capítulos."));
  findings.push(okBadge(!!s.frontBackMatter.prologue, "prologue", "Sin prólogo — ayuda al hook KDP.", "epub"));
  findings.push(okBadge(!!s.frontBackMatter.acknowledgments, "acknowledgments", "Sin agradecimientos.", "docx"));

  // Audio
  const acxCount = Object.keys(s.assets?.acxScripts || {}).length || 0;
  findings.push(
    acxCount > 0
      ? { area: "audio", level: "ok", field: "acx", message: `${acxCount} guiones ACX listos.` }
      : { area: "audio", level: "info", field: "acx", message: "Aún sin guiones ACX." },
  );

  const totals = {
    errors: findings.filter((f) => f.level === "error").length,
    warnings: findings.filter((f) => f.level === "warning").length,
    infos: findings.filter((f) => f.level === "info").length,
    ok: findings.filter((f) => f.level === "ok").length,
  };
  const score = Math.max(0, 100 - totals.errors * 12 - totals.warnings * 4);

  return {
    generatedAt: new Date().toISOString(),
    bookTitle: s.bookContext.title,
    author: s.publishingForm.author || "(sin autor)",
    totals,
    score,
    findings,
    meta: { wordCount: wordCount(s.chapters), chapterCount: s.chapters.length, tier: s.userTier },
  };
}

export function downloadKDPReportJSON(r: KDPReport) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `KDP-Report-${r.bookTitle.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadKDPReportPDF(r: KDPReport) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  doc.setFont("helvetica", "bold").setFontSize(20).text("Reporte de Validación KDP", M, y); y += 24;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(`${r.bookTitle} — ${r.author}`, M, y); y += 14;
  doc.text(`Generado: ${new Date(r.generatedAt).toLocaleString()}`, M, y); y += 22;

  doc.setTextColor(0).setFontSize(36).setFont("helvetica", "bold");
  doc.text(String(r.score), M, y + 24);
  doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(110);
  doc.text("Score KDP", M + 64, y + 14);
  doc.text(
    `${r.totals.errors} errores · ${r.totals.warnings} warnings · ${r.totals.ok} OK`,
    M + 64,
    y + 30,
  );
  y += 60;

  const colors = { error: [200, 50, 50], warning: [200, 140, 30], info: [60, 110, 200], ok: [40, 150, 90] } as const;
  doc.setDrawColor(220);

  const groups = ["cover", "manuscript", "metadata", "epub", "docx", "audio"] as const;
  for (const g of groups) {
    const items = r.findings.filter((f) => f.area === g);
    if (!items.length) continue;
    if (y > 720) { doc.addPage(); y = M; }
    doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(13).text(g.toUpperCase(), M, y); y += 6;
    doc.line(M, y, W - M, y); y += 14;

    for (const it of items) {
      if (y > 740) { doc.addPage(); y = M; }
      const c = colors[it.level];
      doc.setFillColor(c[0], c[1], c[2]).circle(M + 4, y - 3, 4, "F");
      doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(10).text(`${it.field}`, M + 16, y);
      doc.setFont("helvetica", "normal").setTextColor(60);
      const msg = doc.splitTextToSize(it.message, W - M * 2 - 16);
      doc.text(msg, M + 16, y + 12);
      y += 12 + msg.length * 12;
      if (it.recommendation) {
        const rec = doc.splitTextToSize(`→ ${it.recommendation}`, W - M * 2 - 16);
        doc.setTextColor(110).setFontSize(9);
        doc.text(rec, M + 16, y);
        y += rec.length * 11;
        doc.setFontSize(10);
      }
      y += 8;
    }
    y += 6;
  }

  doc.save(`KDP-Report-${r.bookTitle.replace(/\s+/g, "_")}.pdf`);
}
