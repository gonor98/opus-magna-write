import { useBookStore, newUuid } from "@/lib/store";

const DEMO_FLAG = "opus-magna-demo-seeded-v1";

export function maybeSeedDemo() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(DEMO_FLAG)) return;

  const s = useBookStore.getState();
  // Only seed if the project is genuinely empty
  if (s.chapters.length > 0 || s.bookContext.topic || s.authorDNA.bio) {
    localStorage.setItem(DEMO_FLAG, "1");
    return;
  }

  const mk = (title: string, description: string, content = "") => ({
    id: newUuid(),
    title,
    description,
    content,
    images: [] as string[],
    snapshots: [] as { timestamp: string; type: string; content: string }[],
  });

  useBookStore.setState({
    authorDNA: {
      bio: "Elena Marín, ex-consultora de McKinsey reconvertida en autora best-seller. 10 años acompañando a CEOs en transiciones de carrera.",
      mission:
        "Ayudar a profesionales de élite a reinventarse con propósito, sin sacrificar su estatus.",
      voiceSamples:
        "Mi voz es serena, precisa, ligeramente provocadora. Uso metáforas de arquitectura y cocina. Frases cortas para rematar.",
      extractedPersona:
        "Voz cálida pero quirúrgica. Ritmo: pares de frases largas seguidas de un golpe corto. Vocabulario: arquitectura, química, oficios artesanos. Sin clichés motivacionales. Cita a Stoicos y a diseñadores nórdicos. Cero anglicismos innecesarios.",
      photoDataUrl: null,
    },
    storyBible:
      "Tesis: la reinvención profesional no es un salto, es una secuencia de pequeños giros gobernados. El lector ideal: directivo de 35-55 años, financieramente estable, espiritualmente inquieto.",
    bookContext: {
      topic:
        "Reinvención profesional para directivos en la mitad de la vida, sin perder estatus ni propósito.",
      title: "El Tercer Acto",
      subtitle: "Un manual estoico para reinventar tu carrera después de los 40",
    },
    chapters: [
      mk(
        "El espejismo de la cima",
        "Por qué el éxito convencional se siente vacío justo cuando lo alcanzas.",
        `## El espejismo de la cima\n\nLlegaste. El despacho con vistas, el puesto que perseguiste durante quince años, el reconocimiento. Y sin embargo, una mañana de martes, frente al espejo, una pregunta incómoda se cuela: *¿esto era todo?*\n\nNo es ingratitud. Es **información**. Es tu sistema operativo avisándote de que el mapa que usaste para llegar hasta aquí no sirve para el siguiente tramo.\n\n> El éxito que no se renueva, se pudre.\n\nEn este capítulo desmontaremos tres mitos que nos vendieron sobre la cima profesional, y empezaremos a redibujar las coordenadas de tu próximo acto.`,
      ),
      mk(
        "Auditoría silenciosa",
        "Un protocolo de 7 días para diagnosticar qué partes de tu vida profesional siguen vivas y cuáles solo respiran por inercia.",
        `## Auditoría silenciosa\n\nAntes de reinventar, **escucha**. La mayoría de transiciones fallidas empiezan por actuar demasiado rápido sobre datos demasiado pobres.\n\n### El protocolo de 7 días\n\n1. Día 1-2: registra cada hora de tu jornada y el nivel de energía al terminarla.\n2. Día 3-4: identifica las tres tareas que te dejaron en estado de *flow*.\n3. Día 5-6: detecta los rituales que sobreviven solo por costumbre.\n4. Día 7: redacta tu *acta de auditoría* en una hoja A4.\n\nNo es un ejercicio de productividad. Es **arqueología emocional aplicada**.`,
      ),
      mk(
        "El portafolio de identidades",
        "Cómo dejar de ser solo tu cargo y construir un portafolio de roles que te haga antifrágil.",
      ),
      mk(
        "Capital silencioso",
        "Las cinco formas de capital invisible (red, reputación, salud, atención, narrativa) y cómo invertir cada una.",
      ),
      mk(
        "El método del giro pequeño",
        "Por qué los pivotes radicales fracasan y cómo diseñar microtransiciones de 90 días.",
      ),
      mk(
        "Diseñar tu segundo oficio",
        "Del CV al portafolio: cómo articular un oficio nuevo sin parecer un aficionado.",
      ),
      mk(
        "La economía del legado",
        "Cómo monetizar tu experiencia sin caer en el ruido del coaching genérico.",
      ),
      mk(
        "Tercer acto",
        "Manifiesto final: una vida profesional construida como una sinfonía en tres movimientos.",
      ),
    ],
    activeChapterId: null,
    frontBackMatter: {
      dedication: "A los que tuvieron el valor de dejar de pretender.",
      prologue:
        "Este libro nació en una sobremesa de domingo, con tres directivos que me confesaron, casi a la vez, que no sabían qué iban a hacer con los próximos veinte años de su carrera. Lo que sigue es lo que les respondí, ordenado.",
      epilogue:
        "Si has llegado hasta aquí, ya no eres la persona que abrió este libro. Ahora viene lo difícil: vivir como tal.",
      acknowledgments:
        "A Marta, primera lectora. A los 312 alumnos del programa Tercer Acto, mis verdaderos coautores.",
    },
    publishingForm: {
      author: "Elena Marín",
      description:
        "Un manual práctico y estoico para directivos que han alcanzado la cima y descubren que el mapa ya no sirve. Ocho capítulos, un protocolo de 90 días y una nueva forma de mirar tu carrera.",
      shortBio:
        "Elena Marín es ex-consultora de McKinsey, fundadora del programa Tercer Acto y autora best-seller en transición profesional senior.",
      keywords:
        "reinvención profesional, mid-career, estoicismo, propósito, liderazgo, segunda carrera",
      categories: "Desarrollo profesional, Liderazgo, Crecimiento personal",
      pricePhysical: 22.9,
      priceDigital: 9.99,
      isbn: "",
      bestsellerBlueprint: "Autoayuda estilo James Clear",
    },
    designConfig: { font: "Lora", size: "10.5pt", lineHeight: "1.55", chapterTheme: "luxe" },
    launchKit: { emails: "", social: "", trailer: "" },
    bookCover: null,
  });

  localStorage.setItem(DEMO_FLAG, "1");
}
