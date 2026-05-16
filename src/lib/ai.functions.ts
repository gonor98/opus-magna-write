import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, generateObject } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const DEFAULT_TEXT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY. Enable Lovable Cloud.");
  return createLovableAiGatewayProvider(key);
}

/* ---------- Plain text generation ---------- */
export const aiText = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(1),
      system: z.string().optional(),
      model: z.string().optional(),
      maxTokens: z.number().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(data.model || DEFAULT_TEXT_MODEL),
      system: data.system,
      prompt: data.prompt,
    });
    return { text };
  });

/* ---------- Title brainstorm ---------- */
export const aiTitleSuggestions = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      topic: z.string().min(1),
      authorBio: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        suggestions: z
          .array(
            z.object({
              title: z.string(),
              subtitle: z.string(),
              psychology: z.string(),
            }),
          )
          .length(5),
      }),
      prompt: `Eres experto en Copywriting y Naming de Bestsellers.
Tema del libro: "${data.topic}".
Bio del autor (resumen): "${(data.authorBio || "").slice(0, 400)}".
Genera 5 pares Título + Subtítulo magnéticos, comerciales y memorables.
Para cada uno explica brevemente la psicología que lo hace funcionar.`,
    });
    return object;
  });

/* ---------- Book structure ---------- */
export const aiStructure = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      topic: z.string().min(1),
      title: z.string().optional(),
      chapterCount: z.number().min(3).max(40),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        title: z.string(),
        subtitle: z.string(),
        chapters: z.array(z.object({ title: z.string(), description: z.string() })),
      }),
      prompt: `Crea el índice para un Bestseller sobre: "${data.topic}".
Título tentativo: "${data.title || ""}".
Devuelve EXACTAMENTE ${data.chapterCount} capítulos con título potente y descripción/premisa de 2-3 frases.`,
    });
    // Ensure exact count
    object.chapters = object.chapters.slice(0, data.chapterCount);
    return object;
  });

/* ---------- Persona extraction ---------- */
export const aiPersona = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      bio: z.string(),
      mission: z.string().optional(),
      voice: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Actúa como Editor Jefe de Penguin Random House. Analiza al autor y crea un 'Voice & Tone Bible' estructurado para ghostwriting.
Bio: ${data.bio}
Misión: ${data.mission || ""}
Muestras de voz: ${data.voice || ""}

Devuelve markdown con secciones: 1. ARQUETIPO DE VOZ, 2. RITMO, 3. VOCABULARIO, 4. PROHIBICIONES.`,
    });
    return { text };
  });

/* ---------- Author research (web grounded best-effort) ---------- */
export const aiResearchAuthor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(1) }).parse)
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        bio: z.string(),
        mission: z.string(),
        voiceSamples: z.string(),
      }),
      prompt: `Investiga y resume al autor/personaje público "${data.name}".
Devuelve JSON con:
- bio: 4-6 frases con hitos profesionales y estilo.
- mission: misión personal o profesional declarada.
- voiceSamples: 2-3 citas o frases representativas de su forma de hablar.`,
    });
    return object;
  });

/* ---------- Chapter writer ---------- */
export const aiWriteChapter = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      chapterTitle: z.string(),
      chapterDescription: z.string(),
      persona: z.string().optional(),
      bible: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Actúa como Ghostwriter de élite. Escribe el capítulo: "${data.chapterTitle}".
Premisa: ${data.chapterDescription}.
TONO Y VOZ: ${data.persona || "Voz autoral profesional, cálida, con autoridad."}
BIBLIA DE CONTINUIDAD: ${data.bible || "Inicio del libro."}

REGLAS:
1. SHOW, DON'T TELL.
2. Ritmo narrativo dinámico, frases de longitud variable.
3. Cero relleno (evita "en conclusión", "en resumen").
4. Voz activa.

ESTRUCTURA: GANCHO inicial → DESARROLLO con subtítulos en markdown ("## ...") y énfasis ("**...**") → CASOS / EJEMPLOS → CIERRE memorable.
Extensión: 1200-1800 palabras.`,
    });
    return { text };
  });

/* ---------- Inline edit ---------- */
export const aiInlineEdit = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(1),
      action: z.enum(["expand", "rewrite", "bestseller", "shorten"]),
      persona: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const map: Record<string, string> = {
      expand: "EXPANDE el siguiente texto añadiendo texturas sensoriales, detalles concretos y matices, manteniendo el sentido y la voz:",
      rewrite: "REESCRIBE el siguiente texto con voz activa, ritmo dinámico y prosa más afilada, sin cambiar el significado:",
      bestseller: "Transforma el siguiente texto en una CITA memorable, con cadencia poderosa, lista para destacar como pull-quote:",
      shorten: "ACORTA el siguiente texto a la mitad, conservando el impacto y la idea central:",
    };
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      system: data.persona ? `Voz autoral: ${data.persona}` : undefined,
      prompt: `${map[data.action]}\n\n"${data.text}"\n\nDevuelve SOLO el texto reescrito, sin comillas ni explicaciones.`,
    });
    return { text };
  });

