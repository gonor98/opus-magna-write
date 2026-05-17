/**
 * Client-side utilities for ACX scripts:
 * - parseACX(): splits a script into editable sections with markers preserved.
 * - validateACXChapter(): returns a checklist of pass/fail items.
 * - acxToSSML(): converts an ACX script to broadcast-quality SSML for any TTS engine.
 * - cleanForTTS(): strips ACX markers for plain TTS preview.
 */

export type ACXSection = {
  index: number;
  heading: string;          // "SECCIÓN 1 — ..." (without leading ##)
  duration?: string;        // "[DURACIÓN ~Xs]"
  body: string;             // editable raw body with markers preserved
};

export type ACXChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type ACXReport = {
  ok: boolean;
  sectionCount: number;
  totalWords: number;
  estMinutes: number;
  items: ACXChecklistItem[];
  perSection: { index: number; words: number; hasBreath: boolean; hasPause: boolean; ok: boolean }[];
};

const SECTION_RE = /^##\s+SECCI[ÓO]N\s+(\d+)\s*[—\-]\s*(.+)$/im;
const SECTION_SPLIT = /^##\s+SECCI[ÓO]N\s+/im;

/** Word count ignoring ACX markers and markdown noise. */
export function countSpokenWords(text: string): number {
  const clean = text
    .replace(/\[PAUSA:[^\]]+\]/gi, " ")
    .replace(/\[RESPIRA\]/gi, " ")
    .replace(/\[TONO:[^\]]+\]/gi, " ")
    .replace(/\[PRON:\s*"[^"]+"\]/gi, " ")
    .replace(/\[DURACI[ÓO]N[^\]]+\]/gi, " ")
    .replace(/—FIN[^—\n]*—/g, " ")
    .replace(/^##\s+SECCI[ÓO]N[^\n]+$/gim, " ")
    .replace(/^T[ÍI]TULO:[^\n]+$/gim, " ")
    .replace(/^ESTIMADO:[^\n]+$/gim, " ")
    .replace(/[*_>#`]/g, " ");
  return clean.split(/\s+/).filter(Boolean).length;
}

/** Split an ACX script into editable sections. */
export function parseACX(script: string): { header: string; sections: ACXSection[]; footer: string } {
  if (!script) return { header: "", sections: [], footer: "" };
  // Find header before first SECCIÓN
  const firstMatch = script.search(SECTION_SPLIT);
  const header = firstMatch > 0 ? script.slice(0, firstMatch).trimEnd() : firstMatch === 0 ? "" : script;
  const rest = firstMatch >= 0 ? script.slice(firstMatch) : "";
  if (!rest) return { header, sections: [], footer: "" };

  // Split on each "## SECCIÓN N" while keeping the heading line
  const chunks = rest.split(/(?=^##\s+SECCI[ÓO]N\s+)/im).filter(Boolean);
  const sections: ACXSection[] = [];
  let footer = "";

  chunks.forEach((chunk, i) => {
    const headingMatch = chunk.match(SECTION_RE);
    if (!headingMatch) return;
    const idx = parseInt(headingMatch[1]) || i + 1;
    const headingLine = chunk.split("\n", 1)[0];
    let body = chunk.slice(headingLine.length).replace(/^\n+/, "");
    let duration: string | undefined;
    const durMatch = body.match(/\[DURACI[ÓO]N[^\]]+\]/);
    if (durMatch) duration = durMatch[0];
    // Extract trailing footer ("—FIN DEL CAPÍTULO—") from the last section
    if (i === chunks.length - 1) {
      const fm = body.match(/—FIN DEL CAP[IÍ]TULO—/);
      if (fm) {
        footer = body.slice(fm.index!).trim();
        body = body.slice(0, fm.index).trimEnd();
      }
    }
    sections.push({
      index: idx,
      heading: headingLine.replace(/^##\s+/, "").trim(),
      duration,
      body: body.trimEnd(),
    });
  });

  return { header: header.trim(), sections, footer };
}

/** Re-serialize parsed sections back into a single ACX script string. */
export function serializeACX(parts: { header: string; sections: ACXSection[]; footer: string }): string {
  const head = parts.header ? parts.header + "\n\n" : "";
  const body = parts.sections
    .map((s) => `## ${s.heading}\n${s.body.trim()}\n—FIN SECCIÓN ${s.index}—`)
    .join("\n\n");
  const foot = parts.footer ? `\n\n${parts.footer}` : "\n\n—FIN DEL CAPÍTULO—";
  return head + body + foot;
}

/** Validate an ACX chapter against broadcast-ready rules. */
export function validateACXChapter(script: string, opts?: { maxWordsPerTake?: number; wpm?: number }): ACXReport {
  const max = opts?.maxWordsPerTake ?? 70;
  const wpm = opts?.wpm ?? 155;
  const parsed = parseACX(script);

  const hasHeader = /T[ÍI]TULO:/i.test(parsed.header) && /ESTIMADO:/i.test(parsed.header);
  const hasFooter = /—FIN DEL CAP[IÍ]TULO—/.test(parsed.footer || script);

  const perSection = parsed.sections.map((s) => {
    const words = countSpokenWords(s.body);
    const hasBreath = /\[RESPIRA\]/i.test(s.body);
    const hasPause = /\[PAUSA:[^\]]+\]/i.test(s.body);
    const ok = words <= max + 10 && hasBreath && hasPause; // tolerate +10 jitter
    return { index: s.index, words, hasBreath, hasPause, ok };
  });

  const totalWords = perSection.reduce((a, b) => a + b.words, 0);
  const estMinutes = +(totalWords / wpm).toFixed(2);

  const overLong = perSection.filter((s) => s.words > max + 10);
  const missingBreath = perSection.filter((s) => !s.hasBreath);
  const missingPause = perSection.filter((s) => !s.hasPause);

  const items: ACXChecklistItem[] = [
    {
      id: "header",
      label: "Cabecera con TÍTULO y ESTIMADO",
      ok: hasHeader,
      detail: hasHeader ? undefined : "Añade «TÍTULO: …» y «ESTIMADO: X min @ 155 WPM» al inicio.",
    },
    {
      id: "sections",
      label: "Secciones numeradas «## SECCIÓN N»",
      ok: parsed.sections.length > 0,
      detail: parsed.sections.length === 0 ? "No se detectaron secciones." : `${parsed.sections.length} secciones detectadas.`,
    },
    {
      id: "length",
      label: `≤ ${max} palabras por toma`,
      ok: overLong.length === 0,
      detail: overLong.length ? `Excede en secciones: ${overLong.map((s) => `#${s.index} (${s.words}w)`).join(", ")}` : undefined,
    },
    {
      id: "pauses",
      label: "Pausas [PAUSA: Xs] en cada sección",
      ok: missingPause.length === 0,
      detail: missingPause.length ? `Sin pausa en secciones: ${missingPause.map((s) => "#" + s.index).join(", ")}` : undefined,
    },
    {
      id: "breath",
      label: "Marcas [RESPIRA] cada ~90 palabras",
      ok: missingBreath.length === 0,
      detail: missingBreath.length ? `Sin [RESPIRA] en secciones: ${missingBreath.map((s) => "#" + s.index).join(", ")}` : undefined,
    },
    {
      id: "footer",
      label: "Cierre «—FIN DEL CAPÍTULO—»",
      ok: hasFooter,
      detail: hasFooter ? undefined : "Añade el cierre estándar al final.",
    },
  ];

  return {
    ok: items.every((i) => i.ok),
    sectionCount: parsed.sections.length,
    totalWords,
    estMinutes,
    items,
    perSection,
  };
}

const XML_ESC = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Convert an ACX script to SSML 1.1, mapping markers to <break>, <emphasis>, <prosody>, <phoneme>. */
export function acxToSSML(script: string, opts?: { voice?: string; lang?: string }): string {
  const lang = opts?.lang ?? "es-ES";
  const voice = opts?.voice ?? "Mi Voz Autor";
  const parsed = parseACX(script);

  const renderBody = (body: string): string => {
    let out = body;
    // Strip non-spoken markers
    out = out.replace(/\[DURACI[ÓO]N[^\]]+\]/gi, "");
    out = out.replace(/—FIN SECCI[ÓO]N \d+—/gi, "");
    // Convert markers BEFORE escaping
    // Use placeholders to survive XML escaping
    const PH = {
      pause: (s: string) => `\u0001PAUSE:${s}\u0001`,
      breath: () => `\u0001BREATH\u0001`,
      tone: (t: string) => `\u0001TONE_OPEN:${t}\u0001`,
      toneClose: () => `\u0001TONE_CLOSE\u0001`,
      pron: (w: string, p: string) => `\u0001PRON:${w}::${p}\u0001`,
      em: (t: string) => `\u0001EM_OPEN\u0001${t}\u0001EM_CLOSE\u0001`,
    };

    out = out.replace(/\[PAUSA:\s*([0-9.]+)s\]/gi, (_, s) => PH.pause(s));
    out = out.replace(/\[RESPIRA\]/gi, () => PH.breath());
    out = out.replace(/\[PRON:\s*"([^"]+)"\]\s*([^\s\.,;:!\?]+)?/gi, (_, p, w) => PH.pron(w || "", p));
    // [TONO: x] applies until the next [TONO:…] or end of paragraph
    out = out.replace(/\[TONO:\s*([^\]]+)\]/gi, (_, t) => PH.tone(String(t).trim()));
    // *emphasis*
    out = out.replace(/\*([^*\n]+)\*/g, (_, t) => PH.em(t));

    // Escape remaining text
    out = XML_ESC(out);

    // Replace placeholders with SSML tags
    out = out.replace(/\u0001PAUSE:([^\u0001]+)\u0001/g, (_, s) => `<break time="${s}s"/>`);
    out = out.replace(/\u0001BREATH\u0001/g, `<break strength="medium"/><amazon:effect name="breath"/> `);
    out = out.replace(/\u0001PRON:([^:]*)::([^\u0001]+)\u0001/g, (_, w, p) => {
      if (!w) return "";
      return `<phoneme alphabet="ipa" ph="${XML_ESC(p)}">${XML_ESC(w)}</phoneme>`;
    });
    // Tone: open prosody at marker, close at next tone or end of paragraph
    // Insert close before each subsequent open and at paragraph end
    const toneMap: Record<string, { rate: string; pitch: string }> = {
      cálido: { rate: "95%", pitch: "-2%" },
      calido: { rate: "95%", pitch: "-2%" },
      firme: { rate: "100%", pitch: "+0%" },
      reflexivo: { rate: "90%", pitch: "-3%" },
      íntimo: { rate: "88%", pitch: "-4%" },
      intimo: { rate: "88%", pitch: "-4%" },
      enérgico: { rate: "108%", pitch: "+3%" },
      energico: { rate: "108%", pitch: "+3%" },
    };
    // Process tone markers paragraph by paragraph
    const paragraphs = out.split(/\n{2,}/).map((p) => {
      let open = false;
      let result = p.replace(/\u0001TONE_OPEN:([^\u0001]+)\u0001/g, (_, t) => {
        const key = String(t).toLowerCase().trim();
        const cfg = toneMap[key] || { rate: "100%", pitch: "+0%" };
        const prefix = open ? `</prosody>` : "";
        open = true;
        return `${prefix}<prosody rate="${cfg.rate}" pitch="${cfg.pitch}">`;
      });
      if (open) result += "</prosody>";
      return result;
    });
    out = paragraphs.join("\n\n");

    out = out.replace(/\u0001EM_OPEN\u0001/g, `<emphasis level="moderate">`);
    out = out.replace(/\u0001EM_CLOSE\u0001/g, `</emphasis>`);

    // Convert double newlines to <p>, single newlines to <break>
    const paras = out
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<break time="0.3s"/> ').trim()}</p>`)
      .join("\n");
    return paras;
  };

  const headerSafe = XML_ESC(parsed.header || "");
  const sectionsXml = parsed.sections
    .map(
      (s) => `  <p><emphasis level="strong">${XML_ESC(s.heading)}</emphasis></p>
${renderBody(s.body)}
  <break time="1.5s"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">
  <!-- Voice: ${XML_ESC(voice)} -->
  <!-- ${headerSafe || ""} -->
${sectionsXml}
</speak>
`;
}

export function cleanForTTS(script: string): string {
  return script
    .replace(/\[PAUSA:\s*([0-9.]+)s\]/gi, ", ")
    .replace(/\[RESPIRA\]/gi, " … ")
    .replace(/\[TONO:[^\]]+\]/gi, "")
    .replace(/\[PRON:\s*"([^"]+)"\]/gi, "$1")
    .replace(/\[DURACI[ÓO]N[^\]]+\]/gi, "")
    .replace(/—FIN[^—\n]*—/g, "")
    .replace(/^##\s+SECCI[ÓO]N[^\n]+/gim, "")
    .replace(/^T[ÍI]TULO:[^\n]+\n?/gm, "")
    .replace(/^ESTIMADO:[^\n]+\n?/gm, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
