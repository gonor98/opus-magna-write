import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  aiStructure, aiWriteChapter, aiTitleSuggestions, aiPersona, aiText,
} from "@/lib/ai.functions";
import { useBookStore, newUuid, type Chapter } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wand2, Loader2, BookOpenCheck, Sparkles, PenLine, RefreshCcw, Zap, Edit3, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";

export function AIBookBuilder() {
  const s = useBookStore();
  const [count, setCount] = useState(10);
  const [wordsPerChapter, setWordsPerChapter] = useState(1500);
  const [tone, setTone] = useState("Voz del autor, claridad, autoridad cálida");
  const [phase, setPhase] = useState<"idle" | "titles" | "persona" | "structure" | "writing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [currentMsg, setCurrentMsg] = useState("");
  const [regenIdx, setRegenIdx] = useState<number | null>(null);

  const fnTitles = useServerFn(aiTitleSuggestions);
  const fnPersona = useServerFn(aiPersona);
  const fnStructure = useServerFn(aiStructure);
  const fnWrite = useServerFn(aiWriteChapter);
  const fnText = useServerFn(aiText);

  const buildAll = async () => {
    if (!requireFeature("editor.ai", "Generación completa con IA")) return;
    if (!s.bookContext.topic.trim()) return toast.error("Define el tema del libro primero (Paso 1).");
    setPhase("titles"); setProgress(2); setCurrentMsg("✨ Generando títulos magnéticos…");

    try {
      // 1. Title
      if (!s.bookContext.title || /por definir/i.test(s.bookContext.title)) {
        const tt = await fnTitles({ data: { topic: s.bookContext.topic, authorBio: s.authorDNA.bio } });
        const best = tt.suggestions[0];
        useBookStore.getState().setBookContext({ title: best.title, subtitle: best.subtitle });
      }
      setProgress(10);

      // 2. Persona bible if missing
      if (!s.authorDNA.extractedPersona) {
        setPhase("persona"); setCurrentMsg("🧬 Sintetizando bible de voz…");
        const p = await fnPersona({ data: { bio: s.authorDNA.bio || "(genérico)", mission: s.authorDNA.mission, voiceSamples: s.authorDNA.voiceSamples || "" } });
        useBookStore.getState().setAuthorDNA({ extractedPersona: p.text || "" });
      }
      setProgress(20);

      // 3. Structure
      setPhase("structure"); setCurrentMsg(`🏗️ Diseñando ${count} capítulos coherentes…`);
      const st = await fnStructure({
        data: { topic: s.bookContext.topic, title: s.bookContext.title, chapterCount: count },
      });
      const newChapters: Chapter[] = (st.chapters || []).map((c: any) => ({
        id: newUuid(),
        title: c.title,
        description: c.description || c.summary || "",
        content: "",
        images: [],
        snapshots: [],
      }));
      useBookStore.getState().setChapters(newChapters);
      setProgress(30);

      // 4. Write each chapter
      setPhase("writing");
      for (let i = 0; i < newChapters.length; i++) {
        const ch = newChapters[i];
        setCurrentMsg(`✍️ Capítulo ${i + 1}/${newChapters.length}: ${ch.title}`);
        const w = await fnWrite({
          data: {
            chapterTitle: ch.title,
            description: ch.description,
            bookTitle: s.bookContext.title,
            topic: s.bookContext.topic,
            authorPersona: useBookStore.getState().authorDNA.extractedPersona,
            targetWords: wordsPerChapter,
            tone,
          },
        });
        useBookStore.getState().updateChapter(ch.id, { content: w.text || "" });
        setProgress(30 + Math.round(((i + 1) / newChapters.length) * 65));
      }

      // 5. Final polish — front/back matter
      setCurrentMsg("📖 Generando prólogo y agradecimientos…");
      const prologue = await fnText({
        data: { prompt: `Escribe un PRÓLOGO de 220-280 palabras para "${s.bookContext.title}" — tono "${tone}". Cierra con un gancho.`, system: "Eres editor jefe." },
      });
      const ack = await fnText({
        data: { prompt: `Escribe AGRADECIMIENTOS sinceros de 120 palabras para el libro "${s.bookContext.title}".`, system: "Eres editor jefe." },
      });
      useBookStore.getState().setFrontBackMatter({ prologue: prologue.text, acknowledgments: ack.text });

      setProgress(100); setPhase("done"); setCurrentMsg("✅ Libro completo generado.");
      toast.success(`¡Libro generado! ${newChapters.length} capítulos · ~${(newChapters.length * wordsPerChapter).toLocaleString()} palabras.`);
    } catch (e: any) {
      toast.error(e?.message || "Error generando libro");
      setPhase("idle");
    }
  };

  const regenChapter = async (idx: number) => {
    if (!requireFeature("editor.ai", "Reescritura IA")) return;
    const ch = s.chapters[idx]; if (!ch) return;
    setRegenIdx(idx);
    try {
      const w = await fnWrite({
        data: {
          chapterTitle: ch.title,
          description: ch.description,
          bookTitle: s.bookContext.title,
          topic: s.bookContext.topic,
          authorPersona: s.authorDNA.extractedPersona,
          targetWords: wordsPerChapter,
          tone,
        },
      });
      useBookStore.getState().replaceChapterContent(ch.id, w.text || "", `Regen IA · ${ch.title}`);
      toast.success(`Capítulo "${ch.title}" regenerado.`);
    } catch (e: any) {
      toast.error(e?.message || "Error en regeneración");
    } finally { setRegenIdx(null); }
  };

  const inProgress = phase !== "idle" && phase !== "done";
  const totalWords = s.chapters.reduce((a, c) => a + (c.content?.split(/\s+/).filter(Boolean).length || 0), 0);

  return (
    <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 via-background to-[color:var(--ai)]/5 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <BookOpenCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">AI Book Builder</h3>
            <p className="text-sm text-muted-foreground">
              Un botón. Título + estructura + cada capítulo + prólogo + agradecimientos. Editas lo que quieras después.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3 text-[color:var(--ai)]" /> AI End-to-End</Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <Label className="text-xs">Capítulos: <strong>{count}</strong></Label>
          <Slider min={5} max={25} step={1} value={[count]} onValueChange={(v) => setCount(v[0])} className="mt-2" />
        </div>
        <div>
          <Label className="text-xs">Palabras por capítulo: <strong>{wordsPerChapter}</strong></Label>
          <Slider min={600} max={3500} step={100} value={[wordsPerChapter]} onValueChange={(v) => setWordsPerChapter(v[0])} className="mt-2" />
        </div>
        <div>
          <Label className="text-xs">Tono / estilo</Label>
          <Input className="mt-2" value={tone} onChange={(e) => setTone(e.target.value)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={inProgress} onClick={buildAll}
          className="primary-gradient text-primary-foreground shadow-soft text-base">
          {inProgress ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
          {inProgress ? "Generando libro completo…" : "🚀 Generar libro completo con IA"}
        </Button>
        {phase === "done" && (
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-500/40">
            <CheckCircle2 className="h-3 w-3" /> {s.chapters.length} caps · {totalWords.toLocaleString()} palabras
          </Badge>
        )}
      </div>

      {inProgress && (
        <div className="mt-4 space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground">{currentMsg}</div>
        </div>
      )}

      {s.chapters.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Capítulos — edita manual o regenera con IA
          </div>
          {s.chapters.map((c, i) => {
            const wc = c.content?.split(/\s+/).filter(Boolean).length || 0;
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background p-3">
                <span className="font-mono text-xs text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">{wc.toLocaleString()} palabras{c.description ? ` · ${c.description.slice(0, 80)}` : ""}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => useBookStore.getState().setActiveChapterId(c.id)}>
                  <Edit3 className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="outline" disabled={regenIdx !== null} onClick={() => regenChapter(i)}>
                  {regenIdx === i ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1 h-3.5 w-3.5" />}
                  Regenerar
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
