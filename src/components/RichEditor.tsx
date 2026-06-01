/**
 * RichEditor — SSR-safe wrapper around TiptapEditor.
 * 'use client' equivalent: lazily mounts so Tiptap (window/document) never runs during SSR/prerender.
 */
import { useEffect, useState } from "react";
import { TiptapEditor, type InlineAction } from "@/components/TiptapEditor";

type Props = {
  markdown: string;
  onMarkdownChange: (md: string) => void;
  onInlineEdit?: (text: string, action: InlineAction) => Promise<string>;
  fontFamily?: string;
};

export function RichEditor(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-[60vh] animate-pulse rounded-xl bg-secondary/30" aria-busy="true" />
    );
  }

  return <TiptapEditor {...props} />;
}
