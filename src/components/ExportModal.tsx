import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useBookStore, wordCount } from "@/lib/store";
import {
  exportPDF,
  exportEPUB,
  exportDOCX,
  buildPreview,
  type ProgressStep,
  type ExportOptions,
  ExportStepError,
} from "@/lib/export";
import { toast } from "sonner";
import {
  FileText,
  BookMarked,
  FileType2,
  Download,
  Loader2,
  BookOpen,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowLeft,
  Eye,
  ChevronRight,
  X,
  RotateCcw,
} from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

type Phase = "choose" | "preview" | "exporting" | "done" | "error";
type Kind = "pdf" | "epub" | "docx";

export function ExportModal({ open, onOpenChange }: Props) {
  const state = useBookStore();
  const [phase, setPhase] = useState<Phase>("choose");
  const [kind, setKind] = useState<Kind>("pdf");
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [errMsg, setErrMsg] = useState<string>("");
  const [useRange, setUseRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const wc = wordCount(state.chapters);

  useEffect(() => {
    if (open) setRangeTo(Math.max(1, state.chapters.length));
  }, [open, state.chapters.length]);

  const options: ExportOptions | undefined = useMemo(() => {
    if (!useRange || !state.chapters.length) return undefined;
    return { chapterRange: { from: rangeFrom, to: rangeTo } };
  }, [useRange, rangeFrom, rangeTo, state.chapters.length]);

  const payload = useMemo(
    () => ({
      bookContext: state.bookContext,
      publishingForm: state.publishingForm,
      frontBackMatter: state.frontBackMatter,
      chapters: state.chapters,
      authorDNA: state.authorDNA,
      bookCover: state.bookCover,
    }),
    [state.bookContext, state.publishingForm, state.frontBackMatter, state.chapters, state.authorDNA, state.bookCover],
  );

  const preview = useMemo(() => (open ? buildPreview(payload, options) : null), [open, payload, options]);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("choose");
    setSteps([]);
    setErrMsg("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const choose = (k: Kind) => {
    if (!state.chapters.length) {
      toast.error("Genera la estructura y redacta al menos un capítulo");
      return;
    }
    setKind(k);
    setPhase("preview");
  };

  const run = async () => {
    setPhase("exporting");
    setErrMsg("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const opts: ExportOptions = { ...(options || {}), signal: ac.signal };
    try {
      const fn = kind === "pdf" ? exportPDF : kind === "epub" ? exportEPUB : exportDOCX;
      await fn(payload, (s) => setSteps(s), opts);
      setPhase("done");
      toast.success(`${kind.toUpperCase()} descargado`);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        toast("Exportación cancelada");
        setPhase("preview");
        return;
      }
      const msg = e instanceof ExportStepError ? `${e.stepId}: ${e.message}` : e?.message || "Error desconocido";
      setErrMsg(msg);
      setPhase("error");
      toast.error(`Error en la exportación · ${msg}`);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl animate-zoom-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Download className="h-5 w-5" /> Exportar manuscrito
          </DialogTitle>
          <DialogDescription>
            {phase === "choose" && "Elige el formato listo para Amazon KDP, Apple Books o impresión bajo demanda."}
            {phase === "preview" && "Revisa la maqueta y selecciona el rango antes de descargar."}
            {phase === "exporting" && `Generando ${kind.toUpperCase()}…`}
            {phase === "done" && "Tu archivo se descargó correctamente."}
            {phase === "error" && "Algo falló. Puedes reintentar el paso fallido."}
          </DialogDescription>
        </DialogHeader>

        {/* Phase: Choose */}
        {phase === "choose" && (
          <>
            <div className="grid gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 sm:grid-cols-3">
              <Stat label="Título" value={state.bookContext.title || "—"} />
              <Stat label="Capítulos" value={String(state.chapters.length)} />
              <Stat label="Palabras" value={wc.toLocaleString()} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormatCard
                icon={<FileText className="h-5 w-5" />}
                title="PDF profesional"
                desc="Formato A5 con portada, tipografía serif y front/back matter."
                onClick={() => choose("pdf")}
                cta="Previsualizar PDF"
              />
              <FormatCard
                icon={<BookMarked className="h-5 w-5" />}
                title="EPUB 3.0"
                desc="Reflowable, índice navegable, portada e ilustraciones."
                onClick={() => choose("epub")}
                cta="Previsualizar EPUB"
                accent
              />
              <FormatCard
                icon={<FileType2 className="h-5 w-5" />}
                title="Manuscrito Word (.docx)"
                desc="Listo para editoriales tradicionales. Estilos H1/H2 nativos."
                onClick={() => choose("docx")}
                cta="Previsualizar DOCX"
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs text-muted-foreground">
              <BookOpen className="mt-0.5 h-3.5 w-3.5" />
              <span>Los metadatos (autor, descripción, keywords) se incrustan automáticamente.</span>
            </div>
          </>
        )}

        {/* Phase: Preview */}
        {phase === "preview" && preview && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Switch id="range-tog" checked={useRange} onCheckedChange={setUseRange} />
                <Label htmlFor="range-tog" className="text-sm font-medium">
                  Exportar solo un rango de capítulos
                </Label>
              </div>
              {useRange && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Del</span>
                  <Input
                    type="number"
                    min={1}
                    max={state.chapters.length}
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(Math.max(1, Math.min(state.chapters.length, +e.target.value || 1)))}
                    className="h-8 w-16"
                  />
                  <span className="text-muted-foreground">al</span>
                  <Input
                    type="number"
                    min={rangeFrom}
                    max={state.chapters.length}
                    value={rangeTo}
                    onChange={(e) =>
                      setRangeTo(Math.max(rangeFrom, Math.min(state.chapters.length, +e.target.value || rangeFrom)))
                    }
                    className="h-8 w-16"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 max-h-[55vh] overflow-auto pr-1 animate-fade-in md:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-secondary shadow-elevated">
                  {preview.cover ? (
                    <img src={preview.cover} alt="Portada" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-[color:var(--ai)]/20 p-4 text-center">
                      <div>
                        <div className="font-display text-sm font-semibold">{preview.title}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {preview.author}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-border/60 bg-surface px-2 py-1.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground">{preview.totalWords.toLocaleString()} palabras</div>
                  <div>{preview.toc.length} entradas en índice</div>
                  <div className="mt-1 rounded bg-secondary px-1.5 py-0.5 text-center font-mono text-[10px] uppercase">
                    {kind}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-surface p-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="h-3 w-3" /> Metadatos
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold leading-tight">{preview.title}</h3>
                  {preview.subtitle && <p className="text-sm italic text-muted-foreground">{preview.subtitle}</p>}
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">por {preview.author}</p>
                  {preview.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{preview.description}</p>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-surface p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tabla de contenidos {useRange ? `(cap. ${rangeFrom}–${rangeTo})` : ""}
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {preview.toc.map((t) => (
                      <li key={t.id}>
                        <div className="flex items-baseline gap-2">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span
                            className={
                              t.kind === "chapter"
                                ? "font-medium"
                                : "text-xs uppercase tracking-wider text-muted-foreground"
                            }
                          >
                            {t.label}
                          </span>
                        </div>
                        {t.subItems && t.subItems.length > 0 && (
                          <ul className="ml-5 mt-0.5 space-y-0.5">
                            {t.subItems.map((s) => (
                              <li
                                key={s.id}
                                className={"text-xs text-muted-foreground " + (s.level === 3 ? "ml-3" : "")}
                              >
                                · {s.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Phase: Exporting / Done / Error */}
        {(phase === "exporting" || phase === "done" || phase === "error") && (
          <div className="space-y-2 animate-fade-in">
            {steps.map((s) => (
              <StepRow key={s.id} step={s} />
            ))}
            {phase === "error" && errMsg && (
              <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="font-semibold">Paso fallido</div>
                <div className="mt-0.5 text-xs">{errMsg}</div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === "choose" && (
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Cerrar
            </Button>
          )}
          {phase === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setPhase("choose")}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Cambiar formato
              </Button>
              <Button
                onClick={run}
                className={
                  kind === "epub"
                    ? "ai-gradient text-[color:var(--ai-foreground)]"
                    : "primary-gradient text-primary-foreground"
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar {kind.toUpperCase()}
              </Button>
            </>
          )}
          {phase === "exporting" && (
            <>
              <Button variant="outline" onClick={cancel}>
                <X className="mr-1.5 h-4 w-4" /> Cancelar
              </Button>
              <Button variant="ghost" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando…
              </Button>
            </>
          )}
          {phase === "error" && (
            <>
              <Button variant="ghost" onClick={() => setPhase("preview")}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver
              </Button>
              <Button onClick={run} className="primary-gradient text-primary-foreground">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reintentar
              </Button>
            </>
          )}
          {phase === "done" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Exportar otro formato
              </Button>
              <Button onClick={() => handleClose(false)}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepRow({ step }: { step: ProgressStep }) {
  const Icon =
    step.status === "done"
      ? CheckCircle2
      : step.status === "error"
        ? AlertCircle
        : step.status === "active"
          ? Loader2
          : Circle;
  const color =
    step.status === "done"
      ? "text-[color:var(--success)]"
      : step.status === "error"
        ? "text-destructive"
        : step.status === "active"
          ? "text-primary"
          : "text-muted-foreground/60";
  return (
    <div
      className={
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition " +
        (step.status === "active"
          ? "border-primary/40 bg-primary/5 shadow-soft"
          : step.status === "done"
            ? "border-border/60 bg-surface"
            : step.status === "error"
              ? "border-destructive/40 bg-destructive/5"
              : "border-border/40 bg-secondary/30")
      }
    >
      <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + color + (step.status === "active" ? " animate-spin" : "")} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{step.label}</div>
        {step.detail && <div className="mt-0.5 truncate text-xs text-muted-foreground">{step.detail}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-display text-base font-semibold">{value}</div>
    </div>
  );
}

function FormatCard({
  icon,
  title,
  desc,
  onClick,
  cta,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
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
        className={
          "mt-4 " +
          (accent ? "ai-gradient text-[color:var(--ai-foreground)]" : "primary-gradient text-primary-foreground")
        }
      >
        <Eye className="mr-2 h-4 w-4" />
        {cta}
      </Button>
    </div>
  );
}
