"use server";

import { revalidatePath } from "next/cache";
import { searchSeiaByName } from "@/lib/ingestion/sources/seia/searchApi";
import { saveSeiaMatch } from "@/lib/ingestion/sources/seia/load";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectStakeholders, type ProjectStakeholder } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import type { RawSeiaProject } from "@/lib/ingestion/sources/seia/types";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

/** Autoriza si hay una sesión de admin real, o (mientras existan flujos sin login) la clave compartida. */
async function isAuthorized(adminSecret: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return !!process.env.SEIA_ADMIN_SECRET && adminSecret === process.env.SEIA_ADMIN_SECRET;
}

export interface SeiaCandidate {
  expedienteId: string;
  nombre: string;
  titular: string;
  region: string;
  comuna: string;
  estado: string;
  tipoProyecto: string;
  raw: RawSeiaProject;
}

/** Server Function reachable via POST directamente — no hace mutaciones, solo lee SEIA, sin datos sensibles. */
export async function searchSeiaForAssociation(query: string): Promise<SeiaCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const response = await searchSeiaByName(trimmed, 15);
  return response.data.map((r) => ({
    expedienteId: r.EXPEDIENTE_ID,
    nombre: r.EXPEDIENTE_NOMBRE,
    titular: r.TITULAR,
    region: r.REGION_NOMBRE,
    comuna: r.COMUNA_NOMBRE,
    estado: r.ESTADO_PROYECTO,
    tipoProyecto: r.DESCRIPCION_TIPOLOGIA,
    raw: r,
  }));
}

/**
 * Mutación real — verificada con una clave compartida (`SEIA_ADMIN_SECRET`).
 * No hay sistema de login todavía (ver docs/09-seguridad.md); esto es un
 * resguardo mínimo para que esta acción de escritura no quede abierta al
 * público mientras se construye autenticación real.
 */
export async function assignSeiaMatch(
  projectId: string,
  candidate: RawSeiaProject,
  adminSecret: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorized(adminSecret))) {
    return { success: false, error: "Clave incorrecta." };
  }

  try {
    const client = createSupabaseServiceClient();
    await saveSeiaMatch(client, projectId, candidate, "alta", "manual");
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Los contactos (`person`) están restringidos a usuarios autenticados por RLS
 * — un visitante público no los ve aunque estén guardados (ver docs/09-seguridad.md).
 * Esta acción usa el cliente de servicio (bypassa RLS) detrás de la misma
 * clave compartida, como resguardo mínimo mientras no exista login real.
 */
export async function revealStakeholders(
  projectId: string,
  developerCompanyId: string | null,
): Promise<{ success: boolean; stakeholders?: ProjectStakeholder[]; error?: string }> {
  const admin = await isAdmin();
  const profile = admin ? null : await getCurrentUserProfile(await createSupabaseServerClient());
  if (!admin && profile?.planCode !== "premium") {
    return { success: false, error: "El equipo del proyecto está disponible en Premium." };
  }
  try {
    const client = createSupabaseServiceClient();
    // Sin respaldo por empresa acá: los contactos deben ser solo los que vienen
    // realmente de la ficha/Formulario de ESTE proyecto, nunca los de otro proyecto
    // de la misma empresa (mismo criterio que el editor de admin, ver
    // ProjectEditPageBody — hallazgo real: mostraba contactos "que no tienen nada
    // que ver" cuando el proyecto no tenía vínculo propio todavía).
    const stakeholders = await getProjectStakeholders(client, projectId, developerCompanyId, { skipCompanyFallback: true });
    return { success: true, stakeholders };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
