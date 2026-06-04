import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import { aiMarketing, aiACXScript, aiTranslate } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Mail, Megaphone, MonitorPlay, Copy, Mic, Languages, Headphones, Upload, Download, Play, Pause, Wand2, Volume2, Square, Sliders, FileAudio, CheckCircle2, XCircle, AlertTriangle, Package } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";
import { acxToSSML, validateACXChapter, cleanForTTS, type ACXReport } from "@/lib/acx-utils";
import { synthMockNarration } from "@/lib/voice-synth";
import { DiagnosticsPanel } from "@/components/diagnostics/DiagnosticsPanel";

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

/* -------------------- Shared utils -------------------- */

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stripACXMarkers(script: string): string {
  return script
    .replace(/\[PAUSA:\s*([0-9.]+)s\]/gi, ", ")
    .replace(/\[RESPIRA\]/gi, " … ")
    .replace(/\[TONO:[^\]]+\]/gi, "")
    .replace(/\[PRON:\s*"([^"]+)"\]/gi, "$1")
    .replace(/\[DURACIÓN[^\]]+\]/gi, "")
    .replace(/—FIN[^—\n]*—/g, "")
    .replace(/^##\s+SECCIÓN[^\n]+/gm, "")
    .replace(/^TÍTULO:[^\n]+\n?/gm, "")
    .replace(/^ESTIMADO:[^\n]+\n?/gm, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------- Audiobook & Translate -------------------- */

function AudiobookAndTranslate() {
  const { chapters, authorDNA, replaceChapterContent } = useBookStore();
  const [acxScript, setAcxScript] = useState("");
  const [busy, setBusy] = useState<"" | "acx" | "translate">("");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [lang, setLang] = useState<"en" | "zh" | "fr" | "pt" | "de">("en");
  const [literalness, setLiteralness] = useState([30]);
  const [tonePres, setTonePres] = useState([85]);
  const [stylePres, setStylePres] = useState([85]);

  // Lifted voice clone state
  const [voiceName, setVoiceName] = useState("Mi Voz Autor");
  const [cloneReady, setCloneReady] = useState(false);

  const acxFn = useServerFn(aiACXScript);
  const trFn = useServerFn(aiTranslate);

  const generateACX = async () => {
    const ch = chapters[chapterIdx];
    if (!ch?.content) return toast.error("Selecciona un capítulo con contenido");
    if (!requireFeature("export.acx", "Script ACX para audiolibro")) return;
    setBusy("acx");
    try {
      const { text } = await acxFn({
        data: { content: ch.content, chapterTitle: ch.title, persona: authorDNA.extractedPersona },
      });
      setAcxScript(text);
      toast.success("Script ACX broadcast-ready generado");
    } catch (e: any) {
      toast.error(e.message || "Error generando ACX");
    } finally {
      setBusy("");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const safeName = (s: string) => (s || "capitulo").replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

  const downloadACX = () => {
    if (!acxScript) return;
    const ch = chapters[chapterIdx];
    downloadBlob(new Blob([acxScript], { type: "text/plain;charset=utf-8" }), `ACX_${safeName(ch?.title || "")}.txt`);
    toast.success("Script ACX descargado");
  };

  const downloadSSML = () => {
    if (!acxScript) return;
    const ch = chapters[chapterIdx];
    const ssml = acxToSSML(acxScript, { voice: voiceName, lang: "es-ES" });
    downloadBlob(new Blob([ssml], { type: "application/ssml+xml;charset=utf-8" }), `${safeName(ch?.title || "")}.ssml`);
    toast.success("SSML listo para TTS/producción");
  };

  const downloadWAV = () => {
    if (!acxScript) return;
    if (!requireFeature("voice.clone", "Renderizar audio con voz clonada")) return;
    const ch = chapters[chapterIdx];
    const clean = cleanForTTS(acxScript);
    const blob = synthMockNarration(clean, { voiceName });
    downloadBlob(blob, `${safeName(ch?.title || "")}_${safeName(voiceName)}.wav`);
    toast.success(`WAV ${voiceName} renderizado (mock)`);
  };

  const generateAllChapters = async () => {
    if (!chapters.length) return toast.error("No hay capítulos");
    if (!requireFeature("export.acx", "Generar ACX para todos los capítulos")) return;
    setBusy("acx");
    const tid = toast.loading(`Generando ACX para ${chapters.length} capítulos…`);
    const zip = new JSZip();
    try {
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        if (!ch.content) continue;
        toast.loading(`Capítulo ${i + 1}/${chapters.length} · ${ch.title}`, { id: tid });
        const { text } = await acxFn({
          data: { content: ch.content, chapterTitle: ch.title, persona: authorDNA.extractedPersona },
        });
        const base = `${String(i + 1).padStart(2, "0")}_${safeName(ch.title)}`;
        zip.file(`${base}.txt`, text);
        zip.file(`${base}.ssml`, acxToSSML(text, { voice: voiceName, lang: "es-ES" }));
        const wavBlob = synthMockNarration(cleanForTTS(text), { voiceName });
        zip.file(`${base}.wav`, await wavBlob.arrayBuffer());
        const report = validateACXChapter(text);
        zip.file(`${base}.report.json`, JSON.stringify(report, null, 2));
      }
      zip.file(
        "README.md",
        `# Paquete ACX completo\nVoz: ${voiceName}\nCapítulos: ${chapters.length}\nFecha: ${new Date().toISOString()}\n\nContiene .txt (ACX), .ssml (TTS), .wav (mock voz clonada), .report.json (validación broadcast).`,
      );
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `audiolibro_${safeName(voiceName)}_${chapters.length}cap.zip`);
      toast.success(`Audiolibro ZIP descargado · ${chapters.length} capítulos`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error generando ACX", { id: tid });
    } finally {
      setBusy("");
    }
  };

  const translateAll = async (override?: "en" | "zh") => {
    if (!chapters.length) return toast.error("No hay capítulos para traducir");
    const target = override ?? lang;
    if (override) setLang(override);
    setBusy("translate");
    try {
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        if (!ch.content) continue;
        const { text } = await trFn({
          data: {
            content: ch.content,
            targetLang: target,
            persona: authorDNA.extractedPersona,
            literalness: literalness[0],
            tonePreservation: tonePres[0],
            stylePreservation: stylePres[0],
          },
        });
        replaceChapterContent(ch.id, text, `Transcreación → ${target.toUpperCase()} · ${ch.title}`);
      }
      toast.success(`Bestseller transcreado a ${target.toUpperCase()} · ADN ${100 - literalness[0]}% libre`);
    } catch (e: any) {
      toast.error(e.message || "Error en transcreación");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ACXCard
        chapters={chapters}
        chapterIdx={chapterIdx}
        setChapterIdx={setChapterIdx}
        acxScript={acxScript}
        busy={busy === "acx"}
        onGenerate={generateACX}
        onDownload={downloadACX}
        voiceName={voiceName}
        cloneReady={cloneReady}
      />

      <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-surface to-secondary/30 p-6 shadow-soft animate-fade-in hover-lift">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/15" />
        <div className="flex items-center gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-elevated">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Traducir Bestseller</h3>
            <p className="text-xs text-muted-foreground">
              Transcreación cultural — controla cuánto ADN autoral preservar.
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
          <Button onClick={() => translateAll()} disabled={busy === "translate"} className="primary-gradient text-primary-foreground">
            <Languages className="mr-2 h-4 w-4" />
            {busy === "translate" ? "Transcreando…" : "Traducir libro completo"}
          </Button>
        </div>

        <div className="mt-4 space-y-4 rounded-xl border border-border/60 bg-surface-elevated p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sliders className="h-3.5 w-3.5" /> Controles ADN autoral
          </div>
          <DnaSlider
            label="Literalidad"
            value={literalness}
            onChange={setLiteralness}
            leftHint="Transcreación libre"
            rightHint="Casi literal"
          />
          <DnaSlider
            label="Preservar tono"
            value={tonePres}
            onChange={setTonePres}
            leftHint="Neutralizado"
            rightHint="1:1 con autor"
          />
          <DnaSlider
            label="Preservar estilo"
            value={stylePres}
            onChange={setStylePres}
            leftHint="Simplificado"
            rightHint="Ritmo intacto"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => translateAll("en")} disabled={busy === "translate"}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 1-click → English
          </Button>
          <Button size="sm" variant="outline" onClick={() => translateAll("zh")} disabled={busy === "translate"}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 1-click → 中文
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Sobrescribe el contenido de cada capítulo conservando markdown, headings y placeholders. Ctrl+Z deshace.
        </p>
      </Card>

      <div className="md:col-span-2">
        <VoiceCloneCard
          acxScript={acxScript}
          voiceName={voiceName}
          setVoiceName={setVoiceName}
          cloneReady={cloneReady}
          setCloneReady={setCloneReady}
        />
      </div>
    </div>
  );
}

/* -------------------- ACX card with TTS preview -------------------- */

function ACXCard({
  chapters,
  chapterIdx,
  setChapterIdx,
  acxScript,
  busy,
  onGenerate,
  onDownload,
  voiceName,
  cloneReady,
}: {
  chapters: { id: string; title: string; content?: string }[];
  chapterIdx: number;
  setChapterIdx: (n: number) => void;
  acxScript: string;
  busy: boolean;
  onGenerate: () => void;
  onDownload: () => void;
  voiceName: string;
  cloneReady: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = () => {
    if (!acxScript) return toast.error("Genera primero el script ACX");
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return toast.error("Tu navegador no soporta síntesis de voz");
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const clean = stripACXMarkers(acxScript).slice(0, 2200);
    const u = new SpeechSynthesisUtterance(clean);
    // Mocked clone: derive pitch/rate from voiceName hash so each "voice" sounds distinct
    const h = hashString(voiceName);
    u.pitch = cloneReady ? 0.8 + ((h % 70) / 100) : 1; // 0.8–1.5
    u.rate = cloneReady ? 0.9 + (((h >> 3) % 30) / 100) : 1; // 0.9–1.2
    u.lang = "es-ES";
    const voices = window.speechSynthesis.getVoices();
    const es = voices.find((v) => v.lang.startsWith("es"));
    if (es) u.voice = es;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    toast.success(cloneReady ? `Vista previa con voz "${voiceName}"` : "Vista previa (clona tu voz para timbre personalizado)");
  };

  const downloadNarrationPackage = () => {
    if (!acxScript) return toast.error("Genera primero el script ACX");
    const ch = chapters[chapterIdx];
    const meta = [
      `# Vista previa de narración — ${ch?.title || "Capítulo"}`,
      `Voz: ${voiceName}${cloneReady ? " (clonada)" : " (mock no entrenada)"}`,
      `Generado: ${new Date().toISOString()}`,
      `Palabras: ${stripACXMarkers(acxScript).split(/\s+/).filter(Boolean).length}`,
      "",
      "---",
      "## SCRIPT ACX",
      acxScript,
      "",
      "---",
      "## TEXTO LIMPIO PARA TTS",
      stripACXMarkers(acxScript),
    ].join("\n");
    const blob = new Blob([meta], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `narracion_${(ch?.title || "cap").replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Paquete de narración descargado");
  };

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-surface to-ai-muted/40 p-6 shadow-soft animate-fade-in hover-lift">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[color:var(--ai)]/15 blur-3xl transition group-hover:bg-[color:var(--ai)]/25" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-elevated">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Audiolibro ACX</h3>
            <p className="text-xs text-muted-foreground">Secciones · pausas · respiración · pronunciación.</p>
          </div>
        </div>
        {cloneReady && (
          <span className="rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--success)]">
            ● Voz lista
          </span>
        )}
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
        <Button onClick={onGenerate} disabled={busy} className="ai-gradient text-[color:var(--ai-foreground)]">
          <Mic className="mr-2 h-4 w-4" />
          {busy ? "Generando…" : "Generar Script ACX"}
        </Button>
        {acxScript && (
          <>
            <Button variant="outline" onClick={onDownload} title="Descargar script ACX">
              <Download className="mr-2 h-4 w-4" /> Script .txt
            </Button>
            <Button variant="outline" onClick={speak} title={speaking ? "Detener" : "Reproducir vista previa"}>
              {speaking ? <Square className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
              {speaking ? "Detener" : "Vista previa TTS"}
            </Button>
            <Button variant="outline" onClick={downloadNarrationPackage} title="Descargar paquete completo">
              <Download className="mr-2 h-4 w-4" /> Narración
            </Button>
          </>
        )}
      </div>
      <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-border/60 bg-surface-elevated p-3 text-sm">
        {acxScript ? (
          <Markdown source={acxScript} />
        ) : (
          <p className="text-muted-foreground">
            Aún no generado. El script ACX se construye directamente desde el contenido Tiptap del capítulo seleccionado, con secciones de hasta 70 palabras, pausas y marcas de respiración.
          </p>
        )}
      </div>
    </Card>
  );
}

/* -------------------- DNA slider -------------------- */

function DnaSlider({
  label,
  value,
  onChange,
  leftHint,
  rightHint,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
  leftHint: string;
  rightHint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span className="font-mono text-[11px] text-muted-foreground">{value[0]}/100</span>
      </div>
      <Slider value={value} onValueChange={onChange} max={100} step={5} className="mt-1.5" />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{leftHint}</span>
        <span>{rightHint}</span>
      </div>
    </div>
  );
}

/* -------------------- Voice Clone -------------------- */

function VoiceCloneCard({
  acxScript,
  voiceName,
  setVoiceName,
  cloneReady,
  setCloneReady,
}: {
  acxScript: string;
  voiceName: string;
  setVoiceName: (v: string) => void;
  cloneReady: boolean;
  setCloneReady: (v: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "cloning" | "ready">(cloneReady ? "ready" : "idle");
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
    setCloneReady(false);
    setProgress(0);
  };

  const startClone = async () => {
    if (!file) return toast.error("Sube una muestra de voz primero (mín. 30s recomendado).");
    setPhase("uploading");
    setProgress(0);
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 80));
      setProgress(i);
    }
    setPhase("cloning");
    setProgress(0);
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 110));
      setProgress(i);
    }
    setPhase("ready");
    setCloneReady(true);
    toast.success(`Voz "${voiceName}" clonada · lista para narración ACX`);
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

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-surface via-surface to-ai-muted/30 p-6 shadow-soft animate-fade-in hover-lift">
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-[color:var(--ai)]/10 blur-3xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-elevated">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Clonar mi voz · ElevenLabs</h3>
            <p className="text-xs text-muted-foreground">
              Sube 30-120s de voz limpia. La vista previa TTS del capítulo usa el timbre clonado.
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
            className="group/up flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/5"
          >
            <Upload className="h-6 w-6 text-muted-foreground transition group-hover/up:scale-110 group-hover/up:text-primary" />
            <div className="mt-2 text-sm font-medium">
              {file ? file.name : "Arrastra una muestra de audio o haz clic"}
            </div>
            <div className="text-[11px] text-muted-foreground">.mp3 · .wav · .m4a · máx 20 MB</div>
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
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pipeline de clonación
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
            <Button variant="outline" disabled={!cloneReady || !acxScript} onClick={() => toast.success(`Cola: narrar ${Math.max(1, Math.ceil(acxScript.length / 950))} min con "${voiceName}"`)}>
              <Headphones className="mr-2 h-4 w-4" /> Encolar narración completa
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            * Demo. Una vez clonada, usa <strong>Vista previa TTS</strong> en la tarjeta ACX para escuchar el capítulo con tu timbre.
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
      <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

