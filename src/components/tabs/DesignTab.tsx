import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore, wordCount } from "@/lib/store";
import { aiImage, aiText } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Download, Bot, Coins } from "lucide-react";
import { toast } from "sonner";

export function DesignTab() {
  const {
    bookContext,
    publishingForm,
    setPublishingForm,
    bookCover,
    setBookCover,
    authorDNA,
    chapters,
  } = useBookStore();
  const [busy, setBusy] = useState("");
  const imageFn = useServerFn(aiImage);
  const textFn = useServerFn(aiText);

  const generateCover = async () => {
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

  const wc = wordCount(chapters);
  const printCost = 0.85 + Math.max(50, Math.floor(wc / 250)) * 0.012;
  const printRoyalty = publishingForm.pricePhysical * 0.6 - printCost;
  const digitalRoyalty = publishingForm.priceDigital * 0.7;

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Portada IA</h3>
        <p className="text-sm text-muted-foreground">Diseño editorial generado por Lovable AI.</p>
        <div className="mt-4 aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary/40">
          {bookCover ? (
            <img src={bookCover} alt="Portada" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12" />
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
