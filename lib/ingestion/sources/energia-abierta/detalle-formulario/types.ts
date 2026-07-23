// Estructura del "Formulario SAC" (plantilla oficial versionada del Coordinador
// Eléctrico Nacional, ej. "2504-FORM-SAC-V1") — Nivel 2 de Acceso Abierto.
// Reference: /docs/04-modelo-datos.md §4.8, /docs/05-arquitectura-tecnica.md §5.10

export interface FormularioContact {
  role: "legal_representative" | "project_coordinator_1" | "project_coordinator_2";
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface FormularioLocation {
  utmZone: string | null;
  utmEast: number | null;
  utmNorth: number | null;
  comuna: string | null;
  region: string | null;
}

export interface FormularioData {
  templateVersion: string | null;
  companyName: string | null;
  companyRut: string | null;
  companyLegalAddress: string | null;
  contacts: FormularioContact[];

  projectName: string | null;
  projectKind: string | null;
  technology: string | null;
  netInjectionMw: number | null;
  netWithdrawalMw: number | null;
  powerFactor: number | null;
  inverterControlMode: string | null;
  generationComponentMw: number | null;
  storageComponentMw: number | null;
  storageEnergyMwh: number | null;
  storageHours: number | null;
  projectLocation: FormularioLocation;

  substationName: string | null;
  connectionType: string | null;
  voltageKv: number | null;
  bay: string | null;
  estimatedConstructionDate: string | null;
  estimatedOperationDate: string | null;
  connectionLocation: FormularioLocation;
}

export interface FormularioVerification {
  projectName: string | null;
  companyName: string | null;
  requestType: string | null;
  requestDate: string | null;
  completenessScore: number | null;
  signedByName: string | null;
  signedByRole: string | null;
  signedByCompany: string | null;
}

export interface FormularioConsistencyIssue {
  field: string;
  formularioValue: string | null;
  verificacionValue: string | null;
}

/**
 * El documento "Formulario" de un proyecto puede venir como Excel rico (todos
 * los campos de FormularioData, incluido teléfono/correo de coordinadores) o
 * como un PDF que resultó ser la exportación de la pestaña de verificación —
 * mismo contenido que FormularioVerification, sin contacto telefónico/correo.
 * No son el mismo nivel de detalle: distinguirlos explícitamente evita tratar
 * un resultado incompleto como si fuera la extracción rica. Ver parsePdf.ts.
 */
export type FormularioResult =
  | { kind: "full"; data: FormularioData }
  | { kind: "verification_only"; data: FormularioVerification };
