import { completeWithNemotron } from "@/lib/ai/provider/nvidia";

const VALID_CODES = [
  "solar_pv",
  "wind",
  "bess",
  "hybrid",
  "hydro",
  "pumped_hydro",
  "thermal",
  "biomass",
  "geothermal",
  "consumption",
  "transmission",
] as const;
export type TechnologyCode = (typeof VALID_CODES)[number];

export interface NameClassification {
  name: string;
  technologyCode: TechnologyCode | null;
  confidence: number; // 0–1
}

const SYSTEM_PROMPT = `Clasificas nombres de proyectos de conexión eléctrica en Chile por tecnología, \
basándote únicamente en palabras clave del nombre — es un ejercicio simple de reconocimiento de \
palabras clave, no requiere análisis profundo ni dudar mucho.

Códigos válidos: solar_pv, wind, bess, hybrid, hydro, pumped_hydro, thermal, biomass, geothermal, \
consumption, transmission.

Pistas de palabras clave (español):
- "solar", "fotovoltaico", "FV", "PV" → solar_pv
- "eólico", "viento", "parque eólico" → wind
- "BESS", "batería", "almacenamiento", "storage" → bess
- "híbrido" → hybrid
- "hidro", "hidroeléctric", "central hidroeléctrica" → hydro
- "bombeo" → pumped_hydro
- **Si el nombre menciona dos tecnologías distintas a la vez (ej. "Solar" y "BESS" juntos, o "PV+BESS")** → usa directamente "hybrid", sin evaluar cuál de las dos "es más correcta". Esta regla ya resuelve el caso ambiguo — no hay que razonarlo más.
- "térmica", "termoeléctrica" → thermal
- "biomasa" → biomass
- "geotérmic" → geothermal
- "consumo", "abastecimiento", "cliente" → consumption
- "línea", "subestación", "transmisión", "S/E" → transmission

Si el nombre no da ninguna pista clara, responde technologyCode: null y confidence: 0. No inventes \
una tecnología que el nombre no sugiere — es preferible null a una adivinanza sin base.

Responde ÚNICAMENTE un JSON: {"results": [{"name": "...", "technologyCode": "..."|null, "confidence": 0.0}]} \
— un elemento por cada nombre de la lista, en el mismo orden.`;

export async function classifyTechnologyByName(names: string[]): Promise<NameClassification[]> {
  const userPrompt = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  const raw = await completeWithNemotron(SYSTEM_PROMPT, userPrompt, { jsonMode: true, maxTokens: 4000 });
  const parsed = JSON.parse(raw) as { results: Array<{ name: string; technologyCode: string | null; confidence: number }> };

  return parsed.results.map((r) => ({
    name: r.name,
    technologyCode: VALID_CODES.includes(r.technologyCode as TechnologyCode) ? (r.technologyCode as TechnologyCode) : null,
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
  }));
}
