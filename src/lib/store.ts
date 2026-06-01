import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Snapshot = {
  timestamp: string;
  type: string;
  content: string;
};

export type Chapter = {
  id: string;
  title: string;
  description: string;
  content: string;
  images: string[];
  snapshots: Snapshot[];
};

export type AuthorDNA = {
  bio: string;
  mission: string;
  voiceSamples: string;
  extractedPersona: string;
  photoDataUrl?: string | null;
};

export type BookContext = {
  topic: string;
  title: string;
  subtitle: string;
};

export type FrontBackMatter = {
  dedication: string;
  prologue: string;
  epilogue: string;
  acknowledgments: string;
};

export type PublishingForm = {
  author: string;
  description: string;
  shortBio: string;
  keywords: string;
  categories: string;
  pricePhysical: number;
  priceDigital: number;
  isbn: string;
  bestsellerBlueprint: string;
};

export type DesignConfig = {
  font: "Lora" | "Crimson Pro" | "Merriweather" | "Montserrat";
  size: string;
  lineHeight: string;
  chapterTheme: "classic" | "modern" | "luxe";
};

export type AuditScores = {
  voiceMatch: number;
  aiLikelihood: number;
  readability: number;
  pacing: number;
  originality: number;
  bestsellerPotential: number;
};

export type AuditRecommendation = {
  id: string;
  title: string;
  why: string;
  action: "humanize" | "rewrite" | "expand" | "shorten" | "bestseller" | "fact-check";
  targetSnippet?: string;
  severity: "low" | "medium" | "high";
  applied?: boolean;
};

export type AuditReport = {
  scores: AuditScores;
  verdict: string;
  humanizationTips: string[];
  recommendations: AuditRecommendation[];
  generatedAt: string;
};

export type AssetRef = { path: string; signedUrl: string; name: string };

export type Assets = {
  backCover: string | null;       // dataURL preview
  manuscripts: AssetRef[];        // uploaded manuscript files
  acxScripts: Record<string, string>; // chapterId → ACX script (edited)
};

export type LaunchKit = { emails: string; social: string; trailer: string };

export type UserTier = "FREE" | "PRO" | "PUBLISHER" | "EMPIRE";

export type Blueprint = {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  niche: string;
  demandBadge: "high" | "medium" | "niche";
  kdpScore: number;
  whyYou: string;
};

export const GOLDEN_PATH_STEPS = [
  { id: 1, key: "ikigai", label: "Motor Ikigai", short: "Idea" },
  { id: 2, key: "dna", label: "ADN del autor", short: "ADN" },
  { id: 3, key: "matrix", label: "Bestseller Matrix", short: "Estructura" },
  { id: 4, key: "editor", label: "Editor Tiptap", short: "Escribir" },
  { id: 5, key: "design", label: "Diseño & Exportar", short: "Diseño" },
  { id: 6, key: "launch", label: "Launch & Marketing", short: "Launch" },
] as const;

type HistoryEntry = {
  label: string;
  chapters: Chapter[];
  bookContext: BookContext;
  frontBackMatter: FrontBackMatter;
  publishingForm: PublishingForm;
  bookCover: string | null;
};


