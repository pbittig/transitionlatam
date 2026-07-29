// Sugerencia de verificación con GLM-5.2 (Z.ai, vía NVIDIA NIM) — mismo prompt
// validado en el piloto de 40 proyectos (scripts/kimi-verification-pilot.ts en
// la rama principal): revisa si los datos del Formulario tienen sentido y, si
// hay candidatos SEIA, cuál corresponde. Usado desde el botón "Pedir sugerencia
// de IA" del Verificador — nunca escribe nada por sí solo, solo devuelve el
// veredicto para que el admin decida si lo usa.
import { completeWithGlm } from "@/lib/ai/provider/glm";
import type { ProjectDetail } from "@/lib/data-access/projects";
import type { RawSeiaProject } from "@/lib/ingestion/sources/seia/types";

export interface VerificationSuggestion {
  dataSanity: string;
  dataSanityReason: string;
  seiaPick: string | null;
  seiaPickReason: string;
}

const SYSTEM_PROMPT = `Eres un analista senior de energía en Chile revisando la calidad de datos de proyectos de conexión eléctrica.

Se te entregan los datos ya extraídos de un proyecto (Formulario de solicitud de conexión) y una lista de expedientes candidatos del SEIA (Servicio de Evaluación Ambiental). Responde en JSON con exactamente estos campos:

{
  "dataSanity": "ok" | "sospechoso",
  "dataSanityReason": "una frase breve explicando por qué",
  "seiaPick": "<EXPEDIENTE_ID del candidato correcto, o null si ninguno corresponde>",
  "seiaPickReason": "una frase breve explicando la elección"
}

Para dataSanity: marca "sospechoso" solo si algo es realmente inconsistente (ej. un RUT con formato inválido, una capacidad de almacenamiento mayor a la de generación sin que el proyecto sea BESS puro, un nombre que no calza con la tecnología, campos claramente vacíos que deberían tener dato). No marques "sospechoso" por simple falta de un dato opcional.

Para seiaPick: elige el expediente cuyo nombre, titular, comuna/región y tipo correspondan mejor al proyecto de conexión. Cuando existan varios candidatos igualmente plausibles, prefiere el de fecha de ingreso más reciente. Si ninguno calza razonablemente, responde null — no adivines.`;

function formatProjectForPrompt(project: ProjectDetail): string {
  return JSON.stringify(
    {
      nombre: project.name,
      tecnologia: project.technology,
      incluyeAlmacenamiento: project.includesStorage,
      region: project.region,
      comuna: project.comuna,
      rutEmpresa: project.developerCompanyRut,
      empresa: project.developerCompany,
      spv: project.spv,
      tipoSolicitud: project.requestType,
      capacidadMw: project.capacityMw,
      capacidadMwh: project.capacityMwh,
      potenciaGeneracionMw: project.generationCapacityMw,
      potenciaAlmacenamientoMw: project.storageCapacityMw,
      puntoConexion: project.connectionPoint,
      nivelTensionKv: project.voltageLevel,
    },
    null,
    2,
  );
}

function formatCandidatesForPrompt(candidates: RawSeiaProject[]): string {
  return JSON.stringify(
    candidates.map((c) => ({
      EXPEDIENTE_ID: c.EXPEDIENTE_ID,
      nombre: c.EXPEDIENTE_NOMBRE,
      titular: c.TITULAR,
      region: c.REGION_NOMBRE,
      comuna: c.COMUNA_NOMBRE,
      tipo: c.DESCRIPCION_TIPOLOGIA,
      estado: c.ESTADO_PROYECTO,
    })),
    null,
    2,
  );
}

export async function getGlmVerificationSuggestion(
  project: ProjectDetail,
  candidates: RawSeiaProject[],
): Promise<{ suggestion: VerificationSuggestion | null; error: string | null }> {
  const userPrompt = `Datos del proyecto:\n${formatProjectForPrompt(project)}\n\nCandidatos SEIA:\n${
    candidates.length > 0 ? formatCandidatesForPrompt(candidates) : "(sin candidatos encontrados)"
  }`;
  try {
    // 3500 tokens de margen: es un modelo de razonamiento, gasta tokens en
    // "reasoning_content" antes del JSON final — ver nota completa en
    // scripts/kimi-verification-pilot.ts (rama principal), donde se validó
    // este mismo margen sobre 40 proyectos reales sin errores.
    const raw = await completeWithGlm(SYSTEM_PROMPT, userPrompt, { jsonMode: true, maxTokens: 3500 });
    return { suggestion: JSON.parse(raw) as VerificationSuggestion, error: null };
  } catch (err) {
    return { suggestion: null, error: (err as Error).message };
  }
}
