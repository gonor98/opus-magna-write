import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthorDNATab } from "@/components/tabs/AuthorDNATab";
import { ManuscriptTab } from "@/components/tabs/ManuscriptTab";
import { MatterTab } from "@/components/tabs/MatterTab";
import { DesignTab } from "@/components/tabs/DesignTab";
import { MarketingTab } from "@/components/tabs/MarketingTab";
import { User, ScrollText, BookOpen, Palette, Megaphone } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Studio,
});

function Studio() {
  const [tab, setTab] = useState("dna");
  const [focus, setFocus] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {!focus && <Header focusMode={focus} setFocusMode={setFocus} />}

      <main className={"mx-auto px-6 py-8 " + (focus ? "max-w-4xl" : "max-w-[1400px]")}>
        {!focus && (
          <section className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-1 w-6 rounded-full bg-primary" /> Bestseller workspace
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Diseña, escribe y publica tu próximo{" "}
              <span className="bg-gradient-to-r from-primary to-[color:var(--ai)] bg-clip-text text-transparent">
                bestseller
              </span>{" "}
              con IA.
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Un estudio enterprise inspirado en Notion, Stripe y Vellum. Cada pestaña es una fase del proceso editorial,
              orquestada por Lovable AI.
            </p>
          </section>
        )}

        <Tabs value={focus ? "manuscript" : tab} onValueChange={setTab}>
          {!focus && (
            <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-2xl border border-border/70 bg-surface p-1.5 shadow-soft">
              <TabTrigger value="dna" icon={<User className="h-4 w-4" />} label="ADN del autor" />
              <TabTrigger value="manuscript" icon={<ScrollText className="h-4 w-4" />} label="Manuscrito" />
              <TabTrigger value="matter" icon={<BookOpen className="h-4 w-4" />} label="Front / Back matter" />
              <TabTrigger value="design" icon={<Palette className="h-4 w-4" />} label="Diseño & portada" />
              <TabTrigger value="marketing" icon={<Megaphone className="h-4 w-4" />} label="Marketing" />
            </TabsList>
          )}

          <TabsContent value="dna" className="animate-fade-in">
            <AuthorDNATab />
          </TabsContent>
          <TabsContent value="manuscript" className="animate-fade-in">
            <ManuscriptTab />
          </TabsContent>
          <TabsContent value="matter" className="animate-fade-in">
            <MatterTab />
          </TabsContent>
          <TabsContent value="design" className="animate-fade-in">
            <DesignTab />
          </TabsContent>
          <TabsContent value="marketing" className="animate-fade-in">
            <MarketingTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TabTrigger({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}