/* ---------- Beta-reader / Editor critique ---------- */
export const aiBetaReader = createServerFn({ method: "POST" })
  .inputValidator(z.object({ content: z.string().min(50) }).parse)
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Actúa como Editor Senior de Penguin Random House: estricto pero brillante. Evalúa este capítulo en 3 secciones markdown:

## 🔥 El Gancho
¿Atrapa la atención? Sé honesto.

## 📉 Puntos ciegos
Partes confusas, aburridas o cliché.

## 🛠️ Sugerencia de oro
Una recomendación táctica de copywriting/storytelling para llevarlo a nivel bestseller.

Capítulo:
"""
${data.content.slice(0, 6000)}
"""`,
    });
    return { text };
  });

/* ---------- Fact check ---------- */
export const aiFactCheck = createServerFn({ method: "POST" })
  .inputValidator(z.object({ content: z.string().min(20) }).parse)
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Actúa como Auditor de Fact-Checking riguroso. Escanea el texto y enumera 3-5 afirmaciones verificables (datos, fechas, estadísticas, citas) clasificándolas como **✅ Consistente** o **⚠️ Requiere verificación** con una breve justificación.

Texto:
"""
${data.content}
"""`,
    });
    return { text };
  });

/* ---------- Marketing assets ---------- */
export const aiMarketing = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kind: z.enum(["emails", "social", "trailer"]),
      title: z.string(),
      synopsis: z.string().optional(),
      persona: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const prompts: Record<string, string> = {
      emails: `Escribe 3 correos de pre-venta para el libro "${data.title}" usando la fórmula PAS (Problema-Agitación-Solución). Tono: ${data.persona || "autoral"}. Sinopsis: ${data.synopsis || ""}. Devuelve markdown con asunto y cuerpo de cada email.`,
      social: `Crea 5 posts virales (Twitter/X / LinkedIn) para promocionar "${data.title}" usando AIDA. Cada uno con un gancho polarizante en la primera línea.`,
      trailer: `Escribe el guion de un Book Trailer de 60 segundos para "${data.title}". Formato: [CÁMARA / VISUAL] y [VOZ EN OFF].`,
    };
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: prompts[data.kind],
    });
    return { text };
  });

/* ---------- Market Oracle (trend discovery) ---------- */
export const aiMarketOracle = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      topic: z.string().optional(),
      authorBio: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        opportunities: z
          .array(
            z.object({
              niche: z.string(),
              demandScore: z.number().min(0).max(100),
              competitionScore: z.number().min(0).max(100),
              rationale: z.string(),
              keywords: z.array(z.string()).max(7),
              bisacCategory: z.string(),
            }),
          )
          .length(3),
      }),
      prompt: `Actúa como analista senior de Helium 10 + Keepa para Amazon KDP.
${data.topic ? `Tema/nicho del autor: "${data.topic}".` : ""}
${data.authorBio ? `Bio: "${data.authorBio.slice(0, 400)}".` : ""}
Devuelve 3 oportunidades de mercado de **alta demanda + baja competencia** en Amazon. Para cada una incluye:
- niche: nombre comercial atractivo del sub-nicho.
- demandScore (0-100), competitionScore (0-100) — la diferencia debe ser >35.
- rationale: por qué ahora (tendencia, gap, comportamiento del lector).
- keywords: 5-7 long-tail keywords reales para A9.
- bisacCategory: la ruta BISAC oculta más rentable.`,
    });
    return object;
  });

/* ---------- ACX audiobook script ---------- */
export const aiACXScript = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      content: z.string().min(50),
      chapterTitle: z.string(),
      persona: z.string().optional(),
      /** WPM target (default 155 — Audible sweet spot). */
      wpm: z.number().min(110).max(190).optional(),
      /** Max words per take/section so narrators can record without losing breath. */
      maxWordsPerTake: z.number().min(40).max(120).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const wpm = data.wpm ?? 155;
    const maxWords = data.maxWordsPerTake ?? 70;
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Adapta el siguiente capítulo a un **script ACX (Audible) profesional broadcast-ready** para narración.

