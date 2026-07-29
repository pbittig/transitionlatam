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
  role: "formulario" | "informe_preliminar";
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
