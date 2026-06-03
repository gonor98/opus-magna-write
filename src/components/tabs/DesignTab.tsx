import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore, wordCount } from "@/lib/store";
import { aiImage, aiText, aiAuthorAvatarPrompt } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Download, Bot, Coins, Barcode, Sparkles, User, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import bwipjs from "bwip-js/browser";
import { requireFeature } from "@/lib/tier";
import { CoverEngine } from "@/components/cover/CoverEngine";
import { MarketSignals } from "@/components/market/MarketSignals";

const BLUEPRINTS = [
  "Autoayuda estilo James Clear",
  "Ficción estilo Stephen King",
  "Finanzas estilo Ray Dalio",
  "Negocios estilo Simon Sinek",
  "Memoir estilo Michelle Obama",
  "Thriller estilo Gillian Flynn",
  "Espiritualidad estilo Eckhart Tolle",
];

export function DesignTab() {
  const {
    bookContext, publishingForm, setPublishingForm,
    bookCover, setBookCover, authorDNA,
    chapters, authorPhoto, setAuthorPhoto,
  } = useBookStore();
  const [busy, setBusy] = useState("");
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const imageFn = useServerFn(aiImage);
  const textFn = useServerFn(aiText);
  const avatarPromptFn = useServerFn(aiAuthorAvatarPrompt);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  // Generate EAN-13 whenever ISBN changes
  useEffect(() => {
    const raw = (publishingForm.isbn || "").replace(/[^0-9]/g, "");
    if (raw.length < 12) {
      setBarcodeUrl(null);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, {
        bcid: "ean13",
        text: raw.slice(0, 13),
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: "center",
        backgroundcolor: "FFFFFF",
        paddingwidth: 8,
        paddingheight: 8,
      });
      setBarcodeUrl(canvas.toDataURL("image/png"));
    } catch (e: any) {
      setBarcodeUrl(null);
    }
  }, [publishingForm.isbn]);

  const generateCover = async () => {
    if (!requireFeature("cover.generate", "Generar portada IA")) return;
    setBusy("cover");
    try {
      const { dataUrl } = await imageFn({
        data: {
          prompt: `Portada de libro bestseller internacional, diseño editorial premium, minimalista, tipografía elegante. Título: "${bookContext.title}". Subtítulo: "${bookContext.subtitle}". Autor: "${publishingForm.author || "Autor"}". Estilo Penguin / Stripe Press, paleta sofisticada.`,
          aspectRatio: "3:4",
        },
      });
      setBookCover(dataUrl);
      toast.success("Portada generada");
    } catch (e: any) {
      toast.error(e.message || "Error generando portada");
    } finally {
      setBusy("");
    }
  };

  const generateAuthorPhoto = async () => {
    if (!publishingForm.author) return toast.error("Indica el nombre del autor primero");
    if (!requireFeature("cover.generate", "Generar foto profesional del autor")) return;
    setBusy("avatar");
    const tid = toast.loading("📸 Generando retrato editorial 4K…");
    try {
      const { prompt } = await avatarPromptFn({
        data: { name: publishingForm.author, bio: authorDNA.bio, tone: "warm authority bestselling author headshot" },
      });
      const { dataUrl } = await imageFn({ data: { prompt, aspectRatio: "3:4" } });
      setAuthorPhoto(dataUrl);
      toast.success("Retrato listo", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error", { id: tid });
    } finally {
      setBusy("");
    }
  };

  const runAgent = async () => {
    if (!bookContext.title) return toast.error("Define el título primero");
    setBusy("agent");
    try {
      const { text } = await textFn({
        data: {
          prompt: `Genera metadatos editoriales para el libro "${bookContext.title}: ${bookContext.subtitle}".
Bio del autor: ${authorDNA.bio.slice(0, 600)}.
Devuelve JSON puro con estas claves exactas:
{
 "description": "sinopsis comercial 4-6 frases",
 "shortBio": "biografía contraportada 30-40 palabras",
 "keywords": "palabras clave separadas por coma",
 "categories": "categorías Amazon"
}`,
        },
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        setPublishingForm({
          description: data.description || "",
          shortBio: data.shortBio || "",
          keywords: data.keywords || "",
          categories: data.categories || "",
          author: publishingForm.author || authorDNA.bio.split(/[\.,]/)[0]?.slice(0, 60) || "",
        });
        toast.success("Metadatos generados");
      }
    } catch (e: any) {
      toast.error(e.message || "Error en agente");
    } finally {
      setBusy("");
    }
  };

  const downloadCover = () => {
    if (!bookCover) return;
    const a = document.createElement("a");
    a.href = bookCover;
    a.download = `Portada_${bookContext.title.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  const downloadBarcode = () => {
    if (!barcodeUrl) return;
    const a = document.createElement("a");
    a.href = barcodeUrl;
    a.download = `EAN13_${publishingForm.isbn}.png`;
    a.click();
  };

  const wc = wordCount(chapters);
  const printCost = 0.85 + Math.max(50, Math.floor(wc / 250)) * 0.012;
  const printRoyalty = publishingForm.pricePhysical * 0.6 - printCost;
  const digitalRoyalty = publishingForm.priceDigital * 0.7;

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Portada IA</h3>
        <p className="text-sm text-muted-foreground">Diseño editorial generado por Lovable AI.</p>
        <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary/40">
          {bookCover ? (
            <img src={bookCover} alt="Portada" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12" />
            </div>
          )}
          {/* Simulated back-cover EAN-13 placement (lower-right corner of cover spread) */}
          {barcodeUrl && (
            <div className="absolute bottom-2 right-2 rounded bg-white p-1 shadow-elevated ring-1 ring-black/10">
              <img src={barcodeUrl} alt="EAN-13" className="h-10 w-auto" />
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={generateCover}
            disabled={busy === "cover"}
            className="ai-gradient flex-1 text-[color:var(--ai-foreground)]"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            {busy === "cover" ? "Renderizando…" : bookCover ? "Regenerar" : "Generar portada"}
          </Button>
          {bookCover && (
            <Button variant="outline" onClick={downloadCover}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Metadatos editoriales</h3>
              <p className="text-sm text-muted-foreground">Listos para KDP / IngramSpark.</p>
            </div>
            <Button
              onClick={runAgent}
              disabled={busy === "agent"}
              className="primary-gradient text-primary-foreground"
            >
              <Bot className="mr-2 h-4 w-4" />
              {busy === "agent" ? "Trabajando…" : "Agente IA"}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Autor">
              <Input value={publishingForm.author} onChange={(e) => setPublishingForm({ author: e.target.value })} />
            </Field>
            <Field label="Categorías">
              <Input value={publishingForm.categories} onChange={(e) => setPublishingForm({ categories: e.target.value })} />
            </Field>
            <Field label="Anatomía Bestseller a emular" full>
              <select
                value={publishingForm.bestsellerBlueprint}
                onChange={(e) => setPublishingForm({ bestsellerBlueprint: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="">— Elige un blueprint —</option>
                {BLUEPRINTS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                La IA usará este blueprint en cada generación de capítulo.
              </p>
            </Field>
            <Field label="Sinopsis" full>
              <Textarea
                rows={5}
                value={publishingForm.description}
                onChange={(e) => setPublishingForm({ description: e.target.value })}
              />
            </Field>
            <Field label="Bio contraportada" full>
              <Textarea
                rows={3}
                value={publishingForm.shortBio}
                onChange={(e) => setPublishingForm({ shortBio: e.target.value })}
              />
            </Field>
            <Field label="Keywords" full>
              <Input value={publishingForm.keywords} onChange={(e) => setPublishingForm({ keywords: e.target.value })} />
            </Field>
          </div>
        </Card>

        {/* ISBN + EAN-13 Barcode */}
        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Barcode className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">ISBN & código de barras EAN-13</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Cumple con los requisitos exactos de Amazon KDP e IngramSpark para la contraportada.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="ISBN-13 (sin guiones)">
              <Input
                placeholder="9781234567897"
                value={publishingForm.isbn}
                onChange={(e) => setPublishingForm({ isbn: e.target.value.replace(/[^0-9]/g, "").slice(0, 13) })}
              />
            </Field>
            {barcodeUrl && (
              <Button variant="outline" onClick={downloadBarcode}>
                <Download className="mr-2 h-4 w-4" />
                PNG
              </Button>
            )}
          </div>
          <div className="mt-4 flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-white p-4">
            {barcodeUrl ? (
              <img src={barcodeUrl} alt="Código EAN-13" className="h-24" />
            ) : (
              <p className="text-xs text-muted-foreground">
                Ingresa al menos 12 dígitos del ISBN para generar el EAN-13.
              </p>
            )}
          </div>
          <canvas ref={barcodeRef} className="hidden" />
        </Card>

        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-[color:var(--ai)]" />
            <h3 className="font-display text-lg font-semibold">Calculadora de regalías</h3>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Precio físico ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={publishingForm.pricePhysical}
                onChange={(e) => setPublishingForm({ pricePhysical: parseFloat(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Precio digital ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={publishingForm.priceDigital}
                onChange={(e) => setPublishingForm({ priceDigital: parseFloat(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Coste impresión" value={`$${printCost.toFixed(2)}`} />
            <Stat label="Regalía física" value={`$${printRoyalty.toFixed(2)}`} accent="success" />
            <Stat label="Regalía digital" value={`$${digitalRoyalty.toFixed(2)}`} accent="success" />
          </div>
          <Badge variant="outline" className="mt-4">
            Estimación basada en {wc.toLocaleString()} palabras
          </Badge>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 font-display text-xl font-semibold " +
          (accent === "success" ? "text-[color:var(--success)]" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
