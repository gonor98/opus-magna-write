import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, generateObject } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const MODEL = "google/gemini-3-flash-preview";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

/* ---------- Author Voice Audit ----------
 * Returns a quantitative + qualitative report:
 *  - voiceMatch (0-100): how close the manuscript sounds to the author
 *  - aiLikelihood (0-100): how AI-ish the prose reads
 *  - readability, pacing, originality
 *  - itemized recommendations the UI can apply with 1 click
 */
export const aiAuditManuscript = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      content: z.string().min(50),
      authorBio: z.string().optional(),
      voiceSamples: z.string().optional(),
      persona: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: z.object({
        scores: z.object({
          voiceMatch: z.number().min(0).max(100),
          aiLikelihood: z.number().min(0).max(100),
          readability: z.number().min(0).max(100),
          pacing: z.number().min(0).max(100),
          originality: z.number().min(0).max(100),
          bestsellerPotential: z.number().min(0).max(100),
        }),
        verdict: z.string(),
        humanizationTips: z.array(z.string()).min(3).max(8),
        recommendations: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              why: z.string(),
              action: z.enum(["humanize", "rewrite", "expand", "shorten", "bestseller", "fact-check"]),
              targetSnippet: z.string().max(800).optional(),
              severity: z.enum(["low", "medium", "high"]),
            }),
          )
          .min(3)
          .max(10),
      }),
      prompt: `Actúa como Editor Jefe + Lingüista Forense de Penguin Random House.
Analiza el siguiente manuscrito y compáralo con el ADN del autor.

AUTOR — bio:
${data.authorBio || "(sin bio)"}

AUTOR — muestras de voz:
${data.voiceSamples || "(sin muestras)"}

AUTOR — biblia de voz:
${(data.persona || "").slice(0, 1500)}

MANUSCRITO:
"""
${data.content.slice(0, 12000)}
"""

Devuelve JSON con:
- scores.voiceMatch: % de coincidencia con la voz autoral (cadencia, vocabulario, arquetipos).
- scores.aiLikelihood: % de probabilidad de que el texto suene "a IA" (clichés, transiciones genéricas, listas, "en conclusión").
- scores.readability / pacing / originality / bestsellerPotential.
- verdict: 2-3 frases honestas tipo editor.
- humanizationTips: 3-8 técnicas concretas para "humanizar" y acercarlo al autor.
- recommendations: 3-10 acciones aplicables con UN clic; cada una con:
   * id estable
   * title (≤8 palabras)
   * why (justificación corta)
   * action: humanize | rewrite | expand | shorten | bestseller | fact-check
   * targetSnippet: párrafo o fragmento del manuscrito a transformar (máx 800 caracteres)
   * severity: low | medium | high.`,
    });
    return object;
  });

/* ---------- Humanize / Apply author DNA ----------
 * Rewrites a text fragment so it sounds like the author (less AI, less generic).
 */
export const aiHumanize = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(10),
      persona: z.string().optional(),
      voiceSamples: z.string().optional(),
      intensity: z.number().min(0).max(100).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const intensity = data.intensity ?? 75;
    const { text } = await generateText({
      model: gateway(MODEL),
      prompt: `Eres un ghostwriter de élite. Humaniza el siguiente texto y acércalo a la voz del autor.

VOZ AUTORAL:
${data.persona || "Voz cálida, autoritativa, ritmo conversacional."}

MUESTRAS:
${data.voiceSamples || ""}

INTENSIDAD DE HUMANIZACIÓN: ${intensity}/100 (mayor = más imperfecciones humanas, frases cortas, anécdotas, contracciones).

REGLAS:
1. Elimina marcadores típicos de IA: "en conclusión", "es importante destacar", "en el mundo actual", listas innecesarias, paralelismos forzados, abuso de tricolones.
2. Introduce ritmo variable: combina frases muy cortas con frases largas con incisos.
3. Incluye 1-2 detalles sensoriales o anécdotas implícitas si el texto es expositivo.
4. Mantén el mismo significado y la misma estructura de markdown (headings, listas).
5. Devuelve SOLO el texto reescrito.

TEXTO:
"""
${data.text.slice(0, 6000)}
"""`,
    });
    return { text };
  });

/* ---------- Split raw manuscript into chapters ----------
 * Takes a raw text dump (concatenated AI outputs, copy/pasted draft, etc.)
 * and proposes a chapter list with title + clean content.
 */
export const aiSplitIntoChapters = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      raw: z.string().min(200),
      targetChapters: z.number().min(3).max(40).optional(),
      topic: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const target = data.targetChapters ?? 0;
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: z.object({
        bookTitle: z.string().optional(),
        bookSubtitle: z.string().optional(),
        chapters: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
              content: z.string(),
            }),
          )
          .min(1),
      }),
      prompt: `Recibes un manuscrito CRUDO posiblemente generado con varias IAs (Gemini, Claude, GPT) o pegado a mano.
Tarea: detectar la estructura natural y devolver el libro listo para maquetar.

REGLAS:
- ${target ? `Divide en exactamente ${target} capítulos.` : "Detecta los capítulos por encabezados existentes (## / # / 'Capítulo X' / 'Chapter X'); si no hay, propone una división coherente entre 5 y 15 capítulos."}
- Limpia: elimina notas del modelo ("Aquí tienes…", "Espero que…"), repeticiones, headers duplicados.
- Conserva markdown semántico (## subtítulos, **negritas**, > citas, listas).
- Para cada capítulo: title (potente, ≤10 palabras), description (premisa en 1-2 frases), content (texto completo del capítulo en markdown).
${data.topic ? `- Tema declarado: "${data.topic}".` : ""}
- Si detectas título/subtítulo del libro, devuélvelos en bookTitle/bookSubtitle.

MANUSCRITO:
"""
${data.raw.slice(0, 30000)}
"""`,
    });
    return object;
  });
