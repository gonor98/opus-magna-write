import jsPDF from "jspdf";
import { buildCoverSpec, type TrimKey, type PaperKey } from "@/lib/kdp-specs";

export type PrintCoverInput = {
  title: string;
  author: string;
  trim?: TrimKey;
  paper?: PaperKey;
  pages?: number;
  frontDataUrl?: string | null;
  backDataUrl?: string | null;
  spineColor?: string;
  backCopy?: string;
  /** If true, return Blob instead of triggering a download. */
  returnBlob?: boolean;
};

/** Generates a print-ready KDP cover SPREAD PDF (front + spine + back + bleed). */
export async function generatePrintableCoverPDF(input: PrintCoverInput) {
  const trim = input.trim || "6x9";
  const pages = Math.max(24, input.pages || 200);
  const spec = buildCoverSpec(trim, pages, input.paper || "white");

  // Document in inches @ 1x; embed images at native res
  const doc = new jsPDF({
    unit: "in",
    format: [spec.spreadWidthIn, spec.spreadHeightIn],
    orientation: "landscape",
  });

  const W = spec.spreadWidthIn;
  const H = spec.spreadHeightIn;
  const trimW = (W - spec.spineIn - spec.bleedIn * 2) / 2;

  // Back cover (left)
  if (input.backDataUrl) {
    doc.addImage(input.backDataUrl, "JPEG", 0, 0, trimW + spec.bleedIn, H, undefined, "FAST");
  } else {
    doc.setFillColor(245, 240, 230).rect(0, 0, trimW + spec.bleedIn, H, "F");
    doc.setTextColor(50).setFontSize(11).setFont("helvetica", "normal");
    const txt = doc.splitTextToSize(
      input.backCopy ||
        `${input.title}\n\nUn libro de ${input.author}.\nDescripción comercial pendiente.`,
      trimW - 1,
    );
    doc.text(txt, spec.bleedIn + 0.5, 1.5);
  }

  // Spine (center)
  const spineX = trimW + spec.bleedIn;
  doc.setFillColor(20, 20, 22).rect(spineX, 0, spec.spineIn, H, "F");
  if (spec.spineIn >= 0.25) {
    doc.setTextColor(255).setFontSize(10).setFont("helvetica", "bold");
    doc.text(input.title.slice(0, 40), spineX + spec.spineIn / 2, H / 2, {
      angle: -90,
      align: "center",
    });
    doc.setFontSize(8).setFont("helvetica", "normal");
    doc.text(input.author.slice(0, 30), spineX + spec.spineIn / 2, H - 1, {
      angle: -90,
      align: "center",
    });
  }

  // Front cover (right)
  const frontX = spineX + spec.spineIn;
  if (input.frontDataUrl) {
    doc.addImage(input.frontDataUrl, "JPEG", frontX, 0, trimW + spec.bleedIn, H, undefined, "FAST");
  } else {
    doc.setFillColor(15, 23, 42).rect(frontX, 0, trimW + spec.bleedIn, H, "F");
    doc.setTextColor(255).setFontSize(28).setFont("helvetica", "bold");
    doc.text(input.title, frontX + (trimW + spec.bleedIn) / 2, H / 2, {
      align: "center",
      maxWidth: trimW - 1,
    });
    doc.setFontSize(14).setFont("helvetica", "normal");
    doc.text(input.author, frontX + (trimW + spec.bleedIn) / 2, H - 1, { align: "center" });
  }

  // Guides layer (cyan = bleed, magenta = safe, dashed). Goes on top so it's visible in proof.
  doc.setDrawColor(0, 200, 255).setLineWidth(0.01);
  doc.rect(spec.bleedIn, spec.bleedIn, W - spec.bleedIn * 2, H - spec.bleedIn * 2);
  doc.setDrawColor(255, 0, 200).setLineDashPattern([0.05, 0.05], 0);
  const safe = spec.bleedIn + spec.safeIn;
  doc.rect(safe, safe, W - safe * 2, H - safe * 2);
  doc.setDrawColor(0).setLineDashPattern([], 0);
  doc.line(spineX, 0, spineX, H);
  doc.line(spineX + spec.spineIn, 0, spineX + spec.spineIn, H);

  doc.save(`KDP-Cover-Spread-${input.title.replace(/\s+/g, "_")}.pdf`);

  return { spec };
}
