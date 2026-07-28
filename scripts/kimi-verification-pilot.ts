// Piloto de verificación con Kimi (Moonshot) y GLM-5.2 (Z.ai, vía NVIDIA NIM)
// — mide qué tan efectivo es cada uno como "segunda opinión" sobre una
// muestra de proyectos: (a) si los datos ya extraídos del Formulario tienen
// sentido, y (b) si logra elegir el expediente SEIA correcto entre varios
// candidatos. No escribe nada en la base de datos — solo lee y genera un
// reporte en Markdown para revisión manual (ver docs/kimi-pilot-results-*.md).
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getProjectById, type ProjectDetail } from "../lib/data-access/projects";
import { searchSeiaByName } from "../lib/ingestion/sources/seia/searchApi";
import { findBestSeiaMatch, distinctiveTokens } from "../lib/ingestion/sources/seia/match";
import { completeWithKimi } from "../lib/ai/provider/kimi";
import { completeWithGlm } from "../lib/ai/provider/glm";
import type { RawSeiaProject } from "../lib/ingestion/sources/seia/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const SAMPLE_SIZE = Number(process.argv[2] ?? "40");
const MAX_SEIA_CANDIDATES = 10;
const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

Para seiaPick: elige el expediente cuyo nombre, titular, comuna/región y tipo correspondan mejor al proyecto de conexión. Si dos candidatos parecen igual de válidos o ninguno calza razonablemente, responde null — no adivines.`;

interface JudgeVerdict {
  dataSanity: string;
  dataSanityReason: string;
  seiaPick: string | null;
  seiaPickReason: string;
}

interface JudgeResult {
  verdict: JudgeVerdict | null;
  error: string | null;
}

const JUDGES = [
  { key: "kimi", label: "Kimi", call: completeWithKimi },
  { key: "glm", label: "GLM-5.2", call: completeWithGlm },
] as const;
type JudgeKey = (typeof JUDGES)[number]["key"];

interface PilotEntry {
  project: ProjectDetail;
  candidates: RawSeiaProject[];
  deterministic: { candidate: RawSeiaProject; confidence: string } | null;
  judges: Record<JudgeKey, JudgeResult>;
}

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

async function runOne(client: SupabaseClient, projectId: string): Promise<PilotEntry | null> {
  const project = await getProjectById(client, projectId);
  if (!project) return null;

  // Mismo término de búsqueda (palabras distintivas, sin genéricas como "parque"/
  // "solar") que usa internamente findBestSeiaMatch — así Kimi ve exactamente el
  // mismo universo de candidatos que el matching determinístico consideró, y la
  // comparación entre ambos es justa (si buscáramos por el nombre completo del
  // proyecto, la búsqueda de SEIA suele no encontrar nada).
  const searchTerm = distinctiveTokens(project.name).join(" ");
  const [seiaResponse, deterministic] = await Promise.all([
    searchTerm ? searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES) : Promise.resolve({ data: [] as RawSeiaProject[] }),
    findBestSeiaMatch(project.name, project.region),
  ]);
  const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

  const userPrompt = `Datos del proyecto:\n${formatProjectForPrompt(project)}\n\nCandidatos SEIA:\n${
    candidates.length > 0 ? formatCandidatesForPrompt(candidates) : "(sin candidatos encontrados)"
  }`;

  // Ambos son modelos de razonamiento: gastan tokens en "reasoning_content" antes
  // de escribir el JSON final — con maxTokens bajo a veces se cortan a mitad de
  // razonamiento y nunca llegan a responder (finish_reason=length, content vacío;
  // un caso real de Kimi llegó a gastar 1999 tokens solo verificando a mano el
  // dígito verificador de un RUT). 3500 reduce la tasa de corte sin ser excesivo;
  // igual puede pasar ocasionalmente, y el reporte lo deja ver por juez.
  const judgeEntries = await Promise.all(
    JUDGES.map(async ({ key, call }): Promise<[JudgeKey, JudgeResult]> => {
      try {
        const raw = await call(SYSTEM_PROMPT, userPrompt, { jsonMode: true, maxTokens: 3500 });
        return [key, { verdict: JSON.parse(raw) as JudgeVerdict, error: null }];
      } catch (err) {
        return [key, { verdict: null, error: (err as Error).message }];
      }
    }),
  );
  const judges = Object.fromEntries(judgeEntries) as Record<JudgeKey, JudgeResult>;

  return { project, candidates, deterministic, judges };
}

function renderEntry(entry: PilotEntry, index: number): string {
  const { project, candidates, deterministic, judges } = entry;
  const lines: string[] = [];
  lines.push(`## ${index + 1}. ${project.name}`);
  lines.push("");
  lines.push(`- **Región/comuna:** ${project.region ?? "—"} / ${project.comuna ?? "—"}`);
  lines.push(`- **RUT empresa:** ${project.developerCompanyRut ?? "—"} (${project.developerCompany ?? "—"})`);
  lines.push(`- **Capacidad:** ${project.capacityMw ?? "—"} MW${project.capacityMwh ? ` / ${project.capacityMwh} MWh` : ""}`);
  lines.push("");
  lines.push(`**Candidatos SEIA encontrados:** ${candidates.length}`);
  for (const c of candidates) {
    lines.push(`  - \`${c.EXPEDIENTE_ID}\` ${c.EXPEDIENTE_NOMBRE} — ${c.TITULAR} (${c.COMUNA_NOMBRE}, ${c.REGION_NOMBRE}) — ${c.ESTADO_PROYECTO}`);
  }
  lines.push("");
  lines.push("**Match determinístico actual (`findBestSeiaMatch`):**");
  lines.push(
    deterministic
      ? `- \`${deterministic.candidate.EXPEDIENTE_ID}\` ${deterministic.candidate.EXPEDIENTE_NOMBRE} — confianza **${deterministic.confidence}**`
      : "- Sin match (por debajo del umbral)",
  );
  lines.push("");

  for (const { key, label } of JUDGES) {
    const { verdict, error } = judges[key];
    lines.push(`### ${label}`);
    if (error) {
      lines.push(`- ⚠️ Error llamando a ${label}: ${error}`);
      lines.push("");
      continue;
    }
    if (!verdict) {
      lines.push("- (sin respuesta)");
      lines.push("");
      continue;
    }
    lines.push(`- **Sanity check:** ${verdict.dataSanity} — ${verdict.dataSanityReason}`);
    const pickedCandidate = candidates.find((c) => c.EXPEDIENTE_ID === verdict.seiaPick);
    lines.push(
      `- **Pick SEIA:** ${
        verdict.seiaPick && pickedCandidate ? `\`${verdict.seiaPick}\` ${pickedCandidate.EXPEDIENTE_NOMBRE}` : "Ninguno (null)"
      } — ${verdict.seiaPickReason}`,
    );
    const agree = deterministic && verdict.seiaPick === deterministic.candidate.EXPEDIENTE_ID;
    const bothNull = !deterministic && !verdict.seiaPick;
    lines.push(`- Coincide con el determinístico: ${agree || bothNull ? "✅ sí" : "❌ no"}`);
    lines.push("");
  }

  const kimiVerdict = judges.kimi.verdict;
  const glmVerdict = judges.glm.verdict;
  if (kimiVerdict && glmVerdict) {
    const samePick = kimiVerdict.seiaPick === glmVerdict.seiaPick;
    const sameSanity = kimiVerdict.dataSanity === glmVerdict.dataSanity;
    lines.push(`**Kimi vs. GLM-5.2:** pick ${samePick ? "✅ igual" : "❌ distinto"} · sanity ${sameSanity ? "✅ igual" : "❌ distinto"}`);
    lines.push("");
  }

  lines.push(
    "**Tu evaluación manual:** ☐ Sanity check Kimi correcto&nbsp;&nbsp;☐ Pick SEIA Kimi correcto&nbsp;&nbsp;☐ Sanity check GLM correcto&nbsp;&nbsp;☐ Pick SEIA GLM correcto",
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: logRows, error } = await client
    .from("formulario_ingest_log")
    .select("project_id")
    .eq("status", "success");
  if (error) throw new Error(error.message);

  const allIds = (logRows ?? []).map((r) => r.project_id as string);
  const sampleIds = shuffle(allIds).slice(0, SAMPLE_SIZE);
  console.log(`Proyectos con Formulario completo: ${allIds.length} — muestra: ${sampleIds.length}`);

  const entries: PilotEntry[] = [];
  let i = 0;
  for (const projectId of sampleIds) {
    i++;
    try {
      const entry = await runOne(client, projectId);
      if (entry) {
        entries.push(entry);
        const k = entry.judges.kimi.verdict;
        const g = entry.judges.glm.verdict;
        console.log(
          `  [${i}/${sampleIds.length}] ${entry.project.name} — kimi: sanity=${k?.dataSanity ?? "error"} pick=${k?.seiaPick ?? "—"} | glm: sanity=${g?.dataSanity ?? "error"} pick=${g?.seiaPick ?? "—"}`,
        );
      } else {
        console.log(`  [${i}/${sampleIds.length}] proyecto ${projectId} ya no existe, se omite`);
      }
    } catch (err) {
      console.log(`  [${i}/${sampleIds.length}] error en ${projectId}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const header = [
    `# Piloto de verificación con Kimi y GLM-5.2 — ${dateStr}`,
    "",
    `Muestra aleatoria de ${entries.length} proyectos (de ${allIds.length} con Formulario ya extraído). Por cada uno, para cada juez (Kimi y GLM-5.2 vía NVIDIA NIM): si encuentra los datos consistentes, y si elige el mismo expediente SEIA que el matching determinístico actual (\`findBestSeiaMatch\`) — además de si Kimi y GLM coinciden entre sí. Nada se escribió en la base de datos — es solo para revisión manual.`,
    "",
    "Marca las casillas de \"Tu evaluación manual\" a mano después de revisar cada caso, y cuenta al final cuántos aciertos reales hubo por juez antes de decidir cuál (si alguno) se integra al Verificador.",
    "",
    "---",
    "",
  ].join("\n");

  const body = entries.map((e, idx) => renderEntry(e, idx)).join("\n");
  const outPath = join(__dirname, "..", "docs", `kimi-glm-pilot-results-${dateStr}.md`);
  await writeFile(outPath, header + body, "utf8");

  console.log(`\n--- Resumen ---`);
  console.log(`Proyectos procesados: ${entries.length}`);
  console.log(`Errores de Kimi: ${entries.filter((e) => e.judges.kimi.error).length}`);
  console.log(`Errores de GLM: ${entries.filter((e) => e.judges.glm.error).length}`);
  console.log(`Reporte escrito en: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
