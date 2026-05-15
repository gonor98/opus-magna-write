import { supabase } from "@/integrations/supabase/client";
import type { State } from "@/lib/store";

const DEVICE_KEY = "opus-magna-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type CloudPayload = Pick<
  State,
  | "authorDNA"
  | "storyBible"
  | "bookContext"
  | "chapters"
  | "frontBackMatter"
  | "publishingForm"
  | "designConfig"
  | "launchKit"
  | "bookCover"
>;

const slugify = (s: string) =>
  (s || "proyecto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "proyecto";

export async function syncToCloud(payload: CloudPayload) {
  const device_id = getDeviceId();
  const slug = slugify(payload.bookContext.title);
  const { error, data } = await supabase
    .from("projects")
    .upsert(
      {
        device_id,
        slug,
        title: payload.bookContext.title || "Sin título",
        payload: payload as any,
      },
      { onConflict: "device_id,slug" },
    )
    .select("id, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listCloudProjects() {
  const device_id = getDeviceId();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, title, updated_at")
    .eq("device_id", device_id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadFromCloud(slug: string): Promise<CloudPayload | null> {
  const device_id = getDeviceId();
  const { data, error } = await supabase
    .from("projects")
    .select("payload")
    .eq("device_id", device_id)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as CloudPayload) || null;
}
