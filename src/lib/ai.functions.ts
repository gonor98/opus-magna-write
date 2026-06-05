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

/* ---------- Ikigai Blueprints (Step 1) ---------- */
export const aiGenerateBlueprints = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      passion: z.string().min(10),
      cvText: z.string().optional(),
      audioTranscript: z.string().optional(),
      publicPresence: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        blueprints: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              subtitle: z.string(),
              synopsis: z.string(),
              niche: z.string(),
              demandBadge: z.enum(["high", "medium", "niche"]),
              kdpScore: z.number().min(0).max(100),
              whyYou: z.string(),
            }),
          )
          .min(3)
          .max(5),
      }),
      prompt: `Eres el Motor Ikigai Literario de Opus Magna. Cruza el perfil del autor con la demanda del algoritmo A9 de Amazon KDP.

PERFIL DEL AUTOR:
Pasión/Profesión: ${data.passion}
${data.cvText ? `CV/Portafolio: ${data.cvText.slice(0, 1500)}` : ""}
${data.audioTranscript ? `Audio (transcripción): ${data.audioTranscript.slice(0, 800)}` : ""}
${data.publicPresence ? `Presencia pública: ${data.publicPresence.slice(0, 600)}` : ""}

TAREA: Genera 3 "Blueprints de Bestseller" personalizados. Cada uno DEBE:
- title: magnético, 4-8 palabras, evita clichés.
- subtitle: promesa comercial específica con número o resultado.
- synopsis: 2-3 frases en neuromarketing (dolor → solución → transformación).
- niche: subcategoría exacta de Amazon KDP (ej. "Self-Help > Personal Transformation").
- demandBadge: "high" si compite con bestsellers actuales, "medium" si nicho saturado, "niche" si océano azul.
- kdpScore: 0-100, viabilidad comercial real (no infles).
- whyYou: 1 frase que justifique por qué ESTE autor es la máxima autoridad.
- id: slug corto único (kebab-case).

Sé brutalmente honesto. No generes ideas genéricas.`,
    });
    return object;
  });

/* ---------- Digital Footprint (deep author research) ---------- */
export const aiDigitalFootprint = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(2),
      links: z.array(z.string().url()).max(8).optional(),
      context: z.string().max(2000).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        bio: z.string(),
        mission: z.string(),
        voiceSamples: z.string(),
        arquetipo: z.string(),
        vocabulario: z.array(z.string()).max(20),
        catchphrases: z.array(z.string()).max(10),
        platforms: z
          .array(z.object({ name: z.string(), url: z.string().optional(), insight: z.string() }))
          .max(8),
        themes: z.array(z.string()).max(10),
        confidenceScore: z.number().min(0).max(100),
      }),
      prompt: `Actúa como Investigador OSINT senior + Editor Jefe literario. Reconstruye la HUELLA DIGITAL de "${data.name}" para clonar su voz autoral.
${data.links?.length ? `Enlaces/perfiles: ${data.links.join(", ")}` : ""}
${data.context ? `Contexto extra: ${data.context}` : ""}

Devuelve dossier JSON con bio (5-7 frases), mission, voiceSamples (4-6 citas representativas), arquetipo narrativo, vocabulario (10-15 palabras recurrentes), catchphrases, platforms (LinkedIn/YouTube/X/blog/podcasts con insight), themes (5-8 obsesiones), confidenceScore 0-100.
Si el nombre es ambiguo o desconocido, baja confidenceScore y explícalo en bio. Sé brutalmente honesto, nada genérico.`,
    });
    return object;
  });

