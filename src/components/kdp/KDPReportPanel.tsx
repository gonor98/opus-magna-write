import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileJson, FileText, ShieldCheck, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { buildKDPReport, downloadKDPReportJSON, downloadKDPReportPDF, type KDPReport } from "@/lib/kdp-report";
import { generatePrintableCoverPDF } from "@/lib/cover-print";
import { useBookStore } from "@/lib/store";
import { requireFeature } from "@/lib/tier";

export function KDPReportPanel() {
  const [report, setReport] = useState<KDPReport | null>(null);
  const [loading, setLoading] = useState(false);
  const s = useBookStore();

  const run = async () => {
    setLoading(true);
    try {
      const r = await buildKDPReport();
      setReport(r);
      toast.success(`Reporte KDP listo · score ${r.score}/100`);
    } catch (e: any) {
      toast.error(e?.message || "Error generando reporte");
    } finally { setLoading(false); }
  };

  const printableCover = async () => {
    if (!requireFeature("cover.generate", "Exportar portada imprimible")) return;
    try {
      await generatePrintableCoverPDF({
        title: s.bookContext.title,
        author: s.publishingForm.author || "Autor",
        pages: Math.max(80, s.chapters.length * 12),
        frontDataUrl: s.bookCover,
      });
      toast.success("Portada imprimible KDP descargada (spread con bleed + safe areas).");
    } catch (e: any) {
      toast.error(e?.message || "Error exportando portada");
    }
  };

  const color = (n: number) => (n >= 85 ? "text-emerald-500" : n >= 65 ? "text-amber-500" : "text-destructive");

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Validación KDP & descargas</h3>
            <p className="text-sm text-muted-foreground">
              Reporte completo (cover · manuscrito · EPUB · DOCX · audio) + portada imprimible con bleed y safe areas.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">Amazon KDP · IngramSpark</Badge>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={run} disabled={loading} className="primary-gradient text-primary-foreground">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Validar todo
        </Button>
        <Button variant="outline" disabled={!report} onClick={() => report && downloadKDPReportJSON(report)}>
          <FileJson className="mr-2 h-4 w-4" /> Descargar JSON
        </Button>
        <Button variant="outline" disabled={!report} onClick={() => report && downloadKDPReportPDF(report)}>
          <FileText className="mr-2 h-4 w-4" /> Descargar PDF
        </Button>
        <Button variant="outline" onClick={printableCover}>
          <BookOpen className="mr-2 h-4 w-4" /> 🖨️ Portada KDP imprimible (spread)
        </Button>
      </div>

      {report && (
        <div className="mt-6 space-y-4 animate-fade-in">
          <div className="flex items-baseline gap-6 rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div>
              <div className={"font-display text-5xl font-bold " + color(report.score)}>{report.score}</div>
              <div className="text-xs text-muted-foreground">Score KDP</div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><div className="text-2xl font-bold text-destructive">{report.totals.errors}</div><div className="text-[11px] text-muted-foreground">Errores</div></div>
              <div><div className="text-2xl font-bold text-amber-500">{report.totals.warnings}</div><div className="text-[11px] text-muted-foreground">Warnings</div></div>
              <div><div className="text-2xl font-bold text-blue-500">{report.totals.infos}</div><div className="text-[11px] text-muted-foreground">Info</div></div>
              <div><div className="text-2xl font-bold text-emerald-500">{report.totals.ok}</div><div className="text-[11px] text-muted-foreground">OK</div></div>
            </div>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto rounded-xl border border-border/60 p-3">
            {report.findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={
                  "mt-0.5 inline-flex h-2 w-2 rounded-full shrink-0 " +
                  (f.level === "error" ? "bg-destructive" : f.level === "warning" ? "bg-amber-500" : f.level === "info" ? "bg-blue-500" : "bg-emerald-500")
                } />
                <div className="flex-1">
                  <span className="font-semibold uppercase text-[10px] mr-2 text-muted-foreground">{f.area}/{f.field}</span>
                  <span>{f.message}</span>
                  {f.recommendation && <div className="text-muted-foreground">→ {f.recommendation}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
