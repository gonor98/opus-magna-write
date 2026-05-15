import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import { useBookStore, wordCount } from "@/lib/store";
import { toast } from "sonner";

/**
 * Print-ready cover spread: back cover | spine | front cover.
 * Sized at a fixed virtual resolution so html2canvas at scale 3 yields
 * a high-DPI PNG suitable for KDP / IngramSpark print upload.
 */
export function CoverSpread() {
  const { bookContext, publishingForm, authorDNA, bookCover, chapters } = useBookStore();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const wc = wordCount(chapters);
  // Approximate spine width (KDP white paper, 0.0025"/page) — purely visual hint.
  const pages = Math.max(80, Math.ceil(wc / 280));
  const spineMm = Math.max(8, Math.round(pages * 0.0635));

  const downloadSpread = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("No se pudo generar la imagen");
          setBusy(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(bookContext.title || "Portada").replace(/\s+/g, "_")}_Spread_PrintReady.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Spread de portada descargado en alta resolución");
        setBusy(false);
      }, "image/png");
    } catch (e: any) {
      toast.error(e.message || "Error al renderizar el spread");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Spread imprenta (Portada · Lomo · Contraportada)</h3>
          <p className="text-sm text-muted-foreground">
            Vista plana lista para KDP / IngramSpark. Lomo estimado: {spineMm} mm ({pages} págs).
          </p>
        </div>
        <Button
          onClick={downloadSpread}
          disabled={busy}
          className="primary-gradient text-primary-foreground"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Descargar PNG (300 DPI)
        </Button>
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-secondary/30 p-4">
        <div
          id="cover-spread"
          ref={ref}
          className="relative mx-auto flex"
          style={{
            width: 1200,
            height: 800,
            background: "#0e1024",
            color: "#f5f3ee",
            fontFamily: "Georgia, serif",
          }}
        >
          {/* Back cover */}
          <div className="flex flex-col justify-between p-10" style={{ width: 560 }}>
            <div className="text-[11px] uppercase tracking-[0.3em] opacity-70">{publishingForm.categories || "Bestseller Internacional"}</div>
            <div>
              <p className="text-[15px] leading-relaxed">
                {publishingForm.description || "La sinopsis del libro aparecerá aquí. Genera los metadatos en Diseño & Marketing para llenarla automáticamente."}
              </p>
            </div>
            <div className="border-t border-white/20 pt-4">
              <div className="text-sm font-semibold">{publishingForm.author || "Autor"}</div>
              <div className="mt-1 text-[12px] leading-snug opacity-80">
                {publishingForm.shortBio || authorDNA.bio?.slice(0, 220) || "Bio de contraportada (genérala desde la pestaña Diseño)."}
              </div>
            </div>
          </div>

          {/* Spine */}
          <div
            className="flex items-center justify-center border-x border-white/15"
            style={{ width: 80, background: "#070817" }}
          >
            <div
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: 18,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              {bookContext.title || "Título"} · {publishingForm.author || "Autor"}
            </div>
          </div>

          {/* Front cover */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden p-10 text-center" style={{ width: 560 }}>
            {bookCover ? (
              <img src={bookCover} alt="Portada" className="absolute inset-0 h-full w-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#1c1f40,#3b3f76)" }} />
            )}
            <div className="relative z-10 rounded-xl bg-black/40 p-6 backdrop-blur-sm">
              <div className="font-display text-[34px] font-bold leading-tight">{bookContext.title || "Título"}</div>
              <div className="mt-2 text-[14px] italic opacity-90">{bookContext.subtitle || "Subtítulo"}</div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.4em] opacity-80">{publishingForm.author || "Autor"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
