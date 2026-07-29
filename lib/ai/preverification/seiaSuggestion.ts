import { distinctiveTokens } from "@/lib/ingestion/sources/seia/match";
import { searchSeiaByName } from "@/lib/ingestion/sources/seia/searchApi";
import type { ProjectDetail } from "@/lib/data-access/projects";
import type { PreverificationSeiaSuggestion } from "./types";
import { completePreverificationReview } from "./reviewProvider";

const PROMPT = `Selecciona conservadoramente el expediente SEIA que corresponde al
proyecto eléctrico chileno. Evalúa nombre distintivo, titular/RUT, comuna,
región, tecnología, capacidad y que el expediente sea de la central/BESS y no
solo de su línea o subestación. Si hay empate o evidencia insuficiente devuelve
expedienteId null. "high" requiere varias señales independientes consistentes.
Responde solo JSON:
{"expedienteId":string|null,"confidence":"high"|"medium"|"low"|null,"reason":string}`;

export async function suggestSeiaMatch(
  project: ProjectDetail,
  documentContext: unknown,
): Promise<PreverificationSeiaSuggestion> {
  const tokens = distinctiveTokens(project.name);
  if (!tokens.length) return { expedienteId: null, expedienteName: null, confidence: null, reason: "Nombre sin términos distintivos." };
  const response = await searchSeiaByName(tokens.join(" "), 20);
  if (!response.data.length) return { expedienteId: null, expedienteName: null, confidence: null, reason: "SEIA no devolvió candidatos." };
  const candidates = response.data.map((r) => ({
    id: r.EXPEDIENTE_ID, name: r.EXPEDIENTE_NOMBRE, owner: r.TITULAR,
    region: r.REGION_NOMBRE, comuna: r.COMUNA_NOMBRE, type: r.DESCRIPCION_TIPOLOGIA,
    typeCode: r.TIPO_PROYECTO, status: r.ESTADO_PROYECTO,
  }));
  const raw = await completePreverificationReview(
    PROMPT,
    JSON.stringify({ project, documentContext, candidates }),
    2500,
  );
  const parsed = JSON.parse(raw) as { expedienteId: string | null; confidence: "high" | "medium" | "low" | null; reason: string };
  const match = candidates.find((candidate) => String(candidate.id) === String(parsed.expedienteId));
  if (parsed.expedienteId && !match) {
    return { expedienteId: null, expedienteName: null, confidence: null, reason: "La IA devolvió un candidato fuera de la lista permitida." };
  }
  return {
    expedienteId: parsed.expedienteId ? String(parsed.expedienteId) : null,
    expedienteName: match?.name ?? null,
    confidence: parsed.confidence,
    reason: parsed.reason,
  };
}
