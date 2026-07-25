// Cargos controlados que guarda lib/ingestion/sources/energia-abierta/detalle-formulario/load.ts
// (contact.role, más el fallback "signer" del camino verification_only) — el resto de los
// valores en entity_relationship.relationship_type es texto libre extraído por IA, que suele
// venir ya en español y se muestra tal cual.
const CONTACT_ROLE_LABELS_ES: Record<string, string> = {
  legal_representative: "Representante Legal",
  project_coordinator_1: "Coordinador de Proyecto 1",
  project_coordinator_2: "Coordinador de Proyecto 2",
  signer: "Firmante",
};

export function contactRoleLabelEs(role: string): string {
  return CONTACT_ROLE_LABELS_ES[role] ?? role;
}
