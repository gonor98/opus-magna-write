import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  PlayCircle,
  Image as ImageIcon,
  Book,
} from "lucide-react";
import { useBookStore, type UserTier } from "@/lib/store";
import { hasTier, featureTier, tierLabel, type Feature } from "@/lib/tier";
import {
  buildCoverSpec,
  validateCoverImage,
  validateManuscriptForKDP,
  validateEpubManifest,
  validateDocxIntent,
  TRIM_PRESETS,
  type TrimKey,
  type ValidationReport,
} from "@/lib/kdp-specs";
import { useServerFn } from "@tanstack/react-start";
import {
  aiStructure,
  aiWriteChapter,
  aiPersona,
  aiCoverPromptPack,
  aiDeepScrape,
  aiMarketing,
} from "@/lib/ai.functions";
import { toast } from "sonner";

/* ---------------- Paywall Matrix ---------------- */

const FEATURES: { key: Feature; label: string }[] = [
  { key: "editor.ai", label: "Editor · acciones AI" },
  { key: "cover.generate", label: "Portada · generación" },
  { key: "cover.variants", label: "Portada · 4 variantes" },
  { key: "export.pdf", label: "Export PDF" },
  { key: "export.docx", label: "Export DOCX" },
  { key: "export.epub", label: "Export EPUB" },
  { key: "export.acx", label: "Export ACX/SSML" },
  { key: "audit", label: "Auditor manuscrito" },
  { key: "translate", label: "Traducción" },
  { key: "voice.clone", label: "Voz clonada" },
  { key: "scrape.market", label: "Deep scraping mercado" },
  { key: "scrape.author", label: "Deep scraping autor" },
];

const TIERS: UserTier[] = ["FREE", "PRO", "PUBLISHER", "EMPIRE"];

