import type { ProjectDetail } from "@/lib/data-access/projects";
import { distinctiveTokens } from "./match";
import { searchSeiaByName, searchSeiaByTitular } from "./searchApi";
import type { RawSeiaProject } from "./types";

const MAX_RESULTS_PER_SEARCH = 10;
const MAX_COMBINED_RESULTS = 15;

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function filingTimestamp(candidate: RawSeiaProject): number {
  const epochSeconds = Number(candidate.FECHA_PRESENTACION);
  return Number.isFinite(epochSeconds) && epochSeconds > 0 ? epochSeconds * 1000 : 0;
}

function candidateScore(candidate: RawSeiaProject, project: ProjectDetail): number {
  const candidateOwner = normalize(candidate.TITULAR);
  const owners = [project.spv, project.developerCompany].map(normalize).filter(Boolean);
  const projectTokens = distinctiveTokens(project.name).map(normalize).filter(Boolean);
  const candidateName = normalize(candidate.EXPEDIENTE_NOMBRE);
  const ownerScore = candidateOwner && owners.some((owner) => owner === candidateOwner)
    ? 80
    : candidateOwner && owners.some((owner) => owner.includes(candidateOwner) || candidateOwner.includes(owner))
      ? 55
      : 0;
  const nameScore = projectTokens.filter((token) => candidateName.includes(token)).length * 12;
  const regionScore = normalize(project.region) === normalize(candidate.REGION_NOMBRE) ? 10 : 0;
  const filedAt = filingTimestamp(candidate);
  const ageYears = filedAt > 0 ? Math.max(0, (Date.now() - filedAt) / (365.25 * 24 * 60 * 60 * 1000)) : 20;
  const recencyScore = Math.max(0, 20 - ageYears * 2);
  return ownerScore + nameScore + regionScore + recencyScore;
}

/** Busca primero por titular/SPV y luego por el nombre distintivo del proyecto. */
export async function findVerificationSeiaCandidates(project: ProjectDetail): Promise<RawSeiaProject[]> {
  const ownerTerms = [...new Set(
    [project.spv, project.developerCompany].map((value) => value?.trim()).filter(Boolean),
  )] as string[];
  const projectTerm = distinctiveTokens(project.name).join(" ");
  const searches = [
    ...ownerTerms.map((term) => searchSeiaByTitular(term, MAX_RESULTS_PER_SEARCH)),
    ...(projectTerm ? [searchSeiaByName(projectTerm, MAX_RESULTS_PER_SEARCH)] : []),
  ];
  const results = await Promise.allSettled(searches);
  const candidates: RawSeiaProject[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const candidate of result.value.data) {
      if (seen.has(candidate.EXPEDIENTE_ID)) continue;
      seen.add(candidate.EXPEDIENTE_ID);
      candidates.push(candidate);
    }
  }
  return candidates
    .sort((a, b) => candidateScore(b, project) - candidateScore(a, project) || filingTimestamp(b) - filingTimestamp(a))
    .slice(0, MAX_COMBINED_RESULTS);
}
