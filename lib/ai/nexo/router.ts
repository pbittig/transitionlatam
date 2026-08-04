import type { NexoIntent } from "./types";

const QUALITY = /\b(duplic\w*|inconsisten\w*|calidad|falt\w*|inv[aá]lid\w*|desactualiz\w*|conflict\w*|broken|missing|quality|stale)\b/i;
const COMPANY = /\b(empresa\w*|compa[nñ][ií]a\w*|desarrollador\w*|propietari\w*|titular\w*|inversionista\w*|compan\w*|developer\w*|owner\w*|investor\w*)\b/i;
const ANALYSIS = /\b(analiz\w*|ranking\w*|relevan\w*|posicionamiento\w*|tendencia\w*|mercado\w*|oportunidad\w*|riesgo\w*|compar\w*|analysis|rank\w*|trend\w*|market\w*|opportunit\w*|risk\w*)\b/i;
const PROJECT = /\b(proyecto\w*|bess|solar\w*|e[oó]lic\w*|hidro\w*|mw|mwh|seia|project\w*|wind\w*|storage)\b/i;

export function classifyNexoIntent(question: string): NexoIntent {
  if (QUALITY.test(question)) return "data_quality";
  if (ANALYSIS.test(question)) return "market_analysis";
  if (COMPANY.test(question)) return "company_lookup";
  if (PROJECT.test(question)) return "project_lookup";
  return "general";
}
