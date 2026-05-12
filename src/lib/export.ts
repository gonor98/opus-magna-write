import jsPDF from "jspdf";
import JSZip from "jszip";
import type {
  Chapter,
  BookContext,
  PublishingForm,
  FrontBackMatter,
  AuthorDNA,
} from "@/lib/store";

type ExportPayload = {
  bookContext: BookContext;
  publishingForm: PublishingForm;
  frontBackMatter: FrontBackMatter;
  chapters: Chapter[];
  authorDNA: AuthorDNA;
  bookCover: string | null;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Tiny markdown → plain text for PDF, and → HTML for EPUB
function mdToHtml(md: string, images: string[] = []) {
  if (!md) return "";
  const parts = md.split(/\[ILUSTRACION:(\d+)\]/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        const idx = parseInt(part);
        const url = images[idx];
        return url ? `<figure><img src="${url}" alt=""/></figure>` : "";
      }
      const lines = part.split(/\n/);
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
          html.push(`<h3>${inline(line.slice(4))}</h3>`);
        } else if (line.startsWith("## ")) {
          flush();
          html.push(`<h2>${inline(line.slice(3))}</h2>`);
        } else if (line.startsWith("# ")) {
          flush();
          html.push(`<h1>${inline(line.slice(2))}</h1>`);
        } else if (line.startsWith("> ")) {
          flush();
          html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
        } else {
          buf.push(inline(line));
        }
      }
      flush();
      return html.join("\n");
    })
    .join("\n");
}

function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function mdToPlain(md: string) {
  return (md || "")
    .replace(/\[ILUSTRACION:\d+\]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^>\s+/gm, "");
}

const slugify = (s: string) =>
  (s || "libro")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "libro";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

/* -------------------- PDF -------------------- */

