import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import {
  aiTitleSuggestions,
  aiStructure,
  aiWriteChapter,
  aiInlineEdit,
  aiBetaReader,
  aiFactCheck,
  aiImage,
} from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Wand2,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  History,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Image as ImageIcon,
  ScrollText,
  ShieldCheck,
  MessageSquare,
  Layers,
  Grid3X3,
} from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { TiptapEditor } from "@/components/TiptapEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ManuscriptTab({ forceView }: { forceView?: "corkboard" | "editor" } = {}) {
  const {
    bookContext,
    setBookContext,
    chapters,
    setChapters,
    addChapter,
    deleteChapter,
    moveChapter,
    updateChapter,
    replaceChapterContent,
    activeChapterId,
    setActiveChapterId,
    saveSnapshot,
    authorDNA,
    storyBible,
    setStoryBible,
  } = useBookStore();

  const [chapterCount, setChapterCount] = useState(8);
  const [viewState, setView] = useState<"corkboard" | "editor">(forceView || "corkboard");
  const view = forceView || viewState;
  const [busy, setBusy] = useState<string>("");
  const [titleModal, setTitleModal] = useState<
    null | { suggestions: { title: string; subtitle: string; psychology: string }[] }
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [betaReport, setBetaReport] = useState<string | null>(null);
  const [factReport, setFactReport] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");

  const titlesFn = useServerFn(aiTitleSuggestions);
  const structureFn = useServerFn(aiStructure);
  const writeFn = useServerFn(aiWriteChapter);
  const inlineFn = useServerFn(aiInlineEdit);
  const betaFn = useServerFn(aiBetaReader);
  const factFn = useServerFn(aiFactCheck);
  const imageFn = useServerFn(aiImage);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  const active = chapters.find((c) => c.id === activeChapterId) || null;

  useEffect(() => {
    if (!active && chapters.length > 0 && view === "editor") {
      setActiveChapterId(chapters[0].id);
    }
  }, [active, chapters, view, setActiveChapterId]);

  const generateTitles = async () => {
    if (!bookContext.topic) return toast.error("Ingresa el tema del libro");
    setBusy("titles");
    try {
      const r = await titlesFn({ data: { topic: bookContext.topic, authorBio: authorDNA.bio } });
      setTitleModal({ suggestions: r.suggestions });
    } catch (e: any) {
      toast.error(e.message || "Error generando títulos");
    } finally {
      setBusy("");
    }
  };

  const generateStructure = async () => {
    if (!bookContext.topic) return toast.error("Ingresa el tema del libro");
    setBusy("structure");
    try {
      const r = await structureFn({
        data: { topic: bookContext.topic, title: bookContext.title, chapterCount },
      });
      setBookContext({ title: r.title || bookContext.title, subtitle: r.subtitle || bookContext.subtitle });
      const newChapters = r.chapters.map((c, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        title: c.title,
        description: c.description,
        content: "",
        images: [],
        snapshots: [],
      }));
      setChapters(newChapters);
      setActiveChapterId(newChapters[0]?.id || null);
      setView("corkboard");
      toast.success("Estructura generada");
    } catch (e: any) {
      toast.error(e.message || "Error en la estructura");
    } finally {
      setBusy("");
    }
  };

  const writeChapter = async (id: string) => {
    const ch = chapters.find((c) => c.id === id);
    if (!ch) return;
    saveSnapshot(id, "Pre-redacción IA");
    setBusy("write-" + id);
    try {
      const { text } = await writeFn({
        data: {
          chapterTitle: ch.title,
          chapterDescription: ch.description,
          persona: authorDNA.extractedPersona,
          bible: storyBible,
        },
      });
      replaceChapterContent(id, text, `Redacción IA · ${ch.title}`);
      setStoryBible(
        (storyBible ? storyBible + "\n\n" : "") +
          `[${ch.title}]\n` +
          text.split(/\s+/).slice(0, 60).join(" ") +
          "…",
      );
      toast.success("Capítulo redactado · Ctrl+Z para deshacer");
    } catch (e: any) {
      toast.error(e.message || "Error redactando capítulo");
    } finally {
      setBusy("");
    }
  };

  /** Inline AI edit: returns the IA-rewritten text so Tiptap can replace the selection. */
  const inlineEdit = async (text: string, action: "expand" | "rewrite" | "bestseller" | "shorten") => {
    if (!active) return text;
    saveSnapshot(active.id, `IA · ${action}`);
    setBusy("inline");
    try {
      const { text: out } = await inlineFn({
        data: { text, action, persona: authorDNA.extractedPersona },
      });
      toast.success("Edición aplicada · Ctrl+Z para deshacer");
      return out;
    } catch (e: any) {
      toast.error(e.message || "Error en edición IA");
      return text;
    } finally {
      setBusy("");
    }
  };

  const runBeta = async () => {
    if (!active) return;
    if ((active.content || "").length < 100) return toast.error("Escribe más antes de pedir crítica");
    setBusy("beta");
    try {
      const { text } = await betaFn({ data: { content: active.content } });
      setBetaReport(text);
    } catch (e: any) {
      toast.error(e.message || "Error en crítica");
    } finally {
      setBusy("");
    }
  };

  const runFact = async () => {
    if (!active || !active.content) return;
    setBusy("fact");
    try {
      const { text } = await factFn({ data: { content: active.content } });
      setFactReport(text);
    } catch (e: any) {
      toast.error(e.message || "Error en fact-check");
    } finally {
      setBusy("");
    }
  };

  const generateInlineImage = async () => {
    if (!active || !imagePrompt.trim()) return;
    setBusy("image");
    try {
      const { dataUrl } = await imageFn({
        data: {
          prompt: `Diseño editorial profesional, minimalista, alta calidad: ${imagePrompt}`,
          aspectRatio: "16:9",
        },
      });
      const newImages = [...(active.images || []), dataUrl];
      const tag = `\n\n[ILUSTRACION:${newImages.length - 1}]\n\n`;
      const ta = editorRef.current;
      let next = active.content;
      if (ta) {
        next = next.slice(0, ta.selectionStart) + tag + next.slice(ta.selectionEnd);
      } else {
        next += tag;
      }
      updateChapter(active.id, { content: next, images: newImages });
      setImageModal(false);
      setImagePrompt("");
      toast.success("Ilustración inyectada");
    } catch (e: any) {
      toast.error(e.message || "Error generando imagen");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Book context card */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Tema central del libro</Label>
              <Textarea
                rows={2}
                placeholder="¿De qué trata? ¿A quién va dirigido? ¿Qué transformación promete?"
                value={bookContext.topic}
                onChange={(e) => setBookContext({ topic: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Título</Label>
                <Input
                  value={bookContext.title}
                  onChange={(e) => setBookContext({ title: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Subtítulo</Label>
                <Input
                  value={bookContext.subtitle}
                  onChange={(e) => setBookContext({ subtitle: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Capítulos</Label>
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={chapterCount}
                  onChange={(e) => setChapterCount(parseInt(e.target.value) || 6)}
                  className="mt-1.5 w-24"
                />
              </div>
              <Button
                onClick={generateStructure}
                disabled={busy === "structure"}
                className="primary-gradient text-primary-foreground hover:opacity-95"
              >
                <Layers className="mr-2 h-4 w-4" />
                {busy === "structure" ? "Compilando…" : "Generar estructura"}
              </Button>
              <Button variant="outline" onClick={generateTitles} disabled={busy === "titles"}>
                <Sparkles className="mr-2 h-4 w-4 text-[color:var(--ai)]" />
                Brainstorm de títulos
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-secondary/40 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vista actual
            </div>
            <div className="mt-2 font-display text-xl font-semibold">{bookContext.title}</div>
            <div className="text-sm italic text-muted-foreground">{bookContext.subtitle}</div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant={view === "corkboard" ? "default" : "outline"}
                onClick={() => setView("corkboard")}
              >
                <Grid3X3 className="mr-1.5 h-3.5 w-3.5" /> Corcho
              </Button>
              <Button
                size="sm"
                variant={view === "editor" ? "default" : "outline"}
                onClick={() => {
                  if (!chapters.length) return toast.error("Genera la estructura primero");
                  setActiveChapterId(activeChapterId || chapters[0].id);
                  setView("editor");
                }}
              >
                <ScrollText className="mr-1.5 h-3.5 w-3.5" /> Editor
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {view === "corkboard" ? (
        <Corkboard
          chapters={chapters}
          busy={busy}
          onWrite={writeChapter}
          onEdit={(id) => {
            setActiveChapterId(id);
            setView("editor");
          }}
          onAdd={() => {
            addChapter();
            toast.success("Capítulo añadido");
          }}
          onMove={(id, d) => {
            moveChapter(id, d);
            toast("Capítulo movido", {
              action: {
                label: "Deshacer",
                onClick: () => moveChapter(id, (-d) as -1 | 1),
              },
            });
          }}
          onUpdate={updateChapter}
          onDelete={(id) => setConfirmDelete(id)}
        />
      ) : (
        active && (
          <Editor
            chapter={active}
            onChange={(v: string) => updateChapter(active.id, { content: v })}
            onTitleChange={(v: string) => updateChapter(active.id, { title: v })}
            inlineEdit={inlineEdit}
            chapters={chapters}
            setActiveChapterId={setActiveChapterId}
            onHistory={() => setHistoryFor(active.id)}
            onBeta={runBeta}
            onFact={runFact}
            onImage={() => setImageModal(true)}
            busy={busy}
            font={"Lora"}
          />
        )
      )}

      {/* Title brainstorm modal */}
      <Dialog open={!!titleModal} onOpenChange={(o) => !o && setTitleModal(null)}>
        <DialogContent className="max-w-2xl animate-zoom-in">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Títulos magnéticos</DialogTitle>
            <DialogDescription>5 propuestas comerciales con su psicología.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {titleModal?.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setBookContext({ title: s.title, subtitle: s.subtitle });
                  setTitleModal(null);
                  toast.success("Título aplicado");
                }}
                className="w-full rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/40 hover:bg-secondary/40"
              >
                <div className="font-display text-lg font-semibold">{s.title}</div>
                <div className="text-sm italic text-muted-foreground">{s.subtitle}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3 text-[color:var(--ai)]" />
                  {s.psychology}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="animate-zoom-in">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar capítulo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  const ch = chapters.find((c) => c.id === confirmDelete);
                  const idx = chapters.findIndex((c) => c.id === confirmDelete);
                  deleteChapter(confirmDelete);
                  if (ch) {
                    toast.success("Capítulo eliminado", {
                      action: {
                        label: "Deshacer",
                        onClick: () => {
                          const cur = useBookStore.getState().chapters;
                          const next = [...cur];
                          next.splice(Math.min(idx, next.length), 0, ch);
                          setChapters(next);
                          toast.success("Capítulo restaurado");
                        },
                      },
                    });
                  }
                }
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History modal */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-3xl animate-zoom-in">
          <DialogHeader>
            <DialogTitle>Historial de versiones</DialogTitle>
            <DialogDescription>Restaurar una versión guarda un snapshot previo.</DialogDescription>
          </DialogHeader>
          {(() => {
            const ch = chapters.find((c) => c.id === historyFor);
            if (!ch) return null;
            return (
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                {ch.snapshots.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aún no hay versiones guardadas.</p>
                )}
                {[...ch.snapshots].reverse().map((s, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{s.type}</div>
                        <div className="text-xs text-muted-foreground">{s.timestamp}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          saveSnapshot(ch.id, "Backup pre-restauración");
                          updateChapter(ch.id, { content: s.content });
                          setHistoryFor(null);
                          toast.success("Versión restaurada");
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {s.content.slice(0, 240)}…
                    </p>
                  </Card>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Beta reader */}
      <Dialog open={!!betaReport} onOpenChange={(o) => !o && setBetaReport(null)}>
        <DialogContent className="max-w-2xl animate-zoom-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Crítica del Editor Senior
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">{betaReport && <Markdown source={betaReport} />}</div>
        </DialogContent>
      </Dialog>

      {/* Fact check */}
      <Dialog open={!!factReport} onOpenChange={(o) => !o && setFactReport(null)}>
        <DialogContent className="max-w-2xl animate-zoom-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Auditoría de hechos
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">{factReport && <Markdown source={factReport} />}</div>
        </DialogContent>
      </Dialog>

      {/* Image generation modal */}
      <Dialog open={imageModal} onOpenChange={setImageModal}>
        <DialogContent className="animate-zoom-in">
          <DialogHeader>
            <DialogTitle>Generar ilustración</DialogTitle>
            <DialogDescription>Se inyecta en el cursor del editor.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Describe la imagen: estilo, composición, atmósfera…"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImageModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={generateInlineImage}
              disabled={busy === "image" || !imagePrompt.trim()}
              className="ai-gradient text-[color:var(--ai-foreground)]"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              {busy === "image" ? "Renderizando…" : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- Sub-components ----------------- */

function Corkboard({
  chapters,
  busy,
  onWrite,
  onEdit,
  onAdd,
  onMove,
  onUpdate,
  onDelete,
}: {
  chapters: ReturnType<typeof useBookStore.getState>["chapters"];
  busy: string;
  onWrite: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, d: -1 | 1) => void;
  onUpdate: (id: string, p: any) => void;
  onDelete: (id: string) => void;
}) {
  if (chapters.length === 0) {
    return (
      <Card className="rounded-2xl border-border/70 p-12 text-center shadow-soft animate-fade-in">
        <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-display text-xl font-semibold">Tu corcho está vacío</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera una estructura desde el panel superior para empezar.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {chapters.map((ch, i) => {
        const wc = ch.content ? ch.content.trim().split(/\s+/).filter(Boolean).length : 0;
        const written = wc > 50;
        return (
          <Card
            key={ch.id}
            className="group flex flex-col rounded-2xl border-border/70 p-5 shadow-soft transition hover:shadow-elevated"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Capítulo {i + 1}
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(ch.id, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(ch.id, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onDelete(ch.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Input
              className="mt-2 border-0 bg-transparent px-0 font-display text-lg font-semibold focus-visible:ring-0"
              value={ch.title}
              onChange={(e) => onUpdate(ch.id, { title: e.target.value })}
            />
            <Textarea
              rows={3}
              className="mt-1 resize-none border-0 bg-transparent px-0 text-sm text-muted-foreground focus-visible:ring-0"
              value={ch.description}
              onChange={(e) => onUpdate(ch.id, { description: e.target.value })}
            />
            <div className="mt-auto flex items-center justify-between pt-3">
              <Badge
                variant="secondary"
                className={
                  written
                    ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    : "bg-secondary text-muted-foreground"
                }
              >
                {written ? `${wc.toLocaleString()} palabras` : "Sin redactar"}
              </Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(ch.id)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="ai-gradient text-[color:var(--ai-foreground)]"
                  onClick={() => onWrite(ch.id)}
                  disabled={busy === "write-" + ch.id}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  {busy === "write-" + ch.id ? "…" : "Escribir IA"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
      <button
        onClick={onAdd}
        className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-5 text-muted-foreground transition hover:border-primary/40 hover:bg-secondary"
      >
        <PlusCircle className="h-8 w-8" />
        <span className="mt-2 text-sm font-medium">Añadir capítulo</span>
      </button>
    </div>
  );
}

function Editor({
  chapter,
  onChange,
  onTitleChange,
  inlineEdit,
  chapters,
  setActiveChapterId,
  onHistory,
  onBeta,
  onFact,
  onImage,
  busy,
  font,
}: any) {
  const wc = chapter.content
    ? chapter.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit rounded-2xl border-border/70 p-3 shadow-soft">
        <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Capítulos
        </div>
        <div className="space-y-1">
          {chapters.map((c: any, i: number) => (
            <button
              key={c.id}
              onClick={() => setActiveChapterId(c.id)}
              className={
                "w-full rounded-lg px-3 py-2 text-left text-sm transition " +
                (c.id === chapter.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-foreground/80")
              }
            >
              <div className="text-[10px] uppercase tracking-wider opacity-70">Cap {i + 1}</div>
              <div className="line-clamp-1 font-medium">{c.title}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-soft animate-fade-in">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
          <Badge variant="secondary" className="rounded-full text-[10px]">
            <Sparkles className="mr-1 h-3 w-3 text-[color:var(--ai)]" />
            Selecciona texto para editar con IA
          </Badge>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={onImage}>
            <ImageIcon className="mr-1.5 h-4 w-4" /> Imagen
          </Button>
          <Button size="sm" variant="ghost" onClick={onHistory}>
            <History className="mr-1.5 h-4 w-4" /> Historial
          </Button>
          <Button size="sm" variant="ghost" onClick={onBeta} disabled={busy === "beta"}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Editor Senior
          </Button>
          <Button size="sm" variant="ghost" onClick={onFact} disabled={busy === "fact"}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Fact-check
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {wc.toLocaleString()} palabras
            </Badge>
          </div>
        </div>

        <div className="px-6 pt-5">
          <Input
            value={chapter.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="border-0 bg-transparent px-0 font-display text-2xl font-bold focus-visible:ring-0"
          />
        </div>

        <TiptapEditor
          markdown={chapter.content}
          onMarkdownChange={onChange}
          onInlineEdit={inlineEdit}
          fontFamily={font}
        />
      </Card>
    </div>
  );
}
