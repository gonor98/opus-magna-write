import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import { aiResearchAuthor, aiPersona, aiMarketOracle } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, BrainCircuit, Sparkles, User, Quote, Target, FileText, TrendingUp, Tag } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";

type Opportunity = {
  niche: string;
  demandScore: number;
  competitionScore: number;
  rationale: string;
  keywords: string[];
  bisacCategory: string;
};

export function AuthorDNATab() {
  const { authorDNA, setAuthorDNA, storyBible, setStoryBible, bookContext } = useBookStore();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<"" | "research" | "persona" | "oracle">("");
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const research = useServerFn(aiResearchAuthor);
  const persona = useServerFn(aiPersona);
  const oracle = useServerFn(aiMarketOracle);
  const photoRef = useRef<HTMLInputElement>(null);

  const discoverOpportunities = async () => {
    setLoading("oracle");
    try {
      const { opportunities } = await oracle({
        data: { topic: bookContext.topic || bookContext.title, authorBio: authorDNA.bio },
      });
      setOpps(opportunities);
      toast.success("Oráculo de Tendencias listo");
    } catch (e: any) {
      toast.error(e.message || "Error en el oráculo");
    } finally {
      setLoading("");
    }
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAuthorDNA({ photoDataUrl: r.result as string });
    r.readAsDataURL(f);
  };

  const investigate = async () => {
    if (!name.trim()) return toast.error("Ingresa un nombre para investigar");
    setLoading("research");
    try {
      const data = await research({ data: { name } });
      setAuthorDNA({ bio: data.bio, mission: data.mission, voiceSamples: data.voiceSamples });
      toast.success("Investigación completada");
      setName("");
    } catch (e: any) {
      toast.error(e.message || "Error al investigar");
    } finally {
      setLoading("");
    }
  };

  const extractPersona = async () => {
    if (!authorDNA.bio) return toast.error("Completa al menos la biografía");
    setLoading("persona");
    try {
      const { text } = await persona({
        data: { bio: authorDNA.bio, mission: authorDNA.mission, voice: authorDNA.voiceSamples },
      });
      setAuthorDNA({ extractedPersona: text });
      toast.success("Voice & Tone Bible generada");
    } catch (e: any) {
      toast.error(e.message || "Error generando persona");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Left: Author profile card */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <button
            onClick={() => photoRef.current?.click()}
            className="group relative h-28 w-28 overflow-hidden rounded-full border border-border bg-secondary shadow-soft transition hover:shadow-elevated"
          >
            {authorDNA.photoDataUrl ? (
              <img src={authorDNA.photoDataUrl} alt="Autor" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-10 w-10" />
              </div>
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-foreground/40 text-xs font-medium text-white group-hover:flex">
              <Upload className="mr-1 h-3 w-3" /> Foto
            </span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          <h3 className="mt-4 font-display text-xl font-semibold">Identidad del Autor</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            La voz, los valores y la misión que guiarán cada palabra del libro.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Label className="text-xs font-medium text-muted-foreground">Investigar autor en la web</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ej. James Clear"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && investigate()}
            />
            <Button onClick={investigate} disabled={loading === "research"} size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            La IA buscará biografía, misión y muestras de voz desde fuentes públicas.
          </p>
        </div>
      </Card>

      {/* Right: forms + persona */}
      <div className="space-y-6">
        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Bio, Misión & Voz</h3>
              <p className="text-sm text-muted-foreground">El núcleo del ADN editorial.</p>
            </div>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Sparkles className="h-3 w-3 text-[color:var(--ai)]" /> Tier Enterprise
            </Badge>
          </div>

          <div className="mt-5 grid gap-5">
            <Field label="Biografía profesional" icon={<FileText className="h-3.5 w-3.5" />}>
              <Textarea
                rows={4}
                placeholder="Hitos, recorrido, autoridad…"
                value={authorDNA.bio}
                onChange={(e) => setAuthorDNA({ bio: e.target.value })}
              />
            </Field>
            <Field label="Misión / propósito" icon={<Target className="h-3.5 w-3.5" />}>
              <Textarea
                rows={3}
                placeholder="¿Por qué este libro? ¿A quién sirve?"
                value={authorDNA.mission}
                onChange={(e) => setAuthorDNA({ mission: e.target.value })}
              />
            </Field>
            <Field label="Muestras de voz / citas" icon={<Quote className="h-3.5 w-3.5" />}>
              <Textarea
                rows={3}
                placeholder="Frases típicas, manifiestos, posts…"
                value={authorDNA.voiceSamples}
                onChange={(e) => setAuthorDNA({ voiceSamples: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              onClick={extractPersona}
              disabled={loading === "persona"}
              className="ai-gradient text-[color:var(--ai-foreground)] hover:opacity-90"
            >
              <BrainCircuit className="mr-2 h-4 w-4" />
              {loading === "persona" ? "Sintetizando…" : "Generar Voice & Tone Bible"}
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Voice & Tone Bible</h3>
            <Badge className="bg-[color:var(--ai-muted)] text-[color:var(--ai-foreground)] hover:bg-[color:var(--ai-muted)]">
              IA · Editorial
            </Badge>
          </div>
          <div className="mt-4 rounded-xl border border-border/60 bg-surface-elevated p-4">
            {authorDNA.extractedPersona ? (
              <Markdown source={authorDNA.extractedPersona} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no generada. Completa el ADN y pulsa <strong>Generar Voice & Tone Bible</strong>.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold">Story Bible</h3>
          <p className="text-sm text-muted-foreground">
            Reglas del mundo, hitos, personajes y continuidad narrativa que la IA respetará entre capítulos.
          </p>
          <Textarea
            rows={6}
            className="mt-4 font-mono text-sm"
            placeholder={"REGLAS DEL MUNDO:\n- …\n\nHITOS DEL AUTOR:\n- …"}
            value={storyBible}
            onChange={(e) => setStoryBible(e.target.value)}
          />
        </Card>

        <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[color:var(--ai)]" />
              <h3 className="font-display text-lg font-semibold">Oráculo de Tendencias</h3>
            </div>
            <Button
              onClick={discoverOpportunities}
              disabled={loading === "oracle"}
              className="ai-gradient text-[color:var(--ai-foreground)]"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {loading === "oracle" ? "Escaneando Amazon…" : "Descubrir Oportunidades de Mercado"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Alta demanda de búsqueda + bajas reseñas de competencia (estilo Helium 10 / Keepa).
          </p>
          {opps.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {opps.map((o, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 bg-surface-elevated p-4 shadow-soft animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <Badge className="bg-[color:var(--ai-muted)] text-[color:var(--ai-foreground)]">
                      Δ {o.demandScore - o.competitionScore}
                    </Badge>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      D{o.demandScore} / C{o.competitionScore}
                    </span>
                  </div>
                  <h4 className="mt-2 font-display text-base font-semibold leading-tight">{o.niche}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{o.rationale}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {o.keywords.slice(0, 5).map((k) => (
                      <span
                        key={k}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground/80"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Tag className="h-3 w-3" /> {o.bisacCategory}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}
