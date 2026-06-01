import { Check, Lock } from "lucide-react";
import { useBookStore, GOLDEN_PATH_STEPS } from "@/lib/store";
import { cn } from "@/lib/utils";

export function GoldenPathStepper() {
  const currentStep = useBookStore((s) => s.currentStep);
  const completed = useBookStore((s) => s.completedSteps);
  const setStep = useBookStore((s) => s.setStep);

  const isUnlocked = (id: number) =>
    id === 1 || completed.includes(id - 1) || completed.includes(id) || id === currentStep;

  const progress = ((currentStep - 1) / 5) * 100;

  return (
    <div className="border-b border-border/60 bg-surface/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-6 py-4">
        <div className="relative">
          {/* Progress rail */}
          <div className="absolute left-0 right-0 top-4 h-px bg-border" />
          <div
            className="absolute left-0 top-4 h-px bg-gradient-to-r from-primary to-[color:var(--ai)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />

          <ol className="relative flex items-start justify-between gap-2">
            {GOLDEN_PATH_STEPS.map((step) => {
              const isDone = completed.includes(step.id);
              const isCurrent = currentStep === step.id;
              const unlocked = isUnlocked(step.id);

              return (
                <li key={step.id} className="flex flex-1 flex-col items-center">
                  <button
                    type="button"
                    onClick={() => unlocked && setStep(step.id)}
                    disabled={!unlocked}
                    className={cn(
                      "group relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                      isDone && "border-primary bg-primary text-primary-foreground shadow-soft",
                      isCurrent &&
                        !isDone &&
                        "border-primary bg-surface text-primary ring-4 ring-primary/15",
                      !isCurrent && !isDone && unlocked && "border-border bg-surface text-muted-foreground hover:border-primary/60",
                      !unlocked && "cursor-not-allowed border-border bg-secondary text-muted-foreground/50",
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : !unlocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      step.id
                    )}
                  </button>
                  <div className="mt-2 hidden text-center md:block">
                    <div
                      className={cn(
                        "text-[11px] font-semibold tracking-wide",
                        isCurrent ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-medium text-muted-foreground md:hidden">
                    {step.short}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