/* ---------- Deep Scraping: market + competition signals ---------- */
export const aiDeepScrape = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(2),
      subtitle: z.string().optional(),
      niche: z.string().min(2),
      synopsis: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        demandIndex: z.number().min(0).max(100),
        competitionIndex: z.number().min(0).max(100),
        priceSweetSpot: z.object({ digital: z.number(), physical: z.number() }),
        bsrEstimate: z.string(),
        keywords: z.array(z.string()).min(5).max(15),
        bisac: z.array(z.string()).min(2).max(5),
        competitors: z
          .array(
            z.object({
              title: z.string(),
              author: z.string(),
              reviewsApprox: z.number(),
              positioning: z.string(),
              gap: z.string(),
            }),
          )
          .min(3)
          .max(6),
        positioning: z.string(),
        hook: z.string(),
        risks: z.array(z.string()).max(5),
      }),
      prompt: `Actúa como Head of Research de Publisher Rocket + Helium 10 para Amazon KDP.
Investiga el mercado para:
Título: "${data.title}"
Subtítulo: "${data.subtitle || ""}"
Nicho: "${data.niche}"
Sinopsis: ${data.synopsis?.slice(0, 600) || "(n/a)"}

Devuelve reporte JSON realista con demandIndex/competitionIndex (0-100), priceSweetSpot {digital,physical} en USD, bsrEstimate (rango BSR mes 3), 8-12 keywords long-tail A9, rutas BISAC reales, 4-6 competidores (título, autor, ~reseñas, posicionamiento, GAP que dejan), positioning diferencial, hook de portada 6-10 palabras, 2-4 risks.
Sé específico. Nada genérico.`,
    });
    return object;
  });

/* ---------- Cover Engine: 4 variantes + back cover ---------- */
export const aiCoverPromptPack = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      niche: z.string().optional(),
      mood: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        variants: z
          .array(
            z.object({
              style: z.string(),
              prompt: z.string(),
              palette: z.array(z.string()).min(3).max(6),
            }),
          )
          .length(4),
        backCoverPrompt: z.string(),
      }),
      prompt: `Eres Director de Arte de Penguin/Stripe Press. Diseña 4 variantes de portada y un fondo de contraportada para:
Título: "${data.title}"
Subtítulo: "${data.subtitle || ""}"
Autor: "${data.author || ""}"
Nicho: "${data.niche || ""}"
Mood: "${data.mood || "premium internacional bestseller"}"

4 estilos DIFERENCIADOS:
1) "Minimalista editorial" — Stripe Press, tipografía dominante.
2) "Fotográfico cinemático" — imagen evocadora full-bleed.
3) "Abstracto simbólico" — gradiente/forma como metáfora.
4) "Tipográfico de impacto" — lettering grande tipo Penguin Modern.

Para cada uno: prompt detallado para imagen 3:4 (composición, paleta, textura, iluminación, tipografía). NO incluyas el texto del título en la imagen, el título se sobrepone después. Paleta en hex.
backCoverPrompt: fondo abstracto/textura sutil para contraportada que combine con los 4.`,
    });
    return object;
  });

/* ---------- Author 4K avatar prompt + image ---------- */
export const aiAuthorAvatarPrompt = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      bio: z.string().optional(),
      tone: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_TEXT_MODEL),
      prompt: `Genera UN solo prompt en inglés (90-130 palabras) para una FOTOGRAFÍA PROFESIONAL 4K de retrato editorial del autor "${data.name}".
Bio: ${(data.bio || "").slice(0, 600)}
Tono: ${data.tone || "warm authority, bestselling author headshot"}
Incluye: cámara (medium format), iluminación (Rembrandt suave), pose, vestuario (smart casual editorial), composición (3/4 retrato), fondo (gradiente neutro estudio), expresión, atmósfera. NO incluyas texto en la imagen. Devuelve SOLO el prompt, una sola línea.`,
    });
    return { prompt: text.trim() };
  });

/* ============================================================
   LIVE FOOTPRINT — Firecrawl search + scrape → real Author DNA
   Searches YouTube, articles, blogs, LinkedIn, X for the person
   ============================================================ */
