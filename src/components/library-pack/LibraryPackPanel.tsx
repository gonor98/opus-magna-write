import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Loader2, CheckCircle2, AlertCircle, Circle, Download } from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";
import {
  buildLibraryPack,
  downloadLibraryPack,
  type LibraryPackProgress,
} from "@/lib/library-pack";

export function LibraryPackPanel() {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<LibraryPackProgress[]>([]);
  const [lastSize, setLastSize] = useState<string>("");

  const run = async () => {
    if (!requireFeature("export.docx", "Library Pack")) return;
    setBusy(true);
    setSteps([]);
    try {
      const { blob, filename, errors } = await buildLibraryPack({
        onProgress: setSteps,
      });
      downloadLibraryPack(blob, filename);
      setLastSize(`${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      if (errors.length) {
        toast.warning(`Library Pack listo con ${errors.length} aviso(s)`);
      } else {
        toast.success(`Library Pack descargado · ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error armando Library Pack");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 via-background to-[color:var(--ai)]/5 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">Library Pack — todo en un ZIP</h3>
            <p className="text-sm text-muted-foreground">
              EPUB · DOCX · PDF manuscrito · Spread imprimible de portada · Variantes · JSON del libro · Reporte KDP.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Download className="h-3 w-3" /> 1-click bundle
        </Badge>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={run}
          disabled={busy}
          className="primary-gradient text-primary-foreground shadow-soft text-base"
        >
          {busy ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Package className="mr-2 h-5 w-5" />
          )}
          {busy ? "Armando Library Pack…" : "📦 Descargar Library Pack"}
        </Button>
        {lastSize && !busy && (
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-500/40">
            <CheckCircle2 className="h-3 w-3" /> Último: {lastSize}
          </Badge>
        )}
      </div>

      {steps.length > 0 && (
        <div className="mt-5 space-y-1.5">
          {steps.map((s) => (
            <div
              key={s.step}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-1.5 text-xs"
            >
              {s.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {s.status === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {s.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              {s.status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
              <span className="flex-1 truncate">{s.label}</span>
              {s.detail && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">{s.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
