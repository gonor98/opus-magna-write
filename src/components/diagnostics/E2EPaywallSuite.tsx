import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { canUse, type Feature } from "@/lib/tier";
import { useBookStore, type UserTier } from "@/lib/store";

const FEATURES: { feature: Feature; label: string; surface: string }[] = [
  { feature: "editor.ai", label: "Editor AI actions", surface: "Step 4" },
  { feature: "cover.generate", label: "Cover generate", surface: "Step 5" },
  { feature: "cover.variants", label: "Cover variants", surface: "Step 5" },
  { feature: "export.pdf", label: "Export PDF", surface: "Step 5" },
  { feature: "export.docx", label: "Export DOCX", surface: "Step 5" },
  { feature: "export.epub", label: "Export EPUB", surface: "Step 5" },
  { feature: "export.acx", label: "Export ACX", surface: "Step 6" },
  { feature: "audit", label: "AI Audit", surface: "Step 4" },
  { feature: "translate", label: "Translate", surface: "Step 6" },
  { feature: "voice.clone", label: "Voice clone", surface: "Step 6" },
  { feature: "scrape.market", label: "Market scraping", surface: "Step 3" },
  { feature: "scrape.author", label: "Author scraping", surface: "Step 2" },
];
const TIERS: UserTier[] = ["FREE", "PRO", "PUBLISHER", "EMPIRE"];

type Result = { tier: UserTier; feature: Feature; allowed: boolean; expected: boolean; ok: boolean };

const EXPECTED: Record<Feature, Record<UserTier, boolean>> = {
  "editor.ai": { FREE: true, PRO: true, PUBLISHER: true, EMPIRE: true },
  "cover.generate": { FREE: false, PRO: true, PUBLISHER: true, EMPIRE: true },
  "cover.variants": { FREE: false, PRO: true, PUBLISHER: true, EMPIRE: true },
  "export.pdf": { FREE: true, PRO: true, PUBLISHER: true, EMPIRE: true },
  "export.docx": { FREE: false, PRO: true, PUBLISHER: true, EMPIRE: true },
  "export.epub": { FREE: false, PRO: false, PUBLISHER: true, EMPIRE: true },
  "export.acx": { FREE: false, PRO: false, PUBLISHER: true, EMPIRE: true },
  audit: { FREE: false, PRO: false, PUBLISHER: true, EMPIRE: true },
  translate: { FREE: false, PRO: false, PUBLISHER: false, EMPIRE: true },
  "voice.clone": { FREE: false, PRO: false, PUBLISHER: false, EMPIRE: true },
  "scrape.market": { FREE: false, PRO: true, PUBLISHER: true, EMPIRE: true },
  "scrape.author": { FREE: false, PRO: true, PUBLISHER: true, EMPIRE: true },
};

export function E2EPaywallSuite() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const setTier = useBookStore((s) => s.setUserTier);
  const originalTier = useBookStore((s) => s.userTier);

  const run = async () => {
    setRunning(true); setResults([]);
    const out: Result[] = [];
    for (const tier of TIERS) {
      setTier(tier);
      await new Promise((r) => setTimeout(r, 50));
      for (const { feature } of FEATURES) {
        const allowed = canUse(feature);
        const expected = EXPECTED[feature][tier];
        out.push({ tier, feature, allowed, expected, ok: allowed === expected });
      }
    }
    setTier(originalTier);
    setResults(out);
    setRunning(false);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `paywall-e2e-${Date.now()}.json`;
    a.click();
  };

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;

  return (
    <Card className="rounded-2xl border-border/70 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">E2E Paywall Suite</h3>
            <p className="text-sm text-muted-foreground">
              Itera 12 features × 4 tiers, compara contra el contrato esperado y reporta huecos.
            </p>
          </div>
        </div>
        <Badge variant="outline">{total > 0 ? `${passed}/${total} OK` : "Sin ejecutar"}</Badge>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
          Ejecutar suite ({TIERS.length * FEATURES.length} casos)
        </Button>
        <Button variant="outline" disabled={!results.length} onClick={downloadJSON}>Descargar JSON</Button>
      </div>

      {results.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60">
                <th className="px-2 py-1 text-left">Feature</th>
                {TIERS.map((t) => <th key={t} className="px-2 py-1 text-center">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(({ feature, label }) => (
                <tr key={feature} className="border-b border-border/40">
                  <td className="px-2 py-1 font-medium">{label}</td>
                  {TIERS.map((tier) => {
                    const r = results.find((x) => x.tier === tier && x.feature === feature);
                    if (!r) return <td key={tier} />;
                    return (
                      <td key={tier} className="px-2 py-1 text-center">
                        {r.ok ? (
                          <CheckCircle2 className={"inline h-4 w-4 " + (r.allowed ? "text-emerald-500" : "text-muted-foreground")} />
                        ) : (
                          <XCircle className="inline h-4 w-4 text-destructive" />
                        )}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {r.allowed ? "✓" : "✕"}{r.expected !== r.allowed ? "!" : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {passed < total && (
            <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              ⚠️ {total - passed} casos fallaron el contrato. Revisa tier.ts / EXPECTED matrix.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
