import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiDigitalFootprint } from "@/lib/ai.functions";
import { useBookStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search,
  Loader2,
  Fingerprint,
  Globe2,
  Quote,
  Tag,
  Sparkles,
  TrendingUp,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";

type Dossier = {
  bio: string;
  mission: string;
  voiceSamples: string;
  arquetipo: string;
  vocabulario: string[];
  catchphrases: string[];
  platforms: { name: string; url?: string; insight: string }[];
  themes: string[];
  confidenceScore: number;
};

export function AuthorResearch() {
  const setAuthorDNA = useBookStore((s) => s.setAuthorDNA);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const scrape = useServerFn(aiDigitalFootprint);

  const addLink = () => {
    const v = linkInput.trim();
    if (!v) return;
    try {
      new URL(v);
      setLinks((l) => [...l, v]);
      setLinkInput("");
    } catch {
      toast.error("URL inválida");
    }
  };

  const run = async () => {
    if (name.trim().length < 2) return toast.error("Escribe el nombre del autor");
    if (!requireFeature("scrape.author", "El scraping de huella digital")) return;
    setLoading(true);
    const tid = toast.loading("🕵️ Escaneando huella digital + plataformas…");
    try {
      const d = await scrape({
        data: { name, links: links.length ? links : undefined, context: context || undefined },
      });
      setDossier(d);
      toast.success(`Dossier listo · confianza ${d.confidenceScore}/100`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error en el scraping", { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!dossier) return;
    setAuthorDNA({
      bio: dossier.bio,
      mission: dossier.mission,
      voiceSamples: [
        dossier.voiceSamples,
        dossier.catchphrases.length ? `\n\nFrases marca:\n- ${dossier.catchphrases.join("\n- ")}` : "",
        dossier.vocabulario.length ? `\n\nVocabulario recurrente: ${dossier.vocabulario.join(", ")}` : "",
      ].join(""),
    });
    toast.success("ADN del autor actualizado con el dossier");
  };

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Buscador de huella digital</h3>
            <p className="text-sm text-muted-foreground">
              Investiga al autor en internet, plataformas y publicaciones para clonar su voz e historia.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3 text-[color:var(--ai)]" /> Deep Search
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nombre del autor o personaje</Label>
            <Input
              className="mt-1.5"
              placeholder="Ej. James Clear, Brené Brown, tu propio nombre…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Enlaces (LinkedIn, web, podcast, X, YouTube, blog…)
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                placeholder="https://…"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              />
              <Button type="button" variant="outline" onClick={addLink}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {links.map((l, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5 max-w-[260px] truncate">
                    <Globe2 className="h-3 w-3" />
                    <span className="truncate">{l.replace(/^https?:\/\//, "")}</span>
                    <button onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Contexto extra (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Profesión, sector, país, idioma, lo que te gustaría que la IA priorice…"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
        </div>

        <div className="flex md:flex-col gap-2 md:justify-start">
          <Button
            onClick={run}
            disabled={loading}
            className="primary-gradient text-primary-foreground shadow-soft md:w-44"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {loading ? "Escaneando…" : "Escanear huella"}
          </Button>
          {dossier && (
            <Button variant="outline" onClick={apply} className="md:w-44">
              <Fingerprint className="mr-2 h-4 w-4" />
              Aplicar al ADN
            </Button>
          )}
        </div>
      </div>

      {dossier && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3 animate-fade-in">
          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bio + Misión
              </span>
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" /> {dossier.confidenceScore}/100
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">{dossier.bio}</p>
            <p className="mt-3 text-xs italic text-muted-foreground">{dossier.mission}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Arquetipo: {dossier.arquetipo}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Quote className="h-3.5 w-3.5" /> Voz & catchphrases
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{dossier.voiceSamples}</p>
            {dossier.catchphrases.length > 0 && (
              <ul className="mt-3 space-y-1">
                {dossier.catchphrases.map((c, i) => (
                  <li key={i} className="rounded border-l-2 border-primary/40 bg-primary/5 px-2 py-1 text-xs italic">
                    "{c}"
                  </li>
                ))}
              </ul>
            )}
            {dossier.vocabulario.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {dossier.vocabulario.map((v, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground/80"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5" /> Plataformas & temas
            </div>
            <ul className="space-y-2">
              {dossier.platforms.map((p, i) => (
                <li key={i} className="text-xs">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-muted-foreground">{p.insight}</div>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      {p.url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {dossier.themes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {dossier.themes.map((t, i) => (
                  <Badge key={i} variant="outline" className="gap-1 text-[10px]">
                    <Tag className="h-2.5 w-2.5" />
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
