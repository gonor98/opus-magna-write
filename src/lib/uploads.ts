import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/cloud";

const BUCKET = "book-uploads";

export type UploadedAsset = {
  path: string;
  publicUrl: string;
  signedUrl?: string;
  name: string;
  size: number;
  contentType: string;
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);

/** Upload a single file under {deviceId}/{folder}/{ts}-{name}. Returns a signed URL (24h). */
export async function uploadAsset(file: File, folder: "manuscripts" | "covers" | "author" | "audio"): Promise<UploadedAsset> {
  const device = getDeviceId();
  const path = `${device}/${folder}/${Date.now()}-${slug(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signErr) throw signErr;

  return {
    path,
    publicUrl: signed.signedUrl,
    signedUrl: signed.signedUrl,
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  };
}

export async function deleteAsset(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** Read a file as DataURL (for in-browser previews and store persistence). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
