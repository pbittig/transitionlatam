import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DequienesClient } from "./fetch";
import { construirCadena, type EntidadCadena } from "./normalize";
import { rutParaApi, rutEsValido } from "./rut";
import { normalizeRutDigits } from "@/lib/ingestion/sources/sea-pertinencia/matching";

/**
 * Carga la propiedad societaria de UN proyecto al momento de verificarlo, para
 * que su ficha tenga el mapa sin depender de una corrida manual del batch
 * (scripts/sync-dequienes-ownership.ts). Misma lógica, alcance de a uno.
 *
 * Barata en créditos por diseño: si la desarrolladora ya existe como entidad
 * —porque otro de sus proyectos ya se cargó— no se vuelve a llamar a la API; se
 * reutiliza esa entidad como sociedad vehículo y solo se agrega la ficha del
 * proyecto nuevo. La API solo se toca cuando la desarrolladora es nueva.
 */

/** Etiqueta legible del registro del que salió la arista. Espejo del batch. */
const FUENTES: Record<string, string> = {
  SII_REC_COM: "Registro de comercio (SII)",
  CMF: "Registro de accionistas (CMF)",
  DO: "Diario Oficial",
  DOH: "Diario Oficial",
  RES: "Resolución administrativa",
};
const etiquetaFuente = (codigo: string | null) =>
  codigo ? (FUENTES[codigo] ?? `Registro público (${codigo})`) : "Registro público";

const ETIQUETA_PERFIL = "Relaciones societarias de registros públicos, vía dequienes.cl";

export type OwnershipSyncStatus =
  | "written" // se llamó a la API y se escribió la cadena + ficha
  | "reused" // la desarrolladora ya existía; se agregó solo la ficha, sin API
  | "skipped" // el proyecto ya tenía ficha societaria
  | "no-developer" // el proyecto no tiene desarrolladora asociada
  | "invalid-rut" // la desarrolladora no tiene un RUT utilizable
  | "no-owner" // la fuente no registra dueño de la desarrolladora
  | "disabled" // falta DEQUIENES_API_KEY en el entorno
  | "error"; // fallo al construir o escribir la cadena

export interface OwnershipSyncResult {
  status: OwnershipSyncStatus;
  detail?: string;
  credits?: number;
}

/**
 * Sincroniza la propiedad societaria del proyecto `projectId`. No lanza: cualquier
 * fallo vuelve como `{ status: "error" }` para que quien la llame (la acción de
 * verificar) no se caiga por esto.
 */
