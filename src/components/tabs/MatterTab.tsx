import { useBookStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function MatterTab() {
  const { frontBackMatter, setFrontBackMatter } = useBookStore();
  const fields: { key: keyof typeof frontBackMatter; label: string; placeholder: string }[] = [
    { key: "dedication", label: "Dedicatoria", placeholder: "Para…" },
    { key: "prologue", label: "Prólogo", placeholder: "Una invitación al lector…" },
    { key: "epilogue", label: "Epílogo", placeholder: "El cierre que resuena…" },
    { key: "acknowledgments", label: "Agradecimientos", placeholder: "Gracias a…" },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {fields.map((f) => (
        <Card key={f.key} className="rounded-2xl border-border/70 p-6 shadow-soft animate-fade-in">
          <Label className="font-display text-lg font-semibold">{f.label}</Label>
          <Textarea
            rows={10}
            placeholder={f.placeholder}
            className="mt-3 font-serif text-[15px] leading-relaxed"
            value={frontBackMatter[f.key]}
            onChange={(e) => setFrontBackMatter({ [f.key]: e.target.value })}
          />
        </Card>
      ))}
    </div>
  );
}
