import { Check, Sparkles, Crown, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookStore, type UserTier } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tier = {
  id: UserTier;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
  decoy?: boolean;
  icon: React.ReactNode;
};

const TIERS: Tier[] = [
  {
    id: "FREE",
    name: "Gratis",
    price: 0,
    tagline: "Prueba el flujo Ikigai",
    icon: <Sparkles className="h-4 w-4" />,
    features: [
      "1 proyecto activo",
      "3 Blueprints/mes",
      "Editor Tiptap básico",
      "Export PDF con marca de agua",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 49,
    tagline: "Para autores serios",
    icon: <Zap className="h-4 w-4" />,
    features: [
      "5 proyectos",
      "Blueprints ilimitados",
      "ADN del autor + Voice OCR",
      "Export DOCX + PDF KDP",
      "Soporte por email",
    ],
  },
  {
    id: "PUBLISHER",
    name: "Publisher",
    price: 119,
    tagline: "Estudio editorial",
    decoy: true,
    icon: <Crown className="h-4 w-4" />,
    features: [
      "20 proyectos",
      "Cover Engine + ISBN/EAN",
      "ePub + ACX scripts",
      "Auditor de manuscrito IA",
    ],
  },
  {
    id: "EMPIRE",
    name: "Empire",
    price: 149,
    tagline: "Sindicato editorial autónomo",
    highlight: true,
    icon: <Crown className="h-4 w-4" />,
    features: [
      "Proyectos ilimitados",
      "Todo lo de Publisher +",
      "Voice cloning + audiolibro",
      "Traducción con DNA preservation",
      "Distribución KDP/IngramSpark/Apple",
      "Deep scraping de competencia",
      "Soporte prioritario 24/7",
    ],
  },
];

export function PricingModal() {
  const open = useBookStore((s) => s.pricingOpen);
  const setOpen = useBookStore((s) => s.setPricingOpen);
  const currentTier = useBookStore((s) => s.userTier);
  const setTier = useBookStore((s) => s.setUserTier);

  const handleSelect = (tier: Tier) => {
    if (tier.id === "FREE") {
      setTier(tier.id);
      setOpen(false);
      toast("Estás en el plan Gratis");
      return;
    }
    setTier(tier.id);
    setOpen(false);
    toast.success(`Plan ${tier.name} activado (mock). Stripe se conectará en Fase 2.`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl border-border/60 bg-surface p-0">
        <div className="border-b border-border/60 bg-gradient-to-br from-surface to-secondary/30 px-8 py-6">
          <DialogHeader>
            <Badge className="mb-2 w-fit gap-1.5 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="h-3 w-3" /> Decoy pricing — Empire es el mejor valor
            </Badge>
            <DialogTitle className="font-display text-3xl font-bold">
              Elige tu camino al bestseller
            </DialogTitle>
            <DialogDescription className="text-base">
              Cada plan desbloquea más superpoderes editoriales. Cambia o cancela cuando quieras.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5 transition-all",
                tier.highlight
                  ? "border-primary bg-gradient-to-br from-primary/5 to-[color:var(--ai)]/10 shadow-luxe ring-2 ring-primary scale-[1.02]"
                  : tier.decoy
                    ? "border-border bg-surface opacity-90"
                    : "border-border bg-surface hover:border-primary/40",
                currentTier === tier.id && "ring-2 ring-[color:var(--ai)]",
              )}
            >
              {tier.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1 bg-primary text-primary-foreground shadow-soft">
                  <Crown className="h-3 w-3" /> Mejor Valor
                </Badge>
              )}

              <div className="mb-4 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    tier.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground",
                  )}
                >
                  {tier.icon}
                </div>
                <div>
                  <div className="font-semibold">{tier.name}</div>
                  <div className="text-xs text-muted-foreground">{tier.tagline}</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">${tier.price}</span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                </div>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        tier.highlight ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className={tier.decoy ? "text-muted-foreground" : ""}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(tier)}
                disabled={currentTier === tier.id}
                className={cn(
                  "w-full",
                  tier.highlight && "primary-gradient text-primary-foreground shadow-soft",
                )}
                variant={tier.highlight ? "default" : "outline"}
              >
                {currentTier === tier.id ? "Plan actual" : `Elegir ${tier.name}`}
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 bg-secondary/20 px-6 py-3 text-center text-xs text-muted-foreground">
          🔒 Pagos procesados por Stripe · Cancela en 1 clic · Garantía de 14 días
        </div>
      </DialogContent>
    </Dialog>
  );
}
