// Sugerencia de verificación — revisa si los datos del Formulario tienen
// sentido y, si hay candidatos SEIA, cuál corresponde. Usado desde el botón
// "Pedir sugerencia de IA" del Verificador y desde el tamizado automático
// (runScreeningQueue.ts) — nunca escribe nada por sí solo, solo devuelve el
// veredicto para que el admin decida si lo usa.
//
// Corrido con Nemotron (NVIDIA NIM), no con GLM: el prompt es el mismo que se
// validó con GLM-5.2 en el piloto de 40 proyectos (scripts/kimi-verification-
// pilot.ts, rama principal), pero GLM-5.2 fue dado de baja el 2026-08-21 y su
// sucesor (glm-5.3) no soporta el control token "detailed thinking off" —
// razona ~35-55s por respuesta incluso en prompts triviales, y por encima de
// eso en prompts reales (probado: excedía el timeout de 55s). Eso es inviable
// para el cron de tamizado (maxDuration acotado) y una espera pobre para el
// botón manual. Nemotron, ya usado en otras partes de la app, resuelve la
// misma tarea en 5-17s sobre proyectos reales — probado antes de migrar.
import { completeWithNemotron } from "@/lib/ai/provider/nvidia";
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

export async function getVerificationSuggestion(
  project: ProjectDetail,
  candidates: RawSeiaProject[],
): Promise<{ suggestion: VerificationSuggestion | null; error: string | null }> {
  const userPrompt = `Datos del proyecto:\n${formatProjectForPrompt(project)}\n\nCandidatos SEIA:\n${
    candidates.length > 0 ? formatCandidatesForPrompt(candidates) : "(sin candidatos encontrados)"
  }`;
  try {
    // 2000 tokens de margen: probado sobre proyectos reales con Nemotron
    // (5-17s, muy por debajo del margen de GLM porque "detailed thinking off"
    // evita el razonamiento largo que consumía la mayoría del presupuesto).
    const raw = await completeWithNemotron(SYSTEM_PROMPT, userPrompt, { jsonMode: true, maxTokens: 2000, timeoutMs: 55_000 });
    return { suggestion: JSON.parse(raw) as VerificationSuggestion, error: null };
  } catch (err) {
    return { suggestion: null, error: (err as Error).message };
  }
}
