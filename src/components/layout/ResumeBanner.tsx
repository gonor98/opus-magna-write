import { useBookStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { useState, useEffect } from "react";

export function ResumeBanner() {
  const currentStep = useBookStore((s) => s.currentStep);
  const completed = useBookStore((s) => s.completedSteps);
  const setStep = useBookStore((s) => s.setStep);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on initial mount if user had real progress
    const t = setTimeout(() => {
      if (currentStep > 1 || completed.length > 0) setShow(true);
    }, 200);
    return () => clearTimeout(t);
  }, [currentStep, completed.length]);

  if (!show || dismissed || (currentStep === 1 && completed.length === 0)) return null;

  const target = Math.max(currentStep, completed[completed.length - 1] || 1);
  const label = ["", "Motor Ikigai", "ADN del autor", "Bestseller Matrix", "Editor", "Diseño & Exportar", "Launch & Marketing"][target];

  return (
    <div className="border-b border-primary/30 bg-gradient-to-r from-primary/10 via-background to-[color:var(--ai)]/10">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-6 py-2.5 text-sm">
        <RotateCcw className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <strong>Bienvenido de vuelta.</strong>{" "}
          <span className="text-muted-foreground">
            Tu progreso del Golden Path se guardó automáticamente. Reanuda en el <strong>Paso {target} · {label}</strong>.
          </span>
        </div>
        <Button size="sm" onClick={() => { setStep(target); setDismissed(true); }} className="primary-gradient text-primary-foreground">
          Reanudar <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
