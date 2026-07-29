import type { NormalizedProject } from "./types";

export type PrefilterStatus = "candidate" | "review" | "out_of_scope";
export type PrefilterCategory = "renewable" | "bess" | "uncertain" | "out_of_scope";

export interface ProjectPrefilterResult {
  status: PrefilterStatus;
  category: PrefilterCategory;
  reason: string;
}

const RENEWABLE_TECHNOLOGIES = new Set([
  "solar_pv",
  "wind",
  "hydro",
  "pumped_hydro",
  "biomass",
  "geothermal",
  "hybrid",
]);

const STORAGE_PATTERN = /\b(bess|bater[ií]a|almacenamiento|storage)\b/i;
const DATA_CENTER_PATTERN =
  /\b(data\s*cent(?:er|re)|datacenter|centro\s+de\s+datos|campus\s+(?:digital|tecnol[oó]gico)|dc\s+santiago|odata|ascenty|scala)\b/i;

const TRANSMISSION_DISTRIBUTION_PATTERN =
  /\b(alimentador(?:es)?|subestaci[oó]n(?:es)?|l[ií]nea(?:s)?|seccionador(?:es)?|seccionamiento(?:s)?|transformador(?:es)?|impulsi[oó]n(?:es)?)\b/i;

export function prefilterProject(row: NormalizedProject): ProjectPrefilterResult {
  const searchable = `${row.projectName} ${row.companyName} ${row.technologyCode ?? ""}`;

  if (TRANSMISSION_DISTRIBUTION_PATTERN.test(searchable)) {
    return {
      status: "out_of_scope",
      category: "out_of_scope",
      reason: "Infraestructura de transmisión o distribución fuera del alcance: foco en generación renovable y BESS.",
    };
  }
  if (row.technologyCode === "bess" || row.includesStorage || STORAGE_PATTERN.test(searchable)) {
    return { status: "candidate", category: "bess", reason: "Tecnología o nombre asociado a almacenamiento/BESS." };
  }
  if (DATA_CENTER_PATTERN.test(searchable)) {
    return {
      status: "out_of_scope",
      category: "out_of_scope",
      reason: "Data center fuera del alcance actual: foco en generación renovable y BESS.",
    };
  }
  if (row.technologyCode && RENEWABLE_TECHNOLOGIES.has(row.technologyCode)) {
    return { status: "candidate", category: "renewable", reason: `Tecnología renovable identificada: ${row.technologyCode}.` };
  }
  if (row.projectKind === "generation" && !row.technologyCode) {
    return { status: "review", category: "uncertain", reason: "Proyecto de generación sin tecnología identificada." };
  }
  if (!row.projectKind && !row.technologyCode) {
    return { status: "review", category: "uncertain", reason: "La fuente no permite determinar todavía el tipo de proyecto." };
  }
  return {
    status: "out_of_scope",
    category: "out_of_scope",
    reason: "No corresponde a renovables, BESS ni data center según los datos disponibles.",
  };
}
