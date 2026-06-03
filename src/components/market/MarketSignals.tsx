import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiDeepScrape } from "@/lib/ai.functions";
import { useBookStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, TrendingUp, Target, DollarSign, AlertTriangle,
  Sparkles, Check, Radar, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { requireFeature } from "@/lib/tier";
import { cn } from "@/lib/utils";

export function MarketSignals() {
  const {
    bookContext, publishingForm, setPublishingForm,
    marketSignals, setMarketSignals,
  } = useBookStore();
  const [busy, setBusy] = useState(false);
  const scrape = useServerFn(aiDeepScrape);

  const run = async () => {
    if (!bookContext.title || !bookContext.topic) {
      return toast.error("Define título y tema (nicho) primero");
    }
    if (!requireFeature("scrape.market", "Análisis de mercado profundo")) return;
    setBusy(true);
    const tid = toast.loading("📡 Escaneando Amazon BSR + competencia…");
    try {
      const data = await scrape({
        data: {
          title: bookContext.title,
          subtitle: bookContext.subtitle,
          niche: bookContext.topic,
          synopsis: publishingForm.description,
        },
      });
      setMarketSignals({ ...data, generatedAt: new Date().toISOString() });
      toast.success("Señales de mercado listas", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error en deep scrape", { id: tid });
    } finally {
      setBusy(false);
    }
  };

  const applyAll = () => {
    if (!marketSignals) return;
    setPublishingForm({
      keywords: marketSignals.keywords.slice(0, 7).join(", "),
      categories: marketSignals.bisac.slice(0, 3).join(" | "),
      description: marketSignals.positioning + "\n\n" + (publishingForm.description || ""),
      pricePhysical: marketSignals.priceSweetSpot.physical,
      priceDigital: marketSignals.priceSweetSpot.digital,
    });
    toast.success("Posicionamiento, keywords, categorías y precios aplicados");
  };

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Market Signals · Deep Scrape</h3>
            <p className="text-sm text-muted-foreground">
              Demanda, competencia, precios, keywords A9 y GAP de los líderes del nicho.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {marketSignals && (
            <Button onClick={applyAll} variant="outline" size="sm">
              <Check className="mr-1.5 h-4 w-4" /> Aplicar al libro
            </Button>
          )}
          <Button onClick={run} disabled={busy} className="primary-gradient text-primary-foreground shadow-soft">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {marketSignals ? "Re-escanear" : "Escanear mercado"}
          </Button>
        </div>
      </div>

      {marketSignals && (
        <div className="mt-6 space-y-5 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Demanda" value={marketSignals.demandIndex} color="emerald" icon={TrendingUp} />
            <Metric label="Competencia" value={marketSignals.competitionIndex} color="rose" icon={Target} />
            <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <DollarSign className="h-3 w-3" /> Sweet spot
              </div>
              <div className="mt-1 font-display text-xl font-semibold">
                ${marketSignals.priceSweetSpot.digital} <span className="text-xs text-muted-foreground">/ ${marketSignals.priceSweetSpot.physical}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">digital / físico · BSR {marketSignals.bsrEstimate}</div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Posicionamiento diferencial</div>
            <p className="mt-1 text-sm leading-relaxed">{marketSignals.positioning}</p>
            <div className="mt-2 text-xs italic text-muted-foreground">Hook portada: "{marketSignals.hook}"</div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Keywords A9 long-tail</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {marketSignals.keywords.map((k) => (
                <Badge key={k} variant="outline" className="text-[11px]">{k}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rutas BISAC</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {marketSignals.bisac.map((b) => (
                <Badge key={b} className="bg-secondary text-foreground/80 text-[11px]">{b}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShoppingBag className="h-3 w-3" /> Competidores y GAPs
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {marketSignals.competitors.map((c, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-surface p-3 text-xs">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-muted-foreground">por {c.author} · ~{c.reviewsApprox.toLocaleString()} reviews</div>
                  <div className="mt-1.5">{c.positioning}</div>
                  <div className="mt-1.5 rounded bg-emerald-500/10 px-2 py-1 text-emerald-700">
                    GAP: {c.gap}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {marketSignals.risks?.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Riesgos a mitigar
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs text-foreground/80">
                {marketSignals.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Metric({
  label, value, color, icon: Icon,
}: { label: string; value: number; color: "emerald" | "rose"; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}/100</div>
      <Progress value={value} className={cn("mt-1.5 h-1.5", color === "emerald" ? "[&>div]:bg-emerald-500" : "[&>div]:bg-rose-500")} />
    </div>
  );
}
