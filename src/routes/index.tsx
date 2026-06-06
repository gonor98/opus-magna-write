import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { maybeSeedDemo } from "@/lib/demo";
import { useBookStore } from "@/lib/store";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { GoldenPathStepper } from "@/components/layout/GoldenPathStepper";
import { PricingModal } from "@/components/PricingModal";
import { IkigaiEngine } from "@/components/steps/IkigaiEngine";
import { AuthorDNATab } from "@/components/tabs/AuthorDNATab";
import { ManuscriptTab } from "@/components/tabs/ManuscriptTab";
import { MatterTab } from "@/components/tabs/MatterTab";
import { DesignTab } from "@/components/tabs/DesignTab";
import { MarketingTab } from "@/components/tabs/MarketingTab";
import { AutoPilot } from "@/components/autopilot/AutoPilot";
import { AuthorResearch } from "@/components/research/AuthorResearch";
import { AIBookBuilder } from "@/components/ai-book/AIBookBuilder";
import { KDPReportPanel } from "@/components/kdp/KDPReportPanel";
import { LibraryPackPanel } from "@/components/library-pack/LibraryPackPanel";
import { E2EPaywallSuite } from "@/components/diagnostics/E2EPaywallSuite";
import { ResumeBanner } from "@/components/layout/ResumeBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Opus Magna Studio — The Ikigai Empire" },
      { name: "description", content: "Sindicato editorial autónomo: del Ikigai al bestseller en 6 pasos." },
    ],
  }),
  component: Studio,
});

function Studio() {
  const [focus, setFocus] = useState(false);
  const currentStep = useBookStore((s) => s.currentStep);
  const setStep = useBookStore((s) => s.setStep);
  const completed = useBookStore((s) => s.completedSteps);
  const markStepComplete = useBookStore((s) => s.markStepComplete);

  useEffect(() => {
    maybeSeedDemo();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      e.preventDefault();
      const store = useBookStore.getState();
      if (e.shiftKey) {
        const label = store.redo();
        if (label) toast.success(`↻ Rehecho: ${label}`);
      } else {
        const label = store.undo();
        if (label) toast.success(`↶ Deshecho: ${label}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goNext = () => {
    if (!completed.includes(currentStep)) markStepComplete(currentStep);
    setStep(currentStep + 1);
  };
  const goPrev = () => setStep(currentStep - 1);

  return (
    <div className="min-h-screen bg-background">
      {!focus && <Header focusMode={focus} setFocusMode={setFocus} />}
      {!focus && <ResumeBanner />}
      {!focus && <GoldenPathStepper />}

      <main className={"mx-auto px-6 py-8 " + (focus ? "max-w-4xl" : "max-w-[1400px]")}>
        {currentStep === 1 && <IkigaiEngine />}
        {currentStep === 2 && (
          <StepShell title="ADN del autor" subtitle="Paso 2 · Clonación de identidad multimodal">
            <AuthorResearch />
            <AutoPilot chapterCount={10} />
            <AuthorDNATab />
          </StepShell>
        )}
        {currentStep === 3 && (
          <StepShell title="Bestseller Matrix" subtitle="Paso 3 · Estructura de alta retención">
            <AIBookBuilder />
            <ManuscriptTab forceView="corkboard" />
          </StepShell>
        )}
        {currentStep === 4 && (
          <StepShell title="Editor Tiptap" subtitle="Paso 4 · Co-creación interactiva">
            <ManuscriptTab forceView="editor" />
          </StepShell>
        )}
        {currentStep === 5 && (
          <StepShell title="Diseño & Exportar" subtitle="Paso 5 · Portada + KDP-ready">
            <DesignTab />
            <MatterTab />
            <KDPReportPanel />
            <LibraryPackPanel />
          </StepShell>
        )}
        {currentStep === 6 && (
          <StepShell title="Launch & Marketing" subtitle="Paso 6 · Audiolibro, traducción, distribución">
            <MarketingTab />
            <E2EPaywallSuite />
          </StepShell>
        )}

        {!focus && currentStep > 1 && (
          <div className="mx-auto mt-10 flex max-w-3xl items-center justify-between border-t border-border/60 pt-6">
            <Button variant="outline" onClick={goPrev}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Paso anterior
            </Button>
            {currentStep < 6 && (
              <Button onClick={goNext} className="primary-gradient text-primary-foreground shadow-soft">
                Siguiente paso <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
            {currentStep === 6 && (
              <Button onClick={() => markStepComplete(6)} className="primary-gradient text-primary-foreground shadow-soft">
                ✨ Lanzar bestseller
              </Button>
            )}
          </div>
        )}
      </main>

      <PricingModal />
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {subtitle}
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
