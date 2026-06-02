import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiCoverPromptPack, aiImage } from "@/lib/ai.functions";
import { useBookStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, Sparkles, Check, Download, Layers } from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";
import { cn } from "@/lib/utils";

type Variant = { style: string; prompt: string; palette: string[]; dataUrl?: string };

export function CoverEngine() {
  const { bookContext, publishingForm, setBookCover, bookCover } = useBookStore();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [backPrompt, setBackPrompt] = useState<string>("");
  const [backCover, setBackCover] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const promptPack = useServerFn(aiCoverPromptPack);
  const image = useServerFn(aiImage);

  const generate = async () => {
    if (!bookContext.title) return toast.error("Define el título primero");
    if (!requireFeature("cover.variants", "Generar variantes de portada")) return;
    setBusy("pack");
    const tid = toast.loading("🎨 Director de arte diseñando 4 conceptos…");
    try {
      const pack = await promptPack({
        data: {
          title: bookContext.title,
          subtitle: bookContext.subtitle,
          author: publishingForm.author,
          niche: bookContext.topic || publishingForm.categories,
        },
      });
      setBackPrompt(pack.backCoverPrompt);
      const blanks: Variant[] = pack.variants.map((v) => ({ ...v }));
      setVariants(blanks);
      setBusy("images");
      toast.loading("Renderizando 4 portadas en paralelo…", { id: tid });
      const results = await Promise.allSettled(
        pack.variants.map((v) => image({ data: { prompt: v.prompt, aspectRatio: "3:4" } })),
      );
      const filled = blanks.map((v, i) => {
        const r = results[i];
        return { ...v, dataUrl: r.status === "fulfilled" ? r.value.dataUrl : undefined };
      });
      setVariants(filled);
      toast.success("4 variantes listas — elige tu favorita", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error generando variantes", { id: tid });
    } finally {
      setBusy("");
    }
  };

  const regenOne = async (idx: number) => {
    const v = variants[idx];
    if (!v) return;
    setBusy(`v${idx}`);
    try {
      const { dataUrl } = await image({ data: { prompt: v.prompt, aspectRatio: "3:4" } });
      setVariants((arr) => arr.map((x, i) => (i === idx ? { ...x, dataUrl } : x)));
      toast.success(`Variante ${idx + 1} regenerada`);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setBusy("");
    }
  };

  const generateBack = async () => {
    if (!backPrompt) return toast.error("Genera primero las variantes");
    setBusy("back");
    try {
      const { dataUrl } = await image({ data: { prompt: backPrompt, aspectRatio: "3:4" } });
      setBackCover(dataUrl);
      toast.success("Contraportada lista");
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setBusy("");
    }
  };

  const choose = (idx: number) => {
    const v = variants[idx];
    if (!v?.dataUrl) return;
    setSelectedIdx(idx);
    setBookCover(v.dataUrl);
    toast.success(`Portada "${v.style}" guardada como principal`);
  };

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-soft">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Cover Engine · 4 variantes + contraportada</h3>
            <p className="text-sm text-muted-foreground">
              Editorial · Cinemática · Abstracta · Tipográfica. Elige una como portada principal.
            </p>
          </div>
        </div>
        <Button
          onClick={generate}
          disabled={!!busy}
          className="primary-gradient text-primary-foreground shadow-soft"
        >
          {busy === "pack" || busy === "images" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {variants.length ? "Regenerar pack" : "Generar 4 variantes"}
        </Button>
      </div>

      {variants.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {variants.map((v, i) => (
            <div
              key={i}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-surface transition-all",
                selectedIdx === i ? "border-primary ring-2 ring-primary/30 shadow-luxe" : "border-border/70 hover:shadow-elevated",
              )}
            >
              <div className="relative aspect-[3/4] bg-secondary/40">
                {v.dataUrl ? (
                  <img src={v.dataUrl} alt={v.style} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {busy === "images" || busy === `v${i}` ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <ImageIcon className="h-8 w-8" />
                    )}
                  </div>
                )}
                {selectedIdx === i && (
                  <Badge className="absolute left-2 top-2 gap-1 bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" /> Principal
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold">{v.style}</div>
                <div className="mt-1.5 flex gap-1">
                  {v.palette.slice(0, 5).map((c, k) => (
                    <span
                      key={k}
                      className="h-3 w-3 rounded-full border border-border"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-[11px]"
                    onClick={() => choose(i)}
                    disabled={!v.dataUrl}
                  >
                    Elegir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => regenOne(i)}
                    disabled={!!busy}
                    title="Regenerar"
                  >
                    <Sparkles className="h-3 w-3" />
                  </Button>
                  {v.dataUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => download(v.dataUrl!, `cover_${v.style.replace(/\s+/g, "_")}.png`)}
                      title="Descargar"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {variants.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 p-4 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Contraportada</div>
            Genera un fondo coordinado para la contraportada (la sinopsis y EAN-13 se componen automáticamente
            en el spread de imprenta).
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={generateBack} disabled={!!busy} variant="outline">
              {busy === "back" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              {backCover ? "Regenerar contraportada" : "Generar contraportada"}
            </Button>
            {backCover && (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img src={backCover} alt="Contraportada" className="h-32 w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      )}

      {bookCover && variants.length === 0 && (
        <div className="mt-4 rounded-xl border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
          Hay una portada actual guardada. Pulsa "Generar 4 variantes" para producir alternativas
          profesionales sin perderla.
        </div>
      )}
    </Card>
  );
}
