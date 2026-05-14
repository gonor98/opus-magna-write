import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Heading2, Heading3, Quote, List, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mdToEditorHtml, editorHtmlToMd } from "@/lib/markdown";

export type InlineAction = "expand" | "rewrite" | "bestseller" | "shorten";

type Props = {
  markdown: string;
  onMarkdownChange: (md: string) => void;
  onInlineEdit?: (text: string, action: InlineAction) => Promise<string>;
  fontFamily?: string;
};

export function TiptapEditor({ markdown, onMarkdownChange, onInlineEdit, fontFamily }: Props) {
  const lastEmitted = useRef<string>(markdown);
  const [busy, setBusy] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Empieza a escribir o usa la IA para redactar este capítulo…",
      }),
    ],
    content: mdToEditorHtml(markdown || ""),
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-neutral max-w-none min-h-[60vh] px-8 py-6 focus:outline-none leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      const md = editorHtmlToMd(editor.getHTML());
      lastEmitted.current = md;
      onMarkdownChange(md);
    },
  });

  // Reconcile external markdown changes (AI overwrites, undo/redo, chapter switch)
  useEffect(() => {
    if (!editor) return;
    if (markdown === lastEmitted.current) return;
    const html = mdToEditorHtml(markdown || "");
    editor.commands.setContent(html, { emitUpdate: false });
    lastEmitted.current = markdown;
  }, [markdown, editor]);

  if (!editor) {
    return <div className="min-h-[60vh] animate-pulse rounded-xl bg-secondary/30" />;
  }

  const runInline = async (action: InlineAction) => {
    if (!onInlineEdit) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const selected = editor.state.doc.textBetween(from, to, " ");
    if (!selected.trim()) return;
    setBusy(true);
    try {
      const replacement = await onInlineEdit(selected, action);
      editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={fontFamily ? { fontFamily } : undefined}>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, placement: "top" }}
        className="flex items-center gap-1 rounded-xl border border-border bg-popover p-1 shadow-elevated"
      >
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        {onInlineEdit && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            {(["expand", "rewrite", "bestseller", "shorten"] as InlineAction[]).map((a) => (
              <Button
                key={a}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] font-medium text-[color:var(--ai-foreground)]"
                disabled={busy}
                onClick={() => runInline(a)}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                {a === "expand" && "Expandir"}
                {a === "rewrite" && "Reescribir"}
                {a === "bestseller" && "Cita"}
                {a === "shorten" && "Acortar"}
              </Button>
            ))}
          </>
        )}
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-7 w-7 items-center justify-center rounded-md transition " +
        (active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}
