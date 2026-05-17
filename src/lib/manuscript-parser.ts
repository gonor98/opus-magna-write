/**
 * Client-side manuscript parsing: .txt, .md, .docx (via mammoth), basic .html.
 * PDF intentionally unsupported here to keep bundle small — UI tells the user.
 */
import mammoth from "mammoth";

export type ParsedManuscript = {
  name: string;
  text: string;     // markdown-ish
  words: number;
  warnings: string[];
};

const wordCountOf = (s: string) => s.split(/\s+/).filter(Boolean).length;

const htmlToMarkdown = (html: string): string =>
  html
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<strong[^>]*>|<b>/gi, "**")
    .replace(/<\/strong>|<\/b>/gi, "**")
    .replace(/<em[^>]*>|<i>/gi, "*")
    .replace(/<\/em>|<\/i>/gi, "*")
    .replace(/<blockquote[^>]*>/gi, "\n> ")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(p|li|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  s
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function parseManuscriptFile(file: File): Promise<ParsedManuscript> {
  const name = file.name;
  const lower = name.toLowerCase();
  const warnings: string[] = [];

  if (lower.endsWith(".txt") || file.type === "text/plain") {
    const text = sanitize(await file.text());
    return { name, text, words: wordCountOf(text), warnings };
  }

  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    const text = sanitize(await file.text());
    return { name, text, words: wordCountOf(text), warnings };
  }

  if (lower.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    const md = htmlToMarkdown(result.value);
    if (result.messages?.length) {
      warnings.push(...result.messages.slice(0, 3).map((m: { message: string }) => m.message));
    }
    return { name, text: sanitize(md), words: wordCountOf(md), warnings };
  }

  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    const raw = await file.text();
    const stripped = raw
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|h[1-6]|li|div|br)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<h1[^>]*>/gi, "# ")
      .replace(/<h2[^>]*>/gi, "## ")
      .replace(/<h3[^>]*>/gi, "### ")
      .replace(/<strong[^>]*>|<b>/gi, "**")
      .replace(/<\/strong>|<\/b>/gi, "**")
      .replace(/<em[^>]*>|<i>/gi, "*")
      .replace(/<\/em>|<\/i>/gi, "*")
      .replace(/<[^>]+>/g, "");
    const text = sanitize(raw.length > 0 ? stripped : "");
    return { name, text, words: wordCountOf(text), warnings };
  }

  if (lower.endsWith(".pdf")) {
    warnings.push("PDF no soportado en navegador — exporta el PDF a .docx o pega el texto.");
    return { name, text: "", words: 0, warnings };
  }

  // Fallback: try as text
  try {
    const text = sanitize(await file.text());
    return { name, text, words: wordCountOf(text), warnings: ["Formato desconocido, leído como texto plano."] };
  } catch (e: any) {
    return { name, text: "", words: 0, warnings: [`No se pudo leer: ${e.message}`] };
  }
}

export async function parseManuscriptFiles(files: File[]): Promise<ParsedManuscript[]> {
  const out: ParsedManuscript[] = [];
  for (const f of files) {
    out.push(await parseManuscriptFile(f));
  }
  return out;
}

export function mergeParsed(parts: ParsedManuscript[]): string {
  return parts
    .filter((p) => p.text)
    .map((p, i) => `<!-- archivo ${i + 1}: ${p.name} -->\n\n${p.text}`)
    .join("\n\n---\n\n");
}