export const aiLiveFootprint = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(2),
      context: z.string().max(2000).optional(),
      links: z.array(z.string().url()).max(8).optional(),
      depth: z.enum(["fast", "deep"]).default("fast"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const fcKey = process.env.FIRECRAWL_API_KEY;
    if (!fcKey) throw new Error("Missing FIRECRAWL_API_KEY. Conecta Firecrawl en Connectors.");
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey: fcKey });

    const queries = [
      `"${data.name}" interview youtube`,
      `"${data.name}" blog OR article writing`,
      `"${data.name}" linkedin about`,
      `"${data.name}" podcast transcript`,
      `"${data.name}" twitter OR x.com posts`,
    ];
    const perQuery = data.depth === "deep" ? 4 : 2;

    type Source = {
      url: string;
      title: string;
      kind: "youtube" | "linkedin" | "twitter" | "article" | "podcast" | "other";
      snippet: string;
      markdown?: string;
    };

    const kindOf = (u: string): Source["kind"] => {
      if (/youtube\.com|youtu\.be/i.test(u)) return "youtube";
      if (/linkedin\.com/i.test(u)) return "linkedin";
      if (/(twitter\.com|x\.com)/i.test(u)) return "twitter";
      if (/podcast|spotify|apple\.com\/.*podcast/i.test(u)) return "podcast";
      return "article";
    };

    const seen = new Set<string>();
    const sources: Source[] = [];

    // 1) live SEARCH
    await Promise.all(
      queries.map(async (q) => {
        try {
          const r: any = await fc.search(q, { limit: perQuery });
          const results: any[] = r?.web ?? r?.data ?? r?.results ?? [];
          for (const it of results) {
            const url = it.url || it.link;
            if (!url || seen.has(url)) continue;
            seen.add(url);
            sources.push({
              url,
              title: it.title || url,
              kind: kindOf(url),
              snippet: (it.description || it.snippet || "").slice(0, 400),
            });
          }
        } catch (e) {
          console.warn("[firecrawl search]", q, (e as Error)?.message);
        }
      }),
    );

    // 2) user-provided links jump to front
    for (const u of data.links || []) {
      if (!seen.has(u)) {
        seen.add(u);
        sources.unshift({ url: u, title: u, kind: kindOf(u), snippet: "(provided by user)" });
      }
    }

    // 3) SCRAPE top N to markdown for AI context
    const TOP = data.depth === "deep" ? 8 : 5;
    const toScrape = sources.slice(0, TOP);
    await Promise.all(
      toScrape.map(async (s) => {
        try {
          const r: any = await fc.scrape(s.url, {
            formats: ["markdown"],
            onlyMainContent: true,
          });
          const md: string = r?.markdown ?? r?.data?.markdown ?? "";
          s.markdown = md.slice(0, 6000);
        } catch (e) {
          console.warn("[firecrawl scrape]", s.url, (e as Error)?.message);
        }
      }),
    );

    // 4) AI synthesis → real DNA
    const corpus = toScrape
      .map(
        (s, i) =>
          `### Fuente ${i + 1} [${s.kind}] ${s.title}\nURL: ${s.url}\n${s.markdown || s.snippet}`,
      )
      .join("\n\n---\n\n")
      .slice(0, 35000);

    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_TEXT_MODEL),
      schema: z.object({
        bio: z.string(),
        mission: z.string(),
        voiceSamples: z.string(),
        arquetipo: z.string(),
        vocabulario: z.array(z.string()).max(20),
        catchphrases: z.array(z.string()).max(12),
        themes: z.array(z.string()).max(10),
        platforms: z
          .array(z.object({ name: z.string(), url: z.string().optional(), insight: z.string() }))
          .max(10),
        narrativeBeats: z.array(z.string()).max(8),
        forbiddenPhrases: z.array(z.string()).max(8),
        confidenceScore: z.number().min(0).max(100),
      }),
      prompt: `Eres OSINT senior + Editor Jefe literario. A partir del CORPUS REAL extraído de internet, reconstruye la HUELLA DIGITAL y la VOZ AUTORAL de "${data.name}".

Contexto extra: ${data.context || "(n/a)"}

CORPUS (fuentes vivas):
${corpus || "(sin corpus — usa razonamiento general y baja el confidenceScore)"}

Devuelve JSON: bio (5-7 frases sustanciosas con datos reales), mission, voiceSamples (4-6 citas o paráfrasis SACADAS del corpus, no inventes), arquetipo narrativo, vocabulario (10-15 palabras recurrentes), catchphrases reales, themes (5-8 obsesiones), platforms con insight por canal, narrativeBeats (estructura típica de sus piezas), forbiddenPhrases (clichés que JAMÁS usa), confidenceScore 0-100 calibrado al volumen y calidad del corpus.
Si el corpus es pobre, dilo en bio y baja confidence.`,
    });

    return {
      dossier: object,
      sources: sources.map((s) => ({ url: s.url, title: s.title, kind: s.kind, snippet: s.snippet })),
      scrapedCount: toScrape.filter((s) => s.markdown).length,
      totalFound: sources.length,
    };
  });