export async function syncOwnershipForProject(
  client: SupabaseClient,
  projectId: string,
): Promise<OwnershipSyncResult> {
  try {
    const apiKey = process.env.DEQUIENES_API_KEY;
    if (!apiKey) return { status: "disabled", detail: "DEQUIENES_API_KEY no configurada" };

    // ¿ya tiene ficha? Nada que hacer.
    const { data: perfil } = await client
      .from("project_ownership_profile")
      .select("project_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (perfil) return { status: "skipped", detail: "el proyecto ya tenía ficha societaria" };

    // Proyecto -> desarrolladora con RUT válido.
    const { data: proyecto } = await client
      .from("project")
      .select("developer_company_id")
      .eq("id", projectId)
      .maybeSingle();
    const companyId = (proyecto?.developer_company_id as string | null) ?? null;
    if (!companyId) return { status: "no-developer", detail: "el proyecto no tiene desarrolladora" };

    const { data: empresa } = await client
      .from("company")
      .select("id, name, rut")
      .eq("id", companyId)
      .maybeSingle();
    if (!empresa?.rut) return { status: "invalid-rut", detail: "la desarrolladora no tiene RUT" };
    const apiRut = rutParaApi(empresa.rut);
    if (!apiRut || !rutEsValido(empresa.rut)) {
      return { status: "invalid-rut", detail: `RUT no utilizable: ${empresa.rut}` };
    }

    // Entidades ya cargadas: para reutilizar por RUT y para no pagar nombres.
    const entidadesExistentes = await leerTodo<{ id: string; rut: string | null; legal_name: string | null }>(
      client,
      "ownership_entity",
      "id,rut,legal_name",
    );
    const idPorRut = new Map<string, string>();
    const nombresConocidos = new Map<string, string>();
    for (const e of entidadesExistentes) {
      const clave = normalizeRutDigits(e.rut);
      if (clave) idPorRut.set(clave, e.id);
      const apiR = rutParaApi(e.rut);
      if (apiR && e.legal_name) nombresConocidos.set(apiR, e.legal_name);
    }
    if (apiRut && empresa.name) nombresConocidos.set(apiRut, empresa.name);

    const claveEmpresa = normalizeRutDigits(empresa.rut);
    const idExistente = claveEmpresa ? idPorRut.get(claveEmpresa) : undefined;

    // La desarrolladora ya existe como entidad (otro de sus proyectos la cargó):
    // se reutiliza como sociedad vehículo y se agrega solo la ficha, sin API.
    if (idExistente) {
      const { data: perfilPrevio } = await client
        .from("project_ownership_profile")
        .select("coverage_status, source_date")
        .eq("spv_entity_id", idExistente)
        .limit(1)
        .maybeSingle();
      await client.from("project_ownership_profile").insert({
        project_id: projectId,
        spv_entity_id: idExistente,
        coverage_status: (perfilPrevio?.coverage_status as string) ?? "partial",
        source_label: ETIQUETA_PERFIL,
        source_date: (perfilPrevio?.source_date as string | null) ?? null,
      });
      return { status: "reused", detail: `reutiliza la cadena ya cargada de ${empresa.name}`, credits: 0 };
    }

    // Desarrolladora nueva: se consulta a dequienes y se escribe la cadena.
    const api = new DequienesClient({ apiKey });
    const cadena = await construirCadena(api, apiRut, { nombresConocidos, nivelMaximo: 1 });
    if (!cadena.relaciones.length) {
      return { status: "no-owner", detail: "la fuente no registra dueño de la desarrolladora", credits: cadena.llamadas };
    }

    const idDe = async (entidad: EntidadCadena): Promise<string> => {
      const clave = normalizeRutDigits(entidad.rut)!;
      const existente = idPorRut.get(clave);
      if (existente) return existente;
      // El nombre de la raíz sale de nuestra base (mayúsculas/acentos correctos);
      // el resto viene de la API tal cual lo publica el registro.
      const nombre = entidad.nivel === 0 ? empresa.name : entidad.nombre;
      if (!nombre) throw new Error(`Sin nombre para ${entidad.rut}`);
      const { data, error } = await client
        .from("ownership_entity")
        .insert({
          legal_name: nombre,
          rut: entidad.rut,
          entity_type: entidad.tipo,
          country_code: entidad.tipo === "foreign_company" ? null : "CL",
        })
        .select("id")
        .single();
      if (error) throw new Error(`ownership_entity ${entidad.rut}: ${error.message}`);
      idPorRut.set(clave, data.id as string);
      return data.id as string;
    };

    for (const rel of cadena.relaciones) {
      const dueno = cadena.entidades.find((e) => e.rutNumerico === rel.duenoRut);
      const poseido = cadena.entidades.find((e) => e.rutNumerico === rel.poseidoRut);
      if (!dueno || !poseido) continue;
      const ownerId = await idDe(dueno);
      const ownedId = await idDe(poseido);
      const { error } = await client.from("ownership_relation").upsert(
        {
          owner_entity_id: ownerId,
          owned_entity_id: ownedId,
          ownership_percent: rel.porcentaje,
          source_label: etiquetaFuente(rel.fuente),
          source_date: rel.fechaFuente,
        },
        { onConflict: "owner_entity_id,owned_entity_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`ownership_relation: ${error.message}`);
    }

    const raiz = cadena.entidades.find((e) => e.nivel === 0);
    if (!raiz) return { status: "error", detail: "la cadena no trae la sociedad raíz", credits: cadena.llamadas };
    const spvId = await idDe(raiz);

    const fechas = cadena.relaciones
      .map((r) => r.fechaFuente)
      .filter((f): f is string => !!f)
      .sort();
    await client.from("project_ownership_profile").insert({
      project_id: projectId,
      spv_entity_id: spvId,
      coverage_status: cadena.truncada ? "partial" : "complete",
      source_label: ETIQUETA_PERFIL,
      source_date: fechas.at(-1) ?? null,
    });

    return { status: "written", detail: `cadena de ${empresa.name} cargada`, credits: cadena.llamadas };
  } catch (error) {
    return { status: "error", detail: (error as Error).message };
  }
}

async function leerTodo<T>(client: SupabaseClient, tabla: string, select: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await client.from(tabla).select(select).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return filas;
}
