import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBookStore } from "@/lib/store";
import { aiMarketing } from "@/lib/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Megaphone, MonitorPlay, Copy } from "lucide-react";
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
    </div>
  );
}
