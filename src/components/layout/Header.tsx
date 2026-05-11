import { BookOpen, Save, Download, Upload, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookStore, wordCount } from "@/lib/store";
import { toast } from "sonner";
import { useRef } from "react";

type Props = {
  focusMode: boolean;
  setFocusMode: (b: boolean) => void;
};

export function Header({ focusMode, setFocusMode }: Props) {
  const chapters = useBookStore((s) => s.chapters);
  const bookContext = useBookStore((s) => s.bookContext);
  const importProject = useBookStore((s) => s.importProject);
  const fileRef = useRef<HTMLInputElement>(null);

  const wc = wordCount(chapters);

  const exportBackup = () => {
    const state = useBookStore.getState();
    const data = {
      authorDNA: state.authorDNA,
      storyBible: state.storyBible,
      bookContext: state.bookContext,
      chapters: state.chapters,
      frontBackMatter: state.frontBackMatter,
      publishingForm: state.publishingForm,
      designConfig: state.designConfig,
      launchKit: state.launchKit,
      bookCover: state.bookCover,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(bookContext.title || "Proyecto").replace(/\s+/g, "_")}.opus.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup descargado");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      importProject(data);
      toast.success("Proyecto restaurado");
    } catch {
      toast.error("Archivo de backup inválido");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <div className="primary-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight">
              Opus Magna <span className="text-muted-foreground">Studio</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Bestseller AI Workspace
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Badge variant="secondary" className="gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3 text-[color:var(--ai)]" />
            Lovable AI
          </Badge>
          <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{wc.toLocaleString()}</span> palabras
            <span className="mx-2 text-border">·</span>
            <span className="font-semibold text-foreground">{chapters.length}</span> capítulos
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".json,.opus" hidden onChange={handleImport} />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar
          </Button>
          <Button variant="ghost" size="sm" onClick={exportBackup}>
            <Download className="mr-1.5 h-4 w-4" /> Backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.success("🔒 Proyecto sincronizado localmente");
            }}
          >
            <Save className="mr-1.5 h-4 w-4" /> Guardar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFocusMode(!focusMode)}>
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