REGLAS DURAS (no las violes):
- Encabeza el script con: "TÍTULO: ${data.chapterTitle}" y una línea "ESTIMADO: <minutos> min @ ${wpm} WPM" calculada a partir del conteo de palabras.
- Divide el capítulo en SECCIONES numeradas "## SECCIÓN N — <subtítulo breve>" cada **${maxWords} palabras máximo** (corte en frontera de frase). Cada sección lleva una línea "[DURACIÓN ~Xs]".
- Dentro de cada sección, separa cada párrafo del manuscrito en su propio bloque con sangría y línea en blanco antes/después.
- Marca pausas con [PAUSA: 0.5s], [PAUSA: 1s], [PAUSA: 2s] (literal, en segundos).
- Marca énfasis con *énfasis* en cursiva ACX y cambios de tono con [TONO: cálido|firme|reflexivo|íntimo|enérgico].
- Inserta [RESPIRA] al menos cada 90 palabras, idealmente al cierre de cada párrafo largo.
- Sustituye números y abreviaturas por su forma hablada ("USD 1.000" → "mil dólares", "2026" → "dos mil veintiséis", "etc." → "etcétera").
- Pronunciación: marca extranjerismos y nombres difíciles con [PRON: "fonética"].
- Cierra cada sección con "—FIN SECCIÓN N—" y el script entero con "—FIN DEL CAPÍTULO—".
- Mantén la voz autoral: ${data.persona || "cálida, autoritativa, ritmo conversacional con autoridad"}.
- NO añadas comentarios fuera de script. Devuelve SOLO el script listo para grabar.

Capítulo: "${data.chapterTitle}"
"""
${data.content.slice(0, 7000)}
"""`,
    });
    return { text };
  });


/* ---------- Translation preserving author DNA ---------- */
export const aiTranslate = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      content: z.string().min(20),
      targetLang: z.enum(["en", "zh", "fr", "pt", "de"]),
      persona: z.string().optional(),
      /** 0 = transcreación libre, 100 = literal */
      literalness: z.number().min(0).max(100).optional(),
      /** 0 = tono neutralizado, 100 = tono autoral 1:1 */
      tonePreservation: z.number().min(0).max(100).optional(),
      /** 0 = estilo simplificado, 100 = estilo, ritmo y figuras intactos */
      stylePreservation: z.number().min(0).max(100).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const langName: Record<string, string> = {
      en: "Inglés (mercado US/UK)",
      zh: "Mandarín simplificado (mercado China continental)",
      fr: "Francés (mercado FR/CA)",
      pt: "Portugués (mercado BR/PT)",
      de: "Alemán (mercado DACH)",
    };
    const lit = data.literalness ?? 30;
    const tone = data.tonePreservation ?? 85;
    const style = data.stylePreservation ?? 85;
    const litLabel = lit < 25 ? "muy libre / transcreación" : lit < 60 ? "equilibrada" : lit < 85 ? "fiel al original" : "casi literal";
    const toneLabel = tone < 30 ? "neutralizado" : tone < 70 ? "moderado" : "1:1 con el autor";
    const styleLabel = style < 30 ? "simplificado" : style < 70 ? "preservado" : "intacto (ritmo y figuras)";

    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Traduce el siguiente texto a ${langName[data.targetLang]}.

CONTROLES DE ADN AUTORAL (obligatorios):
- Literalidad: ${lit}/100 → ${litLabel}.
- Preservación de tono: ${tone}/100 → ${toneLabel}.
- Preservación de estilo: ${style}/100 → ${styleLabel}.

DIRECTIVAS:
1. ${lit < 60
        ? "No traduzcas literal: adapta modismos, ironía y referencias a equivalentes naturales en la cultura destino."
        : "Mantente cerca de la sintaxis y léxico original; adapta solo lo imprescindible."}
2. Voz autoral de referencia: ${data.persona || "voz cálida, autoritativa, ritmo conversacional"}.
3. Si una referencia cultural no transfiere, ${lit < 60 ? "reemplázala por una local del mismo registro" : "mantenla y añade un giro mínimo para comprensión"}.
4. **NO ROMPAS LA ESTRUCTURA**: conserva exactamente los encabezados markdown (#, ##, ###), negritas (**...**), cursivas (*...*), citas (>), listas (-, 1.), y los placeholders [ILUSTRACION:N]. Mantén el mismo número de párrafos.
5. ${data.targetLang === "zh" ? "Usa puntuación china completa（，。！？" : "Usa la puntuación nativa del idioma destino."}${data.targetLang === "zh" ? "” idioms 成语 cuando aporten densidad cultural)." : ""}

Texto fuente:
"""
${data.content.slice(0, 8000)}
"""

Devuelve SOLO el texto transcreado, sin notas del traductor.`,
    });
    return { text };
  });

/* ---------- Image generation ---------- */
export const aiImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(3),
      aspectRatio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: data.prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Image gen failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const images = json.choices?.[0]?.message?.images;
    const url = images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned by gateway.");
    return { dataUrl: url as string };
  });
