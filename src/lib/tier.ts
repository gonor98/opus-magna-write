import { useBookStore, type UserTier } from "@/lib/store";
import { toast } from "sonner";

const ORDER: Record<UserTier, number> = { FREE: 0, PRO: 1, PUBLISHER: 2, EMPIRE: 3 };

export type Feature =
  | "editor.ai"
  | "cover.generate"
  | "cover.variants"
  | "export.pdf"
  | "export.docx"
  | "export.epub"
  | "export.acx"
  | "audit"
  | "translate"
  | "voice.clone"
  | "scrape.market"
  | "scrape.author";

const REQUIRED: Record<Feature, UserTier> = {
  "editor.ai": "FREE",
  "cover.generate": "PRO",
  "cover.variants": "PRO",
  "export.pdf": "FREE",
  "export.docx": "PRO",
  "export.epub": "PUBLISHER",
  "export.acx": "PUBLISHER",
  audit: "PUBLISHER",
  translate: "EMPIRE",
  "voice.clone": "EMPIRE",
  "scrape.market": "PRO",
  "scrape.author": "PRO",
};

export const featureTier = (f: Feature): UserTier => REQUIRED[f];

export const hasTier = (current: UserTier, min: UserTier) => ORDER[current] >= ORDER[min];

export function canUse(feature: Feature): boolean {
  const tier = useBookStore.getState().userTier;
  return hasTier(tier, REQUIRED[feature]);
}

/** Guard helper: returns true if allowed, otherwise opens pricing modal + toasts. */
export function requireFeature(feature: Feature, label?: string): boolean {
  if (canUse(feature)) return true;
  const needed = REQUIRED[feature];
  useBookStore.getState().setPricingOpen(true);
  toast.error(
    `🔒 ${label || "Esta acción"} requiere el plan ${needed}. Desbloquéalo para continuar.`,
  );
  return false;
}

export const tierLabel: Record<UserTier, string> = {
  FREE: "Gratis",
  PRO: "Pro",
  PUBLISHER: "Publisher",
  EMPIRE: "Empire",
};
