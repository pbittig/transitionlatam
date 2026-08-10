export type PreverificationFieldStatus =
  | "completed"
  | "already_present"
  | "undetermined"
  | "suggested_only"
  | "error";

export type PreverificationConfidence = "high" | "medium" | "low" | null;

export interface PreverificationFieldResult {
  field: string;
  status: PreverificationFieldStatus;
  previousValue: unknown;
  proposedValue: unknown;
  applied: boolean;
  confidence: PreverificationConfidence;
  source: string | null;
  reason: string;
}

export interface PreverificationDocumentInfo {
  id: number;
  name: string;
  type: string;
  // "informe_preliminar" queda por compatibilidad con reportes ya guardados
  // antes de este cambio (2026-08-09) — las corridas nuevas ya solo escriben
  // "informe_conexion" (preliminar, definitivo, o fehaciente, ver fetchFromPortal.ts).
  role: "formulario" | "informe_conexion" | "informe_preliminar";
}

export interface PreverificationSeiaSuggestion {
  expedienteId: string | null;
  expedienteName: string | null;
  confidence: PreverificationConfidence;
  reason: string;
}

export interface ProjectPreverificationReport {
  projectId: string;
  projectName: string;
  solicitudId: string | null;
  mode: "dry_run" | "apply";
  documents: PreverificationDocumentInfo[];
  observedDocumentTypes: string[];
  fields: PreverificationFieldResult[];
  contacts: {
    status: PreverificationFieldStatus;
    found: number;
    loaded: number;
    source: string | null;
    reason: string;
  };
  seia: PreverificationSeiaSuggestion;
  errors: string[];
}