export type State = {
  authorDNA: AuthorDNA;
  storyBible: string;
  bookContext: BookContext;
  chapters: Chapter[];
  activeChapterId: string | null;
  frontBackMatter: FrontBackMatter;
  publishingForm: PublishingForm;
  designConfig: DesignConfig;
  launchKit: LaunchKit;
  bookCover: string | null;

  // Golden Path & monetization
  currentStep: number;
  completedSteps: number[];
  userTier: UserTier;
  blueprints: Blueprint[];
  selectedBlueprintId: string | null;
  pricingOpen: boolean;

  // Undo/redo internals (not persisted)
  _past: HistoryEntry[];
  _future: HistoryEntry[];


  setAuthorDNA: (p: Partial<AuthorDNA>) => void;
  setStoryBible: (s: string) => void;
  setBookContext: (p: Partial<BookContext>) => void;
  setFrontBackMatter: (p: Partial<FrontBackMatter>) => void;
  setPublishingForm: (p: Partial<PublishingForm>) => void;
  setDesignConfig: (p: Partial<DesignConfig>) => void;
  setLaunchKit: (p: Partial<LaunchKit>) => void;
  setBookCover: (c: string | null) => void;

  setChapters: (chapters: Chapter[]) => void;
  addChapter: () => void;
  deleteChapter: (id: string) => void;
  moveChapter: (id: string, direction: -1 | 1) => void;
  updateChapter: (id: string, patch: Partial<Chapter>) => void;
  /** Replace chapter content with undo/redo support — use for AI overwrites */
  replaceChapterContent: (id: string, content: string, label?: string) => void;
  saveSnapshot: (id: string, type: string) => void;
  setActiveChapterId: (id: string | null) => void;

  pushHistory: (label: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  importProject: (data: Partial<State>) => void;
  resetAll: () => void;

  setStep: (n: number) => void;
  markStepComplete: (n: number) => void;
  setUserTier: (t: UserTier) => void;
  setBlueprints: (b: Blueprint[]) => void;
  selectBlueprint: (id: string) => void;
  setPricingOpen: (b: boolean) => void;
};


const uuid = () =>
  "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const HISTORY_LIMIT = 50;

const snapshotState = (s: State): HistoryEntry => ({
  label: "",
  chapters: s.chapters.map((c) => ({ ...c, images: [...c.images], snapshots: [...c.snapshots] })),
  bookContext: { ...s.bookContext },
  frontBackMatter: { ...s.frontBackMatter },
  publishingForm: { ...s.publishingForm },
  bookCover: s.bookCover,
});

const initial = {
  authorDNA: { bio: "", mission: "", voiceSamples: "", extractedPersona: "", photoDataUrl: null },
  storyBible: "",
  bookContext: { topic: "", title: "Título por definir", subtitle: "Añade un tema y genera la estructura" },
  chapters: [] as Chapter[],
  activeChapterId: null as string | null,
  frontBackMatter: { dedication: "", prologue: "", epilogue: "", acknowledgments: "" },
  publishingForm: {
    author: "",
    description: "",
    shortBio: "",
    keywords: "",
    categories: "",
    pricePhysical: 19.99,
    priceDigital: 9.99,
    isbn: "",
    bestsellerBlueprint: "",
  },
  designConfig: { font: "Lora" as const, size: "10.5pt", lineHeight: "1.55", chapterTheme: "classic" as const },
  launchKit: { emails: "", social: "", trailer: "" },
  bookCover: null as string | null,
  _past: [] as HistoryEntry[],
  _future: [] as HistoryEntry[],
};

export const useBookStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      setAuthorDNA: (p) => set((s) => ({ authorDNA: { ...s.authorDNA, ...p } })),
      setStoryBible: (s) => set({ storyBible: s }),
      setBookContext: (p) => set((s) => ({ bookContext: { ...s.bookContext, ...p } })),
      setFrontBackMatter: (p) => set((s) => ({ frontBackMatter: { ...s.frontBackMatter, ...p } })),
      setPublishingForm: (p) => set((s) => ({ publishingForm: { ...s.publishingForm, ...p } })),
      setDesignConfig: (p) => set((s) => ({ designConfig: { ...s.designConfig, ...p } })),
      setLaunchKit: (p) => set((s) => ({ launchKit: { ...s.launchKit, ...p } })),
      setBookCover: (c) => set({ bookCover: c }),

      setChapters: (chapters) => {
        get().pushHistory("Reordenar/restaurar capítulos");
        set({ chapters });
      },
      addChapter: () =>
        set((s) => ({
          chapters: [
            ...s.chapters,
            {
              id: uuid(),
              title: `Capítulo ${s.chapters.length + 1}`,
              description: "Premisa del nuevo capítulo…",
              content: "",
              images: [],
              snapshots: [],
            },
          ],
        })),
      deleteChapter: (id) => {
        get().pushHistory("Eliminar capítulo");
        set((s) => ({
          chapters: s.chapters.filter((c) => c.id !== id),
          activeChapterId: s.activeChapterId === id ? null : s.activeChapterId,
        }));
      },
      moveChapter: (id, direction) => {
        get().pushHistory("Mover capítulo");
        set((s) => {
          const idx = s.chapters.findIndex((c) => c.id === id);
          if (idx < 0) return s;
          const newIdx = idx + direction;
          if (newIdx < 0 || newIdx >= s.chapters.length) return s;
          const arr = [...s.chapters];
          const [item] = arr.splice(idx, 1);
          arr.splice(newIdx, 0, item);
          return { chapters: arr };
        });
      },
      updateChapter: (id, patch) =>
        set((s) => ({
          chapters: s.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      replaceChapterContent: (id, content, label = "Sobrescritura IA") => {
        get().pushHistory(label);
        set((s) => ({
          chapters: s.chapters.map((c) => (c.id === id ? { ...c, content } : c)),
        }));
      },
      saveSnapshot: (id, type) =>
        set((s) => {
          const chapters = s.chapters.map((c) => {
            if (c.id !== id || !c.content) return c;
            const last = c.snapshots[c.snapshots.length - 1];
            if (last && last.content === c.content) return c;
            const snap: Snapshot = {
              timestamp: new Date().toLocaleString(),
              type,
              content: c.content,
            };
            const snapshots = [...c.snapshots, snap].slice(-8);
            return { ...c, snapshots };
          });
          return { chapters };
        }),
      setActiveChapterId: (id) => set({ activeChapterId: id }),

      pushHistory: (label) =>
        set((s) => ({
          _past: [...s._past, { ...snapshotState(s), label }].slice(-HISTORY_LIMIT),
          _future: [],
        })),
      undo: () => {
        const s = get();
        const last = s._past[s._past.length - 1];
        if (!last) return null;
        const present: HistoryEntry = { ...snapshotState(s), label: last.label };
        set({
          _past: s._past.slice(0, -1),
          _future: [present, ...s._future].slice(0, HISTORY_LIMIT),
          chapters: last.chapters,
          bookContext: last.bookContext,
          frontBackMatter: last.frontBackMatter,
          publishingForm: last.publishingForm,
          bookCover: last.bookCover,
        });
        return last.label;
      },
      redo: () => {
        const s = get();
        const next = s._future[0];
        if (!next) return null;
        const present: HistoryEntry = { ...snapshotState(s), label: next.label };
        set({
          _future: s._future.slice(1),
          _past: [...s._past, present].slice(-HISTORY_LIMIT),
          chapters: next.chapters,
          bookContext: next.bookContext,
          frontBackMatter: next.frontBackMatter,
          publishingForm: next.publishingForm,
          bookCover: next.bookCover,
        });
        return next.label;
      },
      canUndo: () => get()._past.length > 0,
      canRedo: () => get()._future.length > 0,
      clearHistory: () => set({ _past: [], _future: [] }),

      importProject: (data) => set({ ...get(), ...data, _past: [], _future: [] }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: "opus-magna-studio-v1",
      partialize: (s) => {
        // Exclude undo/redo stacks from persistence (large + transient)
        const { _past, _future, ...rest } = s as any;
        return rest;
      },
    },
  ),
);

export const wordCount = (chapters: Chapter[]) =>
  chapters.reduce((acc, c) => (c.content ? acc + c.content.trim().split(/\s+/).filter(Boolean).length : acc), 0);

export const newUuid = uuid;