export async function exportPDF(p: ExportPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const innerW = pageW - margin * 2;

  // Cover
  if (p.bookCover) {
    try {
      const { mime } = dataUrlToBytes(p.bookCover);
      const fmt = mime.includes("png") ? "PNG" : "JPEG";
      doc.addImage(p.bookCover, fmt, 0, 0, pageW, pageH);
    } catch {
      /* ignore */
    }
  } else {
    doc.setFillColor(28, 31, 64);
    doc.rect(0, 0, pageW, pageH, "F");
  }
  doc.addPage();

  // Title page
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 40);
  doc.text(p.bookContext.title || "Sin título", pageW / 2, pageH / 2 - 30, {
    align: "center",
    maxWidth: innerW,
  });
  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.text(p.bookContext.subtitle || "", pageW / 2, pageH / 2, {
    align: "center",
    maxWidth: innerW,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(p.publishingForm.author || "Autor", pageW / 2, pageH - margin * 2, {
    align: "center",
  });
  doc.addPage();

  const writeBlock = (title: string, body: string, opts?: { italic?: boolean }) => {
    if (!body && !title) return;
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 30);
    doc.text(title, margin, margin + 10, { maxWidth: innerW });
    doc.setFont("times", opts?.italic ? "italic" : "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 50);
    let y = margin + 50;
    const paragraphs = (body || "").split(/\n{2,}/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(mdToPlain(para), innerW) as string[];
      for (const ln of lines) {
        if (y > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(ln, margin, y);
        y += 16;
      }
      y += 8;
    }
    doc.addPage();
  };

  if (p.frontBackMatter.dedication)
    writeBlock("Dedicatoria", p.frontBackMatter.dedication, { italic: true });
  if (p.frontBackMatter.prologue)
    writeBlock("Prólogo", p.frontBackMatter.prologue);

  p.chapters.forEach((ch, i) => {
    writeBlock(`${i + 1}. ${ch.title}`, ch.content || ch.description);
  });

  if (p.frontBackMatter.epilogue) writeBlock("Epílogo", p.frontBackMatter.epilogue);
  if (p.frontBackMatter.acknowledgments)
    writeBlock("Agradecimientos", p.frontBackMatter.acknowledgments);
  if (p.publishingForm.shortBio || p.authorDNA.bio)
    writeBlock("Sobre el autor", p.publishingForm.shortBio || p.authorDNA.bio);

  doc.save(`${slugify(p.bookContext.title)}.pdf`);
}

/* -------------------- EPUB -------------------- */

export async function exportEPUB(p: ExportPayload) {
  const zip = new JSZip();
  const uid = `urn:uuid:${crypto.randomUUID?.() || Date.now().toString()}`;

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const css = `body{font-family:Georgia,serif;line-height:1.6;margin:1.2em;color:#1c1c28}
h1{font-size:2em;margin-top:2em;border-bottom:1px solid #ccc;padding-bottom:.4em}
h2{font-size:1.4em;margin-top:1.4em}
h3{font-size:1.15em}
p{text-align:justify;text-indent:1.4em;margin:.4em 0}
blockquote{font-style:italic;border-left:3px solid #888;margin:1em 0;padding:.4em 1em;color:#444}
img{max-width:100%;height:auto;display:block;margin:1em auto}
.title{text-align:center;margin-top:30%}
.title h1{font-size:2.4em;border:0}
.title .sub{font-style:italic;color:#555}
.title .author{margin-top:2em;letter-spacing:.2em;text-transform:uppercase;font-size:.9em}`;
  zip.file("OEBPS/styles.css", css);

  const items: { id: string; href: string; mime: string; spine?: boolean }[] = [];
  const addXhtml = (id: string, filename: string, body: string) => {
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"/><title>${escapeHtml(p.bookContext.title || "")}</title>
<link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>${body}</body></html>`;
    zip.file(`OEBPS/${filename}`, xhtml);
    items.push({ id, href: filename, mime: "application/xhtml+xml", spine: true });
  };

  // Cover image
  let coverHref: string | null = null;
  if (p.bookCover) {
    try {
      const { bytes, mime } = dataUrlToBytes(p.bookCover);
      const ext = mime.includes("png") ? "png" : "jpg";
      coverHref = `cover.${ext}`;
      zip.file(`OEBPS/${coverHref}`, bytes);
      items.push({ id: "cover-image", href: coverHref, mime });
      addXhtml(
        "cover",
        "cover.xhtml",
        `<div style="text-align:center;margin:0;padding:0"><img src="${coverHref}" alt="Portada"/></div>`,
      );
    } catch {
      /* ignore */
    }
  }

  // Title page
  addXhtml(
    "titlepage",
    "titlepage.xhtml",
    `<div class="title">
      <h1>${escapeHtml(p.bookContext.title || "")}</h1>
      <p class="sub">${escapeHtml(p.bookContext.subtitle || "")}</p>
      <p class="author">${escapeHtml(p.publishingForm.author || "")}</p>
    </div>`,
  );

  // Front matter
  const fm = p.frontBackMatter;
  if (fm.dedication)
    addXhtml(
      "dedication",
      "dedication.xhtml",
      `<h1>Dedicatoria</h1>${mdToHtml(fm.dedication)}`,
    );
  if (fm.prologue)
    addXhtml("prologue", "prologue.xhtml", `<h1>Prólogo</h1>${mdToHtml(fm.prologue)}`);

  // Chapter images
  p.chapters.forEach((ch, ci) => {
    (ch.images || []).forEach((url, ii) => {
      try {
        const { bytes, mime } = dataUrlToBytes(url);
        const ext = mime.includes("png") ? "png" : "jpg";
        const href = `img-${ci}-${ii}.${ext}`;
        zip.file(`OEBPS/${href}`, bytes);
        items.push({ id: `img-${ci}-${ii}`, href, mime });
      } catch {
        /* ignore */
      }
    });
  });

  // Chapters
  p.chapters.forEach((ch, i) => {
    // remap [ILUSTRACION:N] to actual file refs
    const html = mdToHtml(ch.content || "", ch.images).replace(
      /<img src="data:[^"]+"/g,
      (_m) => `<img src="img-${i}-0"`, // fallback (should be replaced below)
    );
    // Better mapping: rebuild with explicit indices
    const parts = (ch.content || "").split(/\[ILUSTRACION:(\d+)\]/);
    const rebuilt = parts
      .map((part, idx) => {
        if (idx % 2 === 1) {
          const imgIdx = parseInt(part);
          const url = ch.images?.[imgIdx];
          if (!url) return "";
          try {
            const { mime } = dataUrlToBytes(url);
            const ext = mime.includes("png") ? "png" : "jpg";
            return `<figure><img src="img-${i}-${imgIdx}.${ext}" alt=""/></figure>`;
          } catch {
            return "";
          }
        }
        return mdToHtml(part);
      })
      .join("\n");

    addXhtml(
      `chapter-${i}`,
      `chapter-${i}.xhtml`,
      `<h1>${escapeHtml(ch.title)}</h1>${rebuilt || html}`,
    );
  });

  if (fm.epilogue)
    addXhtml("epilogue", "epilogue.xhtml", `<h1>Epílogo</h1>${mdToHtml(fm.epilogue)}`);
  if (fm.acknowledgments)
    addXhtml(
      "acknowledgments",
      "acknowledgments.xhtml",
      `<h1>Agradecimientos</h1>${mdToHtml(fm.acknowledgments)}`,
    );
  const bio = p.publishingForm.shortBio || p.authorDNA.bio;
  if (bio) addXhtml("about", "about.xhtml", `<h1>Sobre el autor</h1>${mdToHtml(bio)}`);

  // Manifest + spine
  const manifestItems = items
    .map(
      (it) =>
        `<item id="${it.id}" href="${it.href}" media-type="${it.mime}"${
          it.id === "cover-image" ? ' properties="cover-image"' : ""
        }/>`,
    )
    .join("\n    ");
  const cssItem = `<item id="css" href="styles.css" media-type="text/css"/>`;
  const navItem = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`;
  const spine = items
    .filter((it) => it.spine)
    .map((it) => `<itemref idref="${it.id}"/>`)
    .join("\n    ");

  // nav.xhtml
  const navList = items
    .filter((it) => it.spine && it.id !== "cover")
    .map((it) => {
      const label =
        it.id === "titlepage"
          ? p.bookContext.title || "Portada"
          : it.id.startsWith("chapter-")
            ? p.chapters[parseInt(it.id.split("-")[1])]?.title || it.id
            : it.id.charAt(0).toUpperCase() + it.id.slice(1);
      return `<li><a href="${it.href}">${escapeHtml(label)}</a></li>`;
    })
    .join("\n      ");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>Índice</title></head>
<body><nav epub:type="toc"><h1>Índice</h1><ol>
      ${navList}
    </ol></nav></body></html>`,
  );

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeHtml(p.bookContext.title || "Sin título")}</dc:title>
    <dc:creator>${escapeHtml(p.publishingForm.author || "Autor")}</dc:creator>
    <dc:language>es</dc:language>
    <dc:description>${escapeHtml(p.publishingForm.description || "")}</dc:description>
    <dc:subject>${escapeHtml(p.publishingForm.keywords || "")}</dc:subject>
    <meta property="dcterms:modified">${new Date().toISOString().split(".")[0]}Z</meta>
    ${coverHref ? `<meta name="cover" content="cover-image"/>` : ""}
  </metadata>
  <manifest>
    ${cssItem}
    ${navItem}
    ${manifestItems}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opf);

  const blob = await zip.generateAsync({ mimeType: "application/epub+zip", type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(p.bookContext.title)}.epub`;
  a.click();
  URL.revokeObjectURL(url);
}