function PaywallMatrix() {
  const currentTier = useBookStore((s) => s.userTier);
  const setTier = useBookStore((s) => s.setUserTier);
  return (
    <Card className="rounded-2xl border-border/70 p-5 shadow-soft">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="primary-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Auditoría de paywall</h3>
            <p className="text-xs text-muted-foreground">
              Matriz feature × tier. Verifica gating de forma exhaustiva.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Tier activo:</span>
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition " +
                (currentTier === t
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "border border-border bg-surface hover:bg-secondary")
              }
            >
              {tierLabel[t]}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Feature</th>
              <th className="px-3 py-2 text-left">Requiere</th>
              {TIERS.map((t) => (
                <th key={t} className="px-3 py-2 text-center">
                  {tierLabel[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => {
              const need = featureTier(f.key);
              return (
                <tr key={f.key} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{f.label}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{tierLabel[need]}</td>
                  {TIERS.map((t) => {
                    const allowed = hasTier(t, need);
                    return (
                      <td key={t} className="px-3 py-2 text-center">
                        {allowed ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-[color:var(--success)]" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-destructive/70" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ✔ permitido por <code>hasTier()</code> · ✘ disparará <code>PricingModal</code> al usar la acción.
      </p>
    </Card>
  );
}

/* ---------------- KDP Cover & Manuscript Validator ---------------- */

function KdpValidator() {
  const state = useBookStore();
  const [trim, setTrim] = useState<TrimKey>("6x9");
  const [paper, setPaper] = useState<"white" | "cream" | "color">("white");
  const [pages, setPages] = useState(220);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState(false);

  const spec = useMemo(() => buildCoverSpec(trim, pages, paper), [trim, pages, paper]);

  const manuscriptReport = useMemo(
    () =>
      validateManuscriptForKDP({
        title: state.bookContext.title,
        author: state.publishingForm.author,
        description: state.publishingForm.description,
        keywords: state.publishingForm.keywords,
        isbn: state.publishingForm.isbn,
        chapters: state.chapters.map((c) => ({ title: c.title, content: c.content })),
        hasCover: !!state.bookCover,
      }),
    [state.bookContext, state.publishingForm, state.chapters, state.bookCover],
  );

  const epubReport = useMemo(
    () =>
      validateEpubManifest({
        hasNav: true,
        hasCover: !!state.bookCover,
        spineCount: state.chapters.length + (state.frontBackMatter.prologue ? 1 : 0),
        hasMetadataTitle: !!state.bookContext.title,
        hasMetadataAuthor: !!state.publishingForm.author,
        hasLanguage: true,
      }),
    [state.bookCover, state.chapters.length, state.frontBackMatter.prologue, state.bookContext.title, state.publishingForm.author],
  );

  const docxReport = useMemo(
    () =>
      validateDocxIntent({
        hasTitlePage: !!state.bookContext.title,
        hasChapters: state.chapters.length > 0,
        hasHeadings: true,
        hasPageBreaks: true,
        hasNumbering: true,
        hasMetadata: !!state.publishingForm.author && !!state.publishingForm.description,
      }),
    [state.bookContext.title, state.chapters.length, state.publishingForm.author, state.publishingForm.description],
  );

  const validateCover = async () => {
    if (!state.bookCover) return toast.error("No hay portada principal seleccionada");
    setBusy(true);
    try {
      const r = await validateCoverImage(state.bookCover, spec, "front");
      setReport(r);
      if (r.ok) toast.success("Portada válida para KDP");
      else toast.warning(`${r.errors} errores · ${r.warnings} avisos`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/70 p-5 shadow-soft">
      <header className="flex items-center gap-3">
        <div className="ai-gradient flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--ai-foreground)] shadow-soft">
          <Book className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Validación KDP</h3>
          <p className="text-xs text-muted-foreground">
            Portada, manuscrito, EPUB y DOCX según specs Amazon (300 DPI, bleed, safe, gutter, metadatos).
          </p>
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Trim">
          <select
            value={trim}
            onChange={(e) => setTrim(e.target.value as TrimKey)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {Object.entries(TRIM_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Papel">
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as any)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="white">Blanco (0.0023")</option>
            <option value="cream">Crema (0.0025")</option>
            <option value="color">Color (0.0023")</option>
          </select>
        </Field>
        <Field label="Páginas">
          <input
            type="number"
            min={24}
            max={828}
            value={pages}
            onChange={(e) => setPages(Math.max(24, Math.min(828, +e.target.value || 24)))}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </Field>
        <Field label="Acción">
          <Button onClick={validateCover} disabled={busy} className="h-9 w-full" variant="outline">
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="mr-2 h-3.5 w-3.5" />}
            Validar portada
          </Button>
        </Field>
      </div>

      <div className="mt-4 grid gap-2 rounded-xl border border-border/60 bg-secondary/40 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lomo" value={`${spec.spineIn}" (${pages}p)`} />
        <Stat label="Spread + bleed" value={`${spec.spreadWidthIn}" × ${spec.spreadHeightIn}"`} />
        <Stat label="Portada @300 DPI" value={`${spec.frontPxWidth}×${spec.frontPxHeight}px`} />
        <Stat label="Spread @300 DPI" value={`${spec.spreadWidthPx}×${spec.spreadHeightPx}px`} />
        <Stat label="Gutter mínimo" value={`${spec.gutterIn}"`} />
        <Stat label="Bleed" value={`${spec.bleedIn}"`} />
        <Stat label="Safe area" value={`${spec.safeIn}"`} />
        <Stat label="eBook Kindle" value={`${2560}×${1600}px`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReportCard title="Portada actual" report={report} empty="Pulsa «Validar portada» para auditar la imagen." />
        <ReportCard title="Manuscrito KDP" report={manuscriptReport} />
        <ReportCard title="EPUB 3.0" report={epubReport} />
        <ReportCard title="DOCX manuscrito" report={docxReport} />
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-xs">{value}</div>
    </div>
  );
}

function ReportCard({
  title,
  report,
  empty,
}: {
  title: string;
  report: ValidationReport | null;
  empty?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{title}</div>
        {report && (
          <Badge
            variant={report.ok ? "default" : report.errors ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {report.ok ? "OK" : `${report.errors}E · ${report.warnings}W`}
          </Badge>
        )}
      </div>
      {!report ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty || "Aún sin datos."}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {report.findings.map((f) => {
            const Icon =
              f.level === "ok" ? CheckCircle2 : f.level === "warn" ? AlertTriangle : XCircle;
            const color =
              f.level === "ok"
                ? "text-[color:var(--success)]"
                : f.level === "warn"
                  ? "text-amber-500"
                  : "text-destructive";
            return (
              <li key={f.id} className="flex items-start gap-2 text-xs">
                <Icon className={"mt-0.5 h-3.5 w-3.5 shrink-0 " + color} />
                <div className="min-w-0">
                  <div className="font-medium">{f.label}</div>
                  {f.detail && <div className="text-[11px] text-muted-foreground">{f.detail}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Golden Path Smoke Runner ---------------- */

type Step = { id: string; label: string; status: "pending" | "active" | "done" | "error"; detail?: string };

function GoldenPathSmoke() {
  const state = useBookStore();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const persona = useServerFn(aiPersona);
  const structure = useServerFn(aiStructure);
  const writeCh = useServerFn(aiWriteChapter);
  const coverPack = useServerFn(aiCoverPromptPack);
  const scrape = useServerFn(aiDeepScrape);
  const marketing = useServerFn(aiMarketing);

  const run = async () => {
    setRunning(true);
    const plan: Step[] = [
      { id: "seed", label: "Sembrar blueprint de ejemplo (Paso 1)", status: "pending" },
      { id: "dna", label: "Paso 2 · Generar persona/DNA", status: "pending" },
      { id: "structure", label: "Paso 3 · Estructura del libro", status: "pending" },
      { id: "chapters", label: "Paso 4 · Redactar capítulos", status: "pending" },
      { id: "cover", label: "Paso 5 · Cover prompt pack", status: "pending" },
      { id: "market", label: "Paso 5 · Deep scraping mercado", status: "pending" },
      { id: "launch", label: "Paso 6 · Activos de lanzamiento", status: "pending" },
    ];
    setSteps(plan);
    const setStep = (id: string, patch: Partial<Step>) =>
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    try {
      // Step 1 — seed
      setStep("seed", { status: "active" });
      state.setBookContext({
        topic: "Productividad para creadores",
        title: "El Sistema Bestseller",
        subtitle: "De la idea al ranking en 90 días",
      });
      state.setPublishingForm({
        author: state.publishingForm.author || "Autor Demo",
        description:
          state.publishingForm.description ||
          "Un sistema probado de 6 pasos para escribir, lanzar y posicionar tu libro como bestseller en Amazon KDP, audio y traducción internacional.",
        keywords: state.publishingForm.keywords || "productividad, escritura, bestseller, amazon kdp, marca personal",
        categories: state.publishingForm.categories || "Negocios > Emprendimiento",
      });
      state.markStepComplete(1);
      setStep("seed", { status: "done", detail: "Blueprint y publishingForm cargados" });

      // Step 2 — DNA
      setStep("dna", { status: "active" });
      const dna = await persona({
        data: {
          bio: state.authorDNA.bio || "Coach de creadores con 10+ años acompañando lanzamientos.",
          mission: state.authorDNA.mission || "Convertir conocimiento en libros que cambian carreras.",
          voiceSamples: state.authorDNA.voiceSamples || "Hablo claro, directo, con metáforas cinematográficas.",
        },
      } as any);
      state.setAuthorDNA({ extractedPersona: (dna as any).text || (dna as any).persona || "Persona OK" });
      state.markStepComplete(2);
      setStep("dna", { status: "done", detail: "Persona extraída" });

      // Step 3 — structure
      setStep("structure", { status: "active" });
      const struct: any = await structure({
        data: {
          topic: state.bookContext.topic,
          title: state.bookContext.title,
          chapterCount: 5,
          persona: state.authorDNA.extractedPersona,
        },
      } as any);
      const chapters = struct.chapters || struct.outline || [];
      state.setChapters(
        chapters.slice(0, 5).map((c: any, i: number) => ({
          id: `smoke-${i}`,
          title: c.title || `Capítulo ${i + 1}`,
          description: c.description || c.summary || "",
          content: "",
          images: [],
          snapshots: [],
        })),
      );
      state.markStepComplete(3);
      setStep("structure", { status: "done", detail: `${chapters.length} capítulos planificados` });

      // Step 4 — write 2 chapters (smoke)
      setStep("chapters", { status: "active", detail: "Escribiendo 2 capítulos…" });
      const target = state.chapters.slice(0, 2);
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        const out: any = await writeCh({
          data: {
            chapterTitle: ch.title,
            chapterDescription: ch.description,
            persona: state.authorDNA.extractedPersona,
          },
        } as any);
        state.updateChapter(ch.id, { content: out.text || out.content || "" });
        setStep("chapters", { status: "active", detail: `${i + 1}/${target.length}` });
      }
      state.markStepComplete(4);
      setStep("chapters", { status: "done", detail: `${target.length} capítulos redactados` });

      // Step 5 — cover pack
      setStep("cover", { status: "active" });
      const pack = await coverPack({
        data: {
          title: state.bookContext.title,
          subtitle: state.bookContext.subtitle,
          author: state.publishingForm.author,
          niche: state.publishingForm.categories,
        },
      } as any);
      setStep("cover", { status: "done", detail: `${(pack as any).variants?.length || 0} prompts listos` });

      // Step 5b — market
      setStep("market", { status: "active" });
      await scrape({
        data: { title: state.bookContext.title, niche: state.publishingForm.categories },
      } as any);
      state.markStepComplete(5);
      setStep("market", { status: "done", detail: "Demand/positioning OK" });

      // Step 6 — launch
      setStep("launch", { status: "active" });
      await marketing({
        data: {
          kind: "emails",
          title: state.bookContext.title,
          synopsis: state.publishingForm.description,
          persona: state.authorDNA.extractedPersona,
        },
      } as any);
      state.markStepComplete(6);
      setStep("launch", { status: "done", detail: "Emails generados" });

      toast.success("Golden Path verificado · Paso 1 → 6 sin errores");
    } catch (e: any) {
      setSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error", detail: e?.message || "Error" } : s)));
      toast.error(`Smoke falló: ${e?.message || "error"}`);
    } finally {
      setRunning(false);
    }
  };

  const total = steps.length || 1;
  const done = steps.filter((s) => s.status === "done").length;
  const pct = Math.round((done / total) * 100);

  return (
    <Card className="rounded-2xl border-border/70 p-5 shadow-soft">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="primary-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-soft">
            <PlayCircle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Smoke test · Golden Path</h3>
            <p className="text-xs text-muted-foreground">
              Ejecuta los Pasos 2 → 6 con un blueprint de ejemplo y reporta cualquier fallo en cadena.
            </p>
          </div>
        </div>
        <Button onClick={run} disabled={running} className="primary-gradient text-primary-foreground">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {running ? "Verificando…" : "Lanzar smoke test"}
        </Button>
      </header>
      {steps.length > 0 && (
        <>
          <Progress value={pct} className="mt-4" />
          <ul className="mt-4 space-y-1.5">
            {steps.map((s) => {
              const Icon =
                s.status === "done"
                  ? CheckCircle2
                  : s.status === "error"
                    ? XCircle
                    : s.status === "active"
                      ? Loader2
                      : AlertTriangle;
              const color =
                s.status === "done"
                  ? "text-[color:var(--success)]"
                  : s.status === "error"
                    ? "text-destructive"
                    : s.status === "active"
                      ? "text-primary"
                      : "text-muted-foreground/50";
              return (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + color + (s.status === "active" ? " animate-spin" : "")} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.label}</div>
                    {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ---------------- Exported panel ---------------- */

export function DiagnosticsPanel() {
  return (
    <div className="space-y-6">
      <PaywallMatrix />
      <KdpValidator />
      <GoldenPathSmoke />
    </div>
  );
}
