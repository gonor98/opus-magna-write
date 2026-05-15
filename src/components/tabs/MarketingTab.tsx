import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import { aiMarketing, aiACXScript, aiTranslate } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Megaphone, MonitorPlay, Copy, Mic, Languages, Headphones } from "lucide-react";
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

  const cloneVoice = () => {
    toast("ElevenLabs Voice Clone — próximamente. Conecta tu API key en Cloud.");
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
          <Button variant="outline" onClick={cloneVoice}>
            Clonar mi voz y Narrar (ElevenLabs)
          </Button>
        </div>
        <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-border/60 bg-surface-elevated p-3 text-sm">
          {acxScript ? <Markdown source={acxScript} /> : <p className="text-muted-foreground">Aún no generado.</p>}
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
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          La operación sobrescribe el contenido de cada capítulo. Usa Ctrl+Z para deshacer si algo no convence.
        </p>
      </Card>
    </div>
  );
}
