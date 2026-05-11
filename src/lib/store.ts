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
};

export type DesignConfig = {
  font: "Lora" | "Crimson Pro" | "Merriweather" | "Montserrat";
  size: string;
  lineHeight: string;
  chapterTheme: "classic" | "modern" | "luxe";
};

export type LaunchKit = { emails: string; social: string; trailer: string };

type State = {
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
  saveSnapshot: (id: string, type: string) => void;
  setActiveChapterId: (id: string | null) => void;

  importProject: (data: Partial<State>) => void;
  resetAll: () => void;
};

const uuid = () =>
  "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
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
  },
  designConfig: { font: "Lora" as const, size: "10.5pt", lineHeight: "1.55", chapterTheme: "classic" as const },
  launchKit: { emails: "", social: "", trailer: "" },
  bookCover: null as string | null,
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

      setChapters: (chapters) => set({ chapters }),
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
      deleteChapter: (id) =>
        set((s) => ({
          chapters: s.chapters.filter((c) => c.id !== id),
          activeChapterId: s.activeChapterId === id ? null : s.activeChapterId,
        })),
      moveChapter: (id, direction) =>
        set((s) => {
          const idx = s.chapters.findIndex((c) => c.id === id);
          if (idx < 0) return s;
          const newIdx = idx + direction;
          if (newIdx < 0 || newIdx >= s.chapters.length) return s;
          const arr = [...s.chapters];
          const [item] = arr.splice(idx, 1);
          arr.splice(newIdx, 0, item);
          return { chapters: arr };
        }),
      updateChapter: (id, patch) =>
        set((s) => ({
          chapters: s.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
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

      importProject: (data) => set({ ...get(), ...data }),
      resetAll: () => set(initial),
    }),
    {
      name: "opus-magna-studio-v1",
      // Don't persist images bytes inside chapters? They can be heavy but persisting is fine for now.
    },
  ),
);

export const wordCount = (chapters: Chapter[]) =>
  chapters.reduce((acc, c) => (c.content ? acc + c.content.trim().split(/\s+/).filter(Boolean).length : acc), 0);

export const newUuid = uuid;
