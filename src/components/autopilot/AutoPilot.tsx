import { useServerFn } from "@tanstack/react-start";
import { useBookStore, newUuid } from "@/lib/store";
import {
  aiDigitalFootprint, aiPersona, aiStructure, aiWriteChapter,
  aiText, aiDeepScrape, aiCoverPromptPack, aiImage,
  aiAuthorAvatarPrompt, aiMarketing,
} from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Check, Sparkles, AlertTriangle, Bot } from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";

const PHASES = [
  { key: "dna", label: "Reconstruir ADN del autor" },
  { key: "structure", label: "Estructurar capítulos" },
  { key: "writing", label: "Redactar libro completo" },
  { key: "metadata", label: "Metadatos y bio" },
  { key: "cover", label: "Portada + foto autor 4K" },
  { key: "marketing", label: "Activos de lanzamiento" },
] as const;

export function AutoPilot({ chapterCount = 10 }: { chapterCount?: number }) {
  const state = useBookStore();
  const set = useBookStore.setState;
  const footprintFn = useServerFn(aiDigitalFootprint);
  const personaFn = useServerFn(aiPersona);
  const structureFn = useServerFn(aiStructure);
  const writeFn = useServerFn(aiWriteChapter);
  const textFn = useServerFn(aiText);
  const scrapeFn = useServerFn(aiDeepScrape);
  const coverFn = useServerFn(aiCoverPromptPack);
  const imageFn = useServerFn(aiImage);
  const avatarPromptFn = useServerFn(aiAuthorAvatarPrompt);
  const marketingFn = useServerFn(aiMarketing);

  const { autoPilot, bookContext, publishingForm, authorDNA } = state;
  const running = autoPilot.phase !== "idle" && autoPilot.phase !== "done" && autoPilot.phase !== "error";

  const run = async () => {
    if (!bookContext.title || !bookContext.topic) {
      return toast.error("Elige un blueprint primero (Paso 1)");
    }
    if (!requireFeature("editor.ai", "Auto-Pilot")) return;

    const update = (patch: Partial<typeof autoPilot>) => state.setAutoPilot(patch);

    try {
      // 1. DNA
      update({ phase: "dna", message: "Reconstruyendo ADN del autor…", progress: 5 });
      const authorName = publishingForm.author || "Autor del libro";
      let bio = authorDNA.bio;
      if (!bio) {
        try {
          const fp = await footprintFn({ data: { name: authorName, context: bookContext.topic } });
          bio = fp.bio;
          state.setAuthorDNA({ bio: fp.bio, mission: fp.mission, voiceSamples: fp.voiceSamples });
        } catch { /* skip */ }
      }
      const { text: persona } = await personaFn({
        data: { bio: bio || bookContext.topic, mission: authorDNA.mission, voice: authorDNA.voiceSamples },
      });
      state.setAuthorDNA({ extractedPersona: persona });

      // 2. Structure
      update({ phase: "structure", message: `Generando ${chapterCount} capítulos…`, progress: 18 });
      const struct = await structureFn({
        data: { topic: bookContext.topic, title: bookContext.title, chapterCount },
      });
      const chapters = struct.chapters.map((c, i) => ({
        id: `${Date.now()}-${i}-${newUuid().slice(0, 6)}`,
        title: c.title, description: c.description, content: "", images: [], snapshots: [],
      }));
      state.setChapters(chapters);
      state.setBookContext({ title: struct.title || bookContext.title, subtitle: struct.subtitle || bookContext.subtitle });

      // 3. Writing — chained per chapter
      const total = chapters.length;
      for (let i = 0; i < total; i++) {
        update({
          phase: "writing",
          message: `Redactando capítulo ${i + 1}/${total}: ${chapters[i].title}`,
          progress: 22 + Math.round((i / total) * 40),
          chapterIndex: i + 1, chapterTotal: total,
        });
        try {
          const { text } = await writeFn({
            data: {
              chapterTitle: chapters[i].title,
              chapterDescription: chapters[i].description,
              persona,
              bible: state.storyBible,
            },
          });
          state.replaceChapterContent(chapters[i].id, text, `Auto-Pilot · ${chapters[i].title}`);
        } catch (e: any) {
          console.warn("Chapter failed", chapters[i].title, e?.message);
        }
      }

      // 4. Metadata + Market signals
      update({ phase: "metadata", message: "Metadatos + Market signals…", progress: 70 });
      try {
        const ms = await scrapeFn({
          data: { title: bookContext.title, subtitle: bookContext.subtitle, niche: bookContext.topic, synopsis: publishingForm.description },
        });
        state.setMarketSignals({ ...ms, generatedAt: new Date().toISOString() });
        state.setPublishingForm({
          keywords: ms.keywords.slice(0, 7).join(", "),
          categories: ms.bisac.slice(0, 3).join(" | "),
          pricePhysical: ms.priceSweetSpot.physical,
          priceDigital: ms.priceSweetSpot.digital,
        });
      } catch { /* skip */ }

      try {
        const { text: meta } = await textFn({
          data: {
            prompt: `Genera JSON puro con sinopsis comercial (4-6 frases) y biografía de contraportada (30-40 palabras) para "${bookContext.title}" — autor: ${authorName}. Bio fuente: ${(bio || "").slice(0, 500)}. Formato: {"description":"…","shortBio":"…"}`,
          },
        });
        const m = meta.match(/\{[\s\S]*\}/);
        if (m) {
          const j = JSON.parse(m[0]);
          state.setPublishingForm({
            description: j.description || publishingForm.description,
            shortBio: j.shortBio || publishingForm.shortBio,
            author: publishingForm.author || authorName,
          });
        }
      } catch { /* skip */ }

      // 5. Cover + Author avatar in parallel
      update({ phase: "cover", message: "Portada IA + foto autor 4K…", progress: 82 });
      try {
        const [pack, avatarPromptRes] = await Promise.all([
          coverFn({ data: { title: bookContext.title, subtitle: bookContext.subtitle, author: authorName, niche: bookContext.topic } }),
          avatarPromptFn({ data: { name: authorName, bio, tone: "bestselling author editorial portrait" } }),
        ]);
        const [cover, avatar] = await Promise.all([
          imageFn({ data: { prompt: pack.variants[0].prompt, aspectRatio: "3:4" } }).catch(() => null),
          imageFn({ data: { prompt: avatarPromptRes.prompt, aspectRatio: "3:4" } }).catch(() => null),
        ]);
        if (cover) state.setBookCover(cover.dataUrl);
        if (avatar) state.setAuthorPhoto(avatar.dataUrl);
      } catch (e) {
        console.warn("Cover/avatar partial", e);
      }

      // 6. Marketing assets
      update({ phase: "marketing", message: "Emails + posts + trailer…", progress: 92 });
      const kinds = ["emails", "social", "trailer"] as const;
      const results = await Promise.allSettled(
        kinds.map((k) => marketingFn({ data: { kind: k, title: bookContext.title, synopsis: publishingForm.description, persona } })),
      );
      const next: any = {};
      results.forEach((r, i) => { if (r.status === "fulfilled") next[kinds[i]] = r.value.text; });
      state.setLaunchKit(next);

      // Done — mark steps complete
      [1, 2, 3, 4, 5, 6].forEach((n) => state.markStepComplete(n));
      update({ phase: "done", message: "Libro completo listo · vista previa lista para publicar", progress: 100 });
      toast.success("🚀 Libro completo generado por Auto-Pilot");
    } catch (e: any) {
      update({ phase: "error", message: e?.message || "Error en Auto-Pilot", progress: 0 });
      toast.error(e?.message || "Auto-Pilot falló");
    }
  };

  return (
    <Card className="relative overflow-hidden rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 to-[color:var(--ai)]/5 p-6 shadow-luxe">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-soft">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-semibold">Auto-Pilot del libro completo</h3>
              <Badge className="primary-gradient text-primary-foreground">EMPIRE</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Encadena ADN → estructura → redacción de todos los capítulos → metadatos → portada KDP 4K + foto del autor → activos de lanzamiento. Resultado: libro entero listo para publicar.
            </p>
          </div>
        </div>
        <Button onClick={run} disabled={running} size="lg" className="primary-gradient text-primary-foreground shadow-soft">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {autoPilot.phase === "done" ? "Re-generar" : running ? "Generando…" : "Lanzar Auto-Pilot"}
        </Button>
      </div>

      {(running || autoPilot.phase === "done" || autoPilot.phase === "error") && (
        <div className="mt-5 space-y-3 animate-fade-in">
          <Progress value={autoPilot.progress} className="h-2" />
          <div className="flex items-center gap-2 text-sm">
            {autoPilot.phase === "error" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : autoPilot.phase === "done" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            )}
            <span className="text-foreground/80">{autoPilot.message}</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {PHASES.map((p) => {
              const done =
                autoPilot.phase === "done" ||
                PHASES.findIndex((x) => x.key === autoPilot.phase) > PHASES.findIndex((x) => x.key === p.key);
              const active = autoPilot.phase === p.key;
              return (
                <div
                  key={p.key}
                  className={
                    "rounded-lg border px-2 py-1.5 text-[10px] font-medium transition " +
                    (done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : active ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 bg-secondary/40 text-muted-foreground")
                  }
                >
                  {done && "✓ "}{p.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
