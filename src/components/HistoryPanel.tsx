import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBookStore } from "@/lib/store";
import { Undo2, Redo2, History, CircleDot } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function HistoryPanel({ open, onOpenChange }: Props) {
  const past = useBookStore((s) => s._past);
  const future = useBookStore((s) => s._future);
  const undo = useBookStore((s) => s.undo);
  const redo = useBookStore((s) => s.redo);

  const jumpBack = (steps: number) => {
    let label: string | null = null;
    for (let i = 0; i < steps; i++) label = useBookStore.getState().undo();
    if (label) toast.success(`↶ Deshecho ${steps} paso${steps > 1 ? "s" : ""}`);
  };
  const jumpForward = (steps: number) => {
    let label: string | null = null;
    for (let i = 0; i < steps; i++) label = useBookStore.getState().redo();
    if (label) toast.success(`↻ Rehecho ${steps} paso${steps > 1 ? "s" : ""}`);
  };

  // Render newest first
  const futureItems = future.map((e, i) => ({ entry: e, distance: i + 1, dir: "forward" as const }));
  const pastItems = [...past].reverse().map((e, i) => ({ entry: e, distance: i + 1, dir: "back" as const }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <History className="h-4 w-4" /> Historial
          </SheetTitle>
          <SheetDescription>Navega cualquier punto anterior o posterior de tu sesión.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" disabled={!past.length} onClick={() => jumpBack(1)}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Deshacer
          </Button>
          <Button size="sm" variant="outline" disabled={!future.length} onClick={() => jumpForward(1)}>
            <Redo2 className="mr-1.5 h-3.5 w-3.5" /> Rehacer
          </Button>
        </div>

        <div className="mt-5 max-h-[calc(100vh-180px)] space-y-1 overflow-auto pr-2">
          {futureItems.length > 0 && (
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por rehacer
            </div>
          )}
          {futureItems.map((it, idx) => (
            <button
              key={`f-${idx}`}
              onClick={() => jumpForward(it.distance)}
              className="group flex w-full items-center gap-3 rounded-lg border border-dashed border-border/60 bg-surface px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
            >
              <Redo2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{it.entry.label || "Cambio"}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">+{it.distance}</div>
              </div>
            </button>
          ))}

          <div className="my-3 flex items-center gap-2 text-xs text-primary">
            <CircleDot className="h-3.5 w-3.5" /> <span className="font-medium">Estado actual</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {pastItems.length === 0 && futureItems.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
              Aún no hay acciones registradas en esta sesión.
            </p>
          )}

          {pastItems.map((it, idx) => (
            <button
              key={`p-${idx}`}
              onClick={() => jumpBack(it.distance)}
              className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
            >
              <Undo2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{it.entry.label || "Cambio"}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">−{it.distance}</div>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
