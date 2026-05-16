import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import { aiMarketing, aiACXScript, aiTranslate } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Mail, Megaphone, MonitorPlay, Copy, Mic, Languages, Headphones, Upload, Download, Play, Pause, Wand2 } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { toast } from "sonner";

const ITEMS = [
  { kind: "emails" as const, label: "Emails de pre-venta", icon: Mail, copy: "Fórmula PAS, 3 correos" },
  { kind: "social" as const, label: "Posts virales", icon: Megaphone, copy: "5 hilos AIDA" },
  { kind: "trailer" as const, label: "Guion Book Trailer", icon: MonitorPlay, copy: "60s · cámara + voz" },
];

export function MarketingTab() {
  const { launchKit, setLaunchKit, bookContext, publishingForm, authorDNA } = useBookStore();
  const [busy, setBusy] = useState<string>("");
  const fn = useServerFn(aiMarketing);

  const generate = async (kind: "emails" | "social" | "trailer") => {
    setBusy(kind);
    try {
      const { text } = await fn({
        data: {
          kind,
          title: bookContext.title,
          synopsis: publishingForm.description,
          persona: authorDNA.extractedPersona,
        },
      });
      setLaunchKit({ [kind]: text });
      toast.success("Activo generado");
    } catch (e: any) {
      toast.error(e.message || "Error generando activo");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {ITEMS.map(({ kind, label, icon: Icon, copy }) => (
        <Card key={kind} className="flex flex-col rounded-2xl border-border/70 p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-soft">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">{label}</h3>
              <p className="text-xs text-muted-foreground">{copy}</p>
            </div>
          </div>
          <div className="mt-4 max-h-72 flex-1 overflow-auto rounded-xl border border-border/60 bg-surface-elevated p-3 text-sm">
            {launchKit[kind] ? (
              <Markdown source={launchKit[kind]} />
            ) : (
              <p className="text-muted-foreground">Aún no generado.</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => generate(kind)}
              disabled={busy === kind}
              className="ai-gradient flex-1 text-[color:var(--ai-foreground)]"
            >
              {busy === kind ? "Generando…" : launchKit[kind] ? "Regenerar" : "Generar"}
            </Button>
            {launchKit[kind] && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(launchKit[kind]);
                  toast.success("Copiado");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      ))}
      <div className="lg:col-span-3">
        <AudiobookAndTranslate />
      </div>
    </div>
  );
}

function AudiobookAndTranslate() {
  const { chapters, authorDNA, replaceChapterContent } = useBookStore();
  const [acxScript, setAcxScript] = useState("");
  const [busy, setBusy] = useState<"" | "acx" | "voice" | "translate">("");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [lang, setLang] = useState<"en" | "zh" | "fr" | "pt" | "de">("en");
  const acxFn = useServerFn(aiACXScript);
  const trFn = useServerFn(aiTranslate);

  const generateACX = async () => {
    const ch = chapters[chapterIdx];
    if (!ch?.content) return toast.error("Selecciona un capítulo con contenido");
    setBusy("acx");
    try {
      const { text } = await acxFn({
        data: { content: ch.content, chapterTitle: ch.title, persona: authorDNA.extractedPersona },
      });
      setAcxScript(text);
      toast.success("Script ACX generado");
    } catch (e: any) {
      toast.error(e.message || "Error generando ACX");
    } finally {
      setBusy("");
    }
  };

  const downloadACX = () => {
    if (!acxScript) return;
    const ch = chapters[chapterIdx];
    const blob = new Blob([acxScript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ACX_${(ch?.title || "capitulo").replace(/[^a-z0-9]+/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Script ACX descargado");
  };

  const translateAll = async () => {
    if (!chapters.length) return toast.error("No hay capítulos para traducir");
    setBusy("translate");
    try {
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        if (!ch.content) continue;
        const { text } = await trFn({
          data: { content: ch.content, targetLang: lang, persona: authorDNA.extractedPersona },
        });
        replaceChapterContent(ch.id, text, `Transcreación → ${lang.toUpperCase()} · ${ch.title}`);
      }
      toast.success(`Bestseller traducido a ${lang.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e.message || "Error en transcreación");
    } finally {
      setBusy("");
    }
  };

  const translateQuick = async (target: "en" | "zh") => {
    setLang(target);
    await translateAll();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="rounded-2xl border-border/70 p-6 shadow-soft animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-soft">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Audiolibro ACX</h3>
            <p className="text-xs text-muted-foreground">Marcas de respiración, tono y pausas listas para Audible.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={chapterIdx}
            onChange={(e) => setChapterIdx(parseInt(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {chapters.map((c, i) => (
              <option key={c.id} value={i}>
                {i + 1}. {c.title}
              </option>
            ))}
          </select>
          <Button onClick={generateACX} disabled={busy === "acx"} className="ai-gradient text-[color:var(--ai-foreground)]">
            <Mic className="mr-2 h-4 w-4" />
            {busy === "acx" ? "Generando…" : "Generar Script ACX"}
          </Button>
          {acxScript && (
            <Button variant="outline" onClick={downloadACX}>
              <Download className="mr-2 h-4 w-4" /> Descargar .txt
            </Button>
          )}
        </div>
        <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-border/60 bg-surface-elevated p-3 text-sm">
          {acxScript ? <Markdown source={acxScript} /> : <p className="text-muted-foreground">Aún no generado. El script se construye directamente desde el contenido Tiptap del capítulo seleccionado.</p>}
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 p-6 shadow-soft animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Traducir Bestseller</h3>
            <p className="text-xs text-muted-foreground">
              Transcreación cultural — preserva modismos, ironía y ADN del autor.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="en">Inglés (US/UK)</option>
            <option value="zh">Mandarín 简体</option>
            <option value="fr">Francés</option>
            <option value="pt">Portugués (BR)</option>
            <option value="de">Alemán</option>
          </select>
          <Button onClick={translateAll} disabled={busy === "translate"} className="primary-gradient text-primary-foreground">
            <Languages className="mr-2 h-4 w-4" />
            {busy === "translate" ? "Transcreando capítulos…" : "Traducir libro completo"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => translateQuick("en")} disabled={busy === "translate"}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 1-click → English
          </Button>
          <Button size="sm" variant="outline" onClick={() => translateQuick("zh")} disabled={busy === "translate"}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 1-click → 中文
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          La operación sobrescribe el contenido de cada capítulo. Usa Ctrl+Z para deshacer si algo no convence.
        </p>
      </Card>

      <div className="md:col-span-2">
        <VoiceCloneCard acxScript={acxScript} />
      </div>
    </div>
  );
}

function VoiceCloneCard({ acxScript }: { acxScript: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [voiceName, setVoiceName] = useState("Mi Voz Autor");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "cloning" | "ready">("idle");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      toast.error("Sube un archivo de audio (.mp3, .wav, .m4a)");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Máximo 20 MB por muestra");
      return;
    }
    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setPhase("idle");
    setProgress(0);
  };

  const startClone = async () => {
    if (!file) return toast.error("Sube una muestra de voz primero (mín. 30s recomendado).");
    setPhase("uploading");
    setProgress(0);
    // mocked upload
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 80));
      setProgress(i);
    }
    setPhase("cloning");
    setProgress(0);
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 120));
      setProgress(i);
    }
    setPhase("ready");
    toast.success(`Voz "${voiceName}" clonada (mock). Lista para narrar.`);
  };

  const playPreview = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const generateNarration = () => {
    if (phase !== "ready") return toast.error("Clona tu voz primero.");
    if (!acxScript) return toast.error("Genera primero un Script ACX en la tarjeta superior.");
    toast.success(`Narración "${voiceName}" en cola · ${Math.ceil(acxScript.length / 950)} min estimados`);
  };

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-soft">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Clonar mi voz · ElevenLabs</h3>
            <p className="text-xs text-muted-foreground">
              Sube 30-120s de voz limpia. Generamos un audiolibro con tu timbre y la guía ACX (mock).
            </p>
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          beta · mock
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nombre del modelo de voz
            </label>
            <Input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} className="mt-1 h-9" />
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onPick(e.dataTransfer.files?.[0] || null);
            }}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/5"
          >
            <Upload className="h-6 w-6 text-muted-foreground transition group-hover:scale-110 group-hover:text-primary" />
            <div className="mt-2 text-sm font-medium">
              {file ? file.name : "Arrastra una muestra de audio o haz clic"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              .mp3 · .wav · .m4a · máx 20 MB
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
          </div>

          {audioUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2">
              <Button size="sm" variant="ghost" onClick={playPreview} className="h-8 px-2">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="truncate text-xs text-muted-foreground">{file?.name}</span>
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estado del pipeline
            </div>
            <div className="mt-2 space-y-2">
              <PipelineRow label="1. Subida de muestra" active={phase === "uploading"} done={phase === "cloning" || phase === "ready"} />
              <PipelineRow label="2. Entrenando timbre" active={phase === "cloning"} done={phase === "ready"} />
              <PipelineRow label="3. Voz lista para narrar" active={false} done={phase === "ready"} />
            </div>
            {(phase === "uploading" || phase === "cloning") && (
              <Progress value={progress} className="mt-3 h-1.5" />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startClone}
              disabled={!file || phase === "uploading" || phase === "cloning"}
              className="ai-gradient text-[color:var(--ai-foreground)]"
            >
              <Mic className="mr-2 h-4 w-4" />
              {phase === "uploading" || phase === "cloning" ? "Procesando…" : phase === "ready" ? "Re-entrenar" : "Clonar mi voz"}
            </Button>
            <Button variant="outline" onClick={generateNarration} disabled={phase !== "ready"}>
              <Headphones className="mr-2 h-4 w-4" /> Narrar capítulo
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            * Demo. La integración real con ElevenLabs requiere conectar tu API key vía Lovable Cloud.
          </p>
        </div>
      </div>
    </Card>
  );
}

function PipelineRow({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={
          "inline-flex h-2 w-2 rounded-full " +
          (done ? "bg-[color:var(--success)]" : active ? "animate-pulse bg-primary" : "bg-muted-foreground/30")
        }
      />
      <span className={done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
