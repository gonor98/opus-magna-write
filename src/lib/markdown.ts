/**
 * Lightweight Markdown ↔ HTML converters used to bridge the Tiptap editor
 * (HTML-native) with the rest of the app, which stores chapter content
 * as Markdown so PDF/EPUB/DOCX exporters keep working unchanged.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineMd = (s: string) =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

/** Markdown → HTML for Tiptap initial content. */
export function mdToEditorHtml(md: string): string {
  if (!md) return "";
  const lines = md.split(/\n/);
  const html: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      html.push(`<p>${buf.join(" ")}</p>`);
      buf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      html.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flush();
      html.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flush();
      html.push(`<h1>${inlineMd(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      flush();
      html.push(`<blockquote><p>${inlineMd(line.slice(2))}</p></blockquote>`);
    } else if (/^[-*]\s+/.test(line)) {
      flush();
      // simple bullet runs: collect contiguous list items
      html.push(`<ul><li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li></ul>`);
    } else {
      buf.push(inlineMd(line));
    }
  }
  flush();
  return html.join("");
}

/** HTML (from Tiptap) → Markdown for persistence + export pipeline. */
export function editorHtmlToMd(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return "";

  const walk = (el: Node): string => {
    const out: string[] = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out.push(node.textContent || "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const e = node as HTMLElement;
      const tag = e.tagName.toLowerCase();
      const inner = walk(e);
      switch (tag) {
        case "p":
          out.push(inner.trim() + "\n\n");
          break;
        case "h1":
          out.push(`# ${inner.trim()}\n\n`);
          break;
        case "h2":
          out.push(`## ${inner.trim()}\n\n`);
          break;
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          out.push(`### ${inner.trim()}\n\n`);
          break;
        case "strong":
        case "b":
          out.push(`**${inner}**`);
          break;
        case "em":
        case "i":
          out.push(`*${inner}*`);
          break;
        case "br":
          out.push("\n");
          break;
        case "blockquote":
          out.push(
            inner
              .trim()
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((l) => `> ${l}`)
              .join("\n\n") + "\n\n",
          );
          break;
        case "ul":
        case "ol":
          out.push(inner);
          break;
        case "li":
          out.push(`- ${inner.trim()}\n`);
          break;
        case "code":
          out.push("`" + inner + "`");
          break;
        case "pre":
          out.push("```\n" + inner.trim() + "\n```\n\n");
          break;
        default:
          out.push(inner);
      }
    });
    return out.join("");
  };

  return walk(root).replace(/\n{3,}/g, "\n\n").trim();
}
