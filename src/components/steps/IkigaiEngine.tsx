import { useState } from "react";
import { Sparkles, Upload, Mic, Loader2, TrendingUp, Target, Compass, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore, type Blueprint } from "@/lib/store";
import { aiGenerateBlueprints } from "@/lib/ai.functions";
import { parseManuscriptFile } from "@/lib/manuscript-parser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEMAND_LABEL: Record<Blueprint["demandBadge"], { label: string; cls: string }> = {
  high: { label: "🔥 Alta demanda", cls: "bg-red-500/10 text-red-700 border-red-200" },
  medium: { label: "📈 Demanda media", cls: "bg-amber-500/10 text-amber-700 border-amber-200" },
  niche: { label: "💎 Océano azul", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
};

export function IkigaiEngine() {
  const blueprints = useBookStore((s) => s.blueprints);
  const setBlueprints = useBookStore((s) => s.setBlueprints);
  const selectBlueprint = useBookStore((s) => s.selectBlueprint);
  const setBookContext = useBookStore((s) => s.setBookContext);
  const markStepComplete = useBookStore((s) => s.markStepComplete);
  const setStep = useBookStore((s) => s.setStep);

  const [passion, setPassion] = useState("");
  const [cvText, setCvText] = useState("");
  const [audioName, setAudioName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useServerFn(aiGenerateBlueprints);

  const handleCV = async (file: File) => {
    try {
      const result = await parseManuscriptFile(file);
      setCvText(result.markdown.slice(0, 4000));
      toast.success(`CV cargado: ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo leer el CV");
    }
  };

  const handleAudio = (file: File) => {
    setAudioName(file.name);
    toast.success(`Audio cargado: ${file.name} (transcripción Whisper en Fase 1)`);
  };

  const handleGenerate = async () => {
    if (passion.trim().length < 10) {
      toast.error("Cuéntanos más sobre ti (mínimo 10 caracteres)");
      return;
    }
    setLoading(true);
    const tid = toast.loading("🧬 Cruzando tu ADN con el algoritmo A9 de Amazon…");
    try {
      const { blueprints } = await generate({
        data: {
          passion,
          cvText: cvText || undefined,
          audioTranscript: audioName ? `[Audio adjunto: ${audioName}]` : undefined,
        },
      });
      setBlueprints(blueprints);
      toast.success(`${blueprints.length} blueprints generados`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error generando blueprints", { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const handleChoose = (bp: Blueprint) => {
    selectBlueprint(bp.id);
    setBookContext({ topic: bp.niche, title: bp.title, subtitle: bp.subtitle });
    markStepComplete(1);
    setStep(2);
    toast.success(`✨ "${bp.title}" guardado. Vamos al ADN del autor.`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          <Compass className="h-3 w-3 text-primary" />
          Paso 1 · Motor Ikigai Literario
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          ¿A qué te dedicas o qué te{" "}
          <span className="bg-gradient-to-r from-primary to-[color:var(--ai)] bg-clip-text text-transparent">
            apasiona
          </span>
          ?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Cruzamos tu historia, profesión y voz con la demanda real de Amazon KDP para encontrar tu
          próximo bestseller.
        </p>
      </div>

      {/* Input */}
      <Card className="mx-auto max-w-3xl border-border/70 bg-surface p-6 shadow-soft">
        <Textarea
          value={passion}
          onChange={(e) => setPassion(e.target.value)}
          placeholder="Soy coach de ejecutivos con 12 años acompañando a CEOs en transiciones difíciles. Mi pasión es ayudar a líderes a reconectar con su propósito sin perder ambición…"
          className="min-h-[140px] resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.docx,.md,.txt"
                hidden
                onChange={(e) => e.target.files?.[0] && handleCV(e.target.files[0])}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="mr-1.5 h-4 w-4" />
                  {cvText ? "CV cargado ✓" : "Subir CV"}
                </span>
              </Button>
            </label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleAudio(e.target.files[0])}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Mic className="mr-1.5 h-4 w-4" />
                  {audioName ? "Audio cargado ✓" : "Subir audio"}
                </span>
              </Button>
            </label>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="primary-gradient text-primary-foreground shadow-soft"
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Generar Blueprints
          </Button>
        </div>
      </Card>

      {/* Blueprints */}
      {blueprints.length > 0 && (
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold">{blueprints.length} blueprints personalizados</span>
            <span className="text-muted-foreground">· Elige el que más te atraiga</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {blueprints.map((bp) => {
              const dem = DEMAND_LABEL[bp.demandBadge];
              return (
                <Card
                  key={bp.id}
                  className="group relative flex flex-col overflow-hidden border-border/70 bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-luxe"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("text-[10px]", dem.cls)}>
                      {dem.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <Target className="h-3 w-3" />
                      KDP {bp.kdpScore}/100
                    </div>
                  </div>

                  <h3 className="font-display text-xl font-bold leading-tight">{bp.title}</h3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{bp.subtitle}</p>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
                    {bp.synopsis}
                  </p>

                  <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs">
                    <div className="mb-1 font-semibold text-primary">Por qué tú:</div>
                    <p className="text-foreground/70">{bp.whyYou}</p>
                  </div>

                  <div className="mt-3 text-[11px] text-muted-foreground">📚 {bp.niche}</div>

                  <Button
                    onClick={() => handleChoose(bp)}
                    className="mt-4 w-full primary-gradient text-primary-foreground shadow-soft"
                  >
                    Elegir este bestseller
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
