import { BookOpen, Save, Download, Upload, Maximize2, Minimize2, Sparkles, FileDown, Undo2, Redo2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookStore, wordCount } from "@/lib/store";
import { syncToCloud, listCloudProjects, loadFromCloud } from "@/lib/cloud";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { ExportModal } from "@/components/ExportModal";

type Props = {
  focusMode: boolean;
  setFocusMode: (b: boolean) => void;
};

export function Header({ focusMode, setFocusMode }: Props) {
  const chapters = useBookStore((s) => s.chapters);
  const bookContext = useBookStore((s) => s.bookContext);
  const importProject = useBookStore((s) => s.importProject);
  const past = useBookStore((s) => s._past);
  const future = useBookStore((s) => s._future);
  const undo = useBookStore((s) => s.undo);
  const redo = useBookStore((s) => s.redo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const handleSync = async () => {
    const state = useBookStore.getState();
    setSyncing(true);
    const tid = toast.loading("Sincronizando con Lovable Cloud…");
    try {
      await syncToCloud({
        authorDNA: state.authorDNA,
        storyBible: state.storyBible,
        bookContext: state.bookContext,
        chapters: state.chapters,
        frontBackMatter: state.frontBackMatter,
        publishingForm: state.publishingForm,
        designConfig: state.designConfig,
        launchKit: state.launchKit,
        bookCover: state.bookCover,
      });
      toast.success("☁️ Guardado en la nube", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Error sincronizando", { id: tid });
    } finally {
      setSyncing(false);
    }
  };

  const handleCloudLoad = async () => {
    setLoadingCloud(true);
    try {
      const list = await listCloudProjects();
      if (!list.length) {
        toast("No hay proyectos en la nube todavía");
        return;
      }
      const latest = list[0];
      const data = await loadFromCloud(latest.slug);
      if (data) {
        importProject(data as any);
        toast.success(`Restaurado · ${latest.title || latest.slug}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error cargando de la nube");
    } finally {
      setLoadingCloud(false);
    }
  };

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
          <Button
            variant="ghost"
            size="icon"
            disabled={past.length === 0}
            onClick={() => {
              const label = undo();
              if (label) toast.success(`↶ Deshecho: ${label}`);
            }}
            title="Deshacer (Ctrl+Z)"
            className="h-8 w-8"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={future.length === 0}
            onClick={() => {
              const label = redo();
              if (label) toast.success(`↻ Rehecho: ${label}`);
            }}
            title="Rehacer (Ctrl+Shift+Z)"
            className="h-8 w-8"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 hidden h-5 w-px bg-border md:block" />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar
          </Button>
          <Button variant="ghost" size="sm" onClick={exportBackup}>
            <Download className="mr-1.5 h-4 w-4" /> Backup
          </Button>
          <Button
            size="sm"
            className="primary-gradient text-primary-foreground shadow-soft transition hover:scale-[1.02]"
            onClick={() => setExportOpen(true)}
          >
            <FileDown className="mr-1.5 h-4 w-4" /> Exportar
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => useBookStore.getState().setPricingOpen(true)}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Crown className="h-3.5 w-3.5" /> Upgrade
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFocusMode(!focusMode)}>
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

        </div>
      </div>
      <ExportModal open={exportOpen} onOpenChange={setExportOpen} />
    </header>
  );
}
