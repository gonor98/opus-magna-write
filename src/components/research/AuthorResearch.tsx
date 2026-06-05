import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiLiveFootprint } from "@/lib/ai.functions";
import { useBookStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search, Loader2, Fingerprint, Globe2, Quote, Tag, Sparkles, TrendingUp,
  X, Plus, Youtube, FileText, Linkedin, Twitter, Mic, Link2, Radar,
} from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";

type Source = { url: string; title: string; kind: string; snippet: string };
type Dossier = {
  bio: string; mission: string; voiceSamples: string; arquetipo: string;
  vocabulario: string[]; catchphrases: string[]; themes: string[];
  platforms: { name: string; url?: string; insight: string }[];
  narrativeBeats: string[]; forbiddenPhrases: string[]; confidenceScore: number;
};

const KIND_ICON: Record<string, any> = {
  youtube: Youtube, linkedin: Linkedin, twitter: Twitter,
  podcast: Mic, article: FileText, other: Link2,
};

export function AuthorResearch() {
  const setAuthorDNA = useBookStore((s) => s.setAuthorDNA);
  const setPublishingForm = useBookStore((s) => s.setPublishingForm);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [depth, setDepth] = useState<"fast" | "deep">("fast");
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [meta, setMeta] = useState<{ scrapedCount: number; totalFound: number } | null>(null);
  const scan = useServerFn(aiLiveFootprint);

  const addLink = () => {
    const v = linkInput.trim(); if (!v) return;
    try { new URL(v); setLinks((l) => [...l, v]); setLinkInput(""); }
    catch { toast.error("URL inválida"); }
  };

  const run = async () => {
    if (name.trim().length < 2) return toast.error("Escribe el nombre del autor");
    if (!requireFeature("scrape.author", "El scraping de huella digital")) return;
    setLoading(true);
    const tid = toast.loading(`🛰️ Buscando en YouTube, blogs, LinkedIn, X… (${depth})`);
    try {
      const r = await scan({ data: { name, context: context || undefined, links: links.length ? links : undefined, depth } });
      setDossier(r.dossier);
      setSources(r.sources);
      setMeta({ scrapedCount: r.scrapedCount, totalFound: r.totalFound });
      toast.success(`Dossier vivo · ${r.scrapedCount}/${r.totalFound} fuentes · confianza ${r.dossier.confidenceScore}/100`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error en el scraping", { id: tid });
    } finally { setLoading(false); }
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
        dossier.narrativeBeats.length ? `\n\nEstructura narrativa típica:\n- ${dossier.narrativeBeats.join("\n- ")}` : "",
        dossier.forbiddenPhrases.length ? `\n\nProhibido (clichés que no usa):\n- ${dossier.forbiddenPhrases.join("\n- ")}` : "",
      ].join(""),
    });
    if (!useBookStore.getState().publishingForm.shortBio) {
      setPublishingForm({ shortBio: dossier.bio.split(". ").slice(0, 3).join(". ") + "." });
    }
    toast.success("ADN del autor actualizado con el dossier vivo");
  };

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Live Footprint Scanner</h3>
            <p className="text-sm text-muted-foreground">
              Búsqueda <strong>en vivo</strong> en YouTube, blogs, artículos, LinkedIn y X. Scrapea contenido real y sintetiza un ADN auténtico del autor.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3 text-[color:var(--ai)]" /> Firecrawl + AI
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nombre del autor o personaje</Label>
            <Input className="mt-1.5" placeholder="Ej. James Clear, Brené Brown, tu nombre…"
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Enlaces directos (opcional)</Label>
            <div className="mt-1.5 flex gap-2">
              <Input placeholder="https://…" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())} />
              <Button type="button" variant="outline" onClick={addLink}><Plus className="h-4 w-4" /></Button>
            </div>
            {links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {links.map((l, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5 max-w-[260px] truncate">
                    <Globe2 className="h-3 w-3" />
                    <span className="truncate">{l.replace(/^https?:\/\//, "")}</span>
                    <button onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Contexto extra (opcional)</Label>
            <Textarea rows={2} placeholder="Profesión, país, idioma, foco temático…"
              value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Profundidad:</Label>
            <Button size="sm" variant={depth === "fast" ? "default" : "outline"} onClick={() => setDepth("fast")}>⚡ Fast (2/query · 5 scraped)</Button>
            <Button size="sm" variant={depth === "deep" ? "default" : "outline"} onClick={() => setDepth("deep")}>🔬 Deep (4/query · 8 scraped)</Button>
          </div>
        </div>

        <div className="flex md:flex-col gap-2 md:justify-start">
          <Button onClick={run} disabled={loading} className="primary-gradient text-primary-foreground shadow-soft md:w-44">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {loading ? "Escaneando…" : "🛰️ Escanear ahora"}
          </Button>
          {dossier && (
            <Button variant="outline" onClick={apply} className="md:w-44">
              <Fingerprint className="mr-2 h-4 w-4" /> Aplicar al ADN
            </Button>
          )}
        </div>
      </div>

      {meta && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1"><Radar className="h-3 w-3" /> {meta.totalFound} resultados</Badge>
          <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> {meta.scrapedCount} scrapeadas</Badge>
          {dossier && <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" /> confianza {dossier.confidenceScore}/100</Badge>}
        </div>
      )}

      {dossier && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3 animate-fade-in">
          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4 lg:col-span-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio + Misión + Arquetipo</div>
            <p className="text-sm leading-relaxed">{dossier.bio}</p>
            <p className="mt-3 text-xs italic text-muted-foreground">{dossier.mission}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> {dossier.arquetipo}
            </div>
            {dossier.narrativeBeats.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Estructura típica</div>
                <ol className="ml-4 list-decimal space-y-0.5 text-xs">
                  {dossier.narrativeBeats.map((b, i) => <li key={i}>{b}</li>)}
                </ol>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Quote className="h-3.5 w-3.5" /> Voz & catchphrases
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{dossier.voiceSamples}</p>
            {dossier.catchphrases.length > 0 && (
              <ul className="mt-3 space-y-1">
                {dossier.catchphrases.map((c, i) => (
                  <li key={i} className="rounded border-l-2 border-primary/40 bg-primary/5 px-2 py-1 text-xs italic">"{c}"</li>
                ))}
              </ul>
            )}
            {dossier.vocabulario.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {dossier.vocabulario.map((v, i) => (
                  <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground/80">{v}</span>
                ))}
              </div>
            )}
            {dossier.forbiddenPhrases.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold uppercase text-destructive">Prohibido decir</div>
                <ul className="space-y-0.5">
                  {dossier.forbiddenPhrases.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground line-through">{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-elevated p-4 lg:col-span-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5" /> Fuentes vivas usadas en la síntesis
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {sources.map((s, i) => {
                const Icon = KIND_ICON[s.kind] || Link2;
                return (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer"
                    className="group rounded-lg border border-border/60 bg-background p-3 transition hover:border-primary/50 hover:shadow-soft">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.kind}</span>
                    </div>
                    <div className="line-clamp-2 text-xs font-medium">{s.title}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{s.snippet}</div>
                  </a>
                );
              })}
            </div>
            {dossier.themes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {dossier.themes.map((t, i) => (
                  <Badge key={i} variant="outline" className="gap-1 text-[10px]"><Tag className="h-2.5 w-2.5" />{t}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
