// Etapas del funnel comercial (tabla opportunity) — separado de
// lib/data-access/opportunities.ts para que un componente que solo necesita
// los nombres de las etapas (ej. el botón "Agregar al CRM" en la ficha de un
// proyecto) no tenga que importar getOpportunityBoard() y su lógica de query.
export const OPPORTUNITY_STAGES = [
  "contacto",
  "reunion",
  "elaboracion_propuesta",
  "envio_propuesta",
  "seguimiento",
  "cierre_ganado",
  "cierre_perdido",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  contacto: "Contacto",
  reunion: "Reunión",
  elaboracion_propuesta: "Elaboración propuesta",
  envio_propuesta: "Envío propuesta",
  seguimiento: "Seguimiento",
  cierre_ganado: "Cierre — Ganado",
  cierre_perdido: "Cierre — Perdido",
};

/** Etapas terminales — una oportunidad acá no cuenta como "activa" para el botón de alta rápida. */
export const CLOSED_STAGES: readonly OpportunityStage[] = ["cierre_ganado", "cierre_perdido"];
