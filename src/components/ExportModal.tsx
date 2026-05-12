import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBookStore, wordCount } from "@/lib/store";
import { exportPDF, exportEPUB } from "@/lib/export";
import { toast } from "sonner";
import { FileText, BookMarked, Download, Loader2, BookOpen } from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function ExportModal({ open, onOpenChange }: Props) {
  const state = useBookStore();
  const [busy, setBusy] = useState<"pdf" | "epub" | null>(null);
  const wc = wordCount(state.chapters);

  const payload = {
    bookContext: state.bookContext,
    publishingForm: state.publishingForm,
    frontBackMatter: state.frontBackMatter,
    chapters: state.chapters,
    authorDNA: state.authorDNA,
    bookCover: state.bookCover,
  };

  const run = async (kind: "pdf" | "epub") => {
    if (!state.chapters.length) {
      toast.error("Genera la estructura y redacta al menos un capítulo");
      return;
    }
    setBusy(kind);
    const t = toast.loading(kind === "pdf" ? "Componiendo PDF…" : "Empaquetando EPUB…");
    try {
      if (kind === "pdf") await exportPDF(payload);
      else await exportEPUB(payload);
      toast.success(kind === "pdf" ? "PDF descargado" : "EPUB descargado", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "Error en la exportación", { id: t });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl animate-zoom-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Download className="h-5 w-5" /> Exportar manuscrito
          </DialogTitle>
          <DialogDescription>
            Genera un archivo listo para Amazon KDP, Apple Books o impresión bajo demanda.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 sm:grid-cols-3">
          <Stat label="Título" value={state.bookContext.title || "—"} />
          <Stat label="Capítulos" value={String(state.chapters.length)} />
          <Stat label="Palabras" value={wc.toLocaleString()} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormatCard
            icon={<FileText className="h-5 w-5" />}
            title="PDF profesional"
            desc="Formato A5 con portada, tipografía serif y front/back matter."
            onClick={() => run("pdf")}
            busy={busy === "pdf"}
            cta="Descargar PDF"
          />
          <FormatCard
            icon={<BookMarked className="h-5 w-5" />}
            title="EPUB 3.0"
            desc="Reflowable, con índice navegable, portada e ilustraciones."
            onClick={() => run("epub")}
            busy={busy === "epub"}
            cta="Descargar EPUB"
            accent
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs text-muted-foreground">
          <BookOpen className="mt-0.5 h-3.5 w-3.5" />
          <span>
            Los metadatos (autor, descripción, keywords) se incrustan automáticamente en ambos formatos.
          </span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate font-display text-base font-semibold">{value}</div>
    </div>
  );
}

function FormatCard({
  icon,
  title,
  desc,
  onClick,
  busy,
  cta,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  busy: boolean;
  cta: string;
  accent?: boolean;
}) {
  return (
    <div className="group flex flex-col rounded-2xl border border-border/70 bg-surface p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated">
      <div
        className={
          "flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground transition group-hover:scale-105 " +
          (accent ? "ai-gradient" : "primary-gradient")
        }
      >
        {icon}
      </div>
      <h4 className="mt-3 font-display text-lg font-semibold">{title}</h4>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
      <Button
        onClick={onClick}
        disabled={busy}
        className={
          "mt-4 " +
          (accent
            ? "ai-gradient text-[color:var(--ai-foreground)]"
            : "primary-gradient text-primary-foreground")
        }
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {busy ? "Generando…" : cta}
      </Button>
    </div>
  );
}