/* ============================================================
   SSML VALIDATION — pre-flight TTS/ACX checks
   ============================================================ */
export const aiValidateSSML = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ssml: z.string().min(1), chapterTitle: z.string().optional() }).parse)
  .handler(async ({ data }) => {
    const issues: { level: "error" | "warning" | "info"; code: string; message: string }[] = [];
    const s = data.ssml;
    if (!/<speak[\s>]/.test(s) || !/<\/speak>/.test(s))
      issues.push({ level: "error", code: "no_speak", message: "Falta envoltura <speak>…</speak>." });
    const opens = (s.match(/<break\b/g) || []).length;
    if (opens === 0) issues.push({ level: "warning", code: "no_breaks", message: "Sin <break/> — la narración sonará monótona." });
    if (opens > 400) issues.push({ level: "warning", code: "too_many_breaks", message: `Demasiados <break/> (${opens}).` });
    const len = s.length;
    if (len > 8000) issues.push({ level: "warning", code: "long_chunk", message: `SSML >8k chars (${len}). Divide para ACX.` });
    if (len < 400) issues.push({ level: "error", code: "too_short", message: "SSML demasiado corto (<400 chars)." });
    const prons = s.match(/\[PRON:[^\]]+\]/g) || [];
    const badPron = prons.filter((p) => !/\[PRON:[a-záéíóúñü .'-]+=[a-záéíóúñü .'-]+\]/i.test(p));
    if (badPron.length) issues.push({ level: "error", code: "bad_pron", message: `Marcas [PRON:…] mal formadas: ${badPron.length}.` });
    if (/<emphasis(?![^>]*level=)/.test(s))
      issues.push({ level: "info", code: "emphasis_default", message: "<emphasis> sin level explícito." });
    if (/[<>]/.test(s.replace(/<[^>]+>/g, "")))
      issues.push({ level: "error", code: "stray_brackets", message: "Caracteres < o > sueltos fuera de tags." });
    const balanceOK =
      (s.match(/<prosody\b/g) || []).length === (s.match(/<\/prosody>/g) || []).length &&
      (s.match(/<emphasis\b/g) || []).length === (s.match(/<\/emphasis>/g) || []).length;
    if (!balanceOK) issues.push({ level: "error", code: "unbalanced_tags", message: "Tags <prosody>/<emphasis> sin cerrar." });

    const errors = issues.filter((i) => i.level === "error").length;
    const warnings = issues.filter((i) => i.level === "warning").length;
    return {
      ok: errors === 0,
      score: Math.max(0, 100 - errors * 25 - warnings * 8),
      errors,
      warnings,
      issues,
      chapterTitle: data.chapterTitle || null,
      stats: { chars: len, breaks: opens, prons: prons.length },
    };
  });




