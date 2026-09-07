/**
 * Arma la cadena de propiedad de una sociedad a partir del grafo crudo.
 *
 * El corte es deliberado. Pedido a distancia 1 y siguiendo solo las aristas de
 * control, la cadena queda en 1 o 2 niveles y llega a la matriz real — que es
 * la pregunta que importa: de quién es este proyecto. Pedido a distancia mayor,
 * en una sociedad abierta aparecen cientos de aristas hacia AFP, bancos y
 * fondos con participaciones bajo el 1%; eso no dice quién controla y multiplica
 * el gasto de créditos (medido en Enel Green Power: 3 dueños directos se abren
 * a 82 entidades en cuatro niveles, mediana de participación 1,7%).
 */

import type { DequienesClient, RelacionCruda } from "./fetch";
import { rutDesdeApi, tipoEntidadPorRut } from "./rut";

/** Sobre este porcentaje se considera que hay control y se sigue subiendo. */
export const UMBRAL_CONTROL = 50;
/**
 * Bajo este porcentaje la participacion no se guarda ni se le resuelve el
 * nombre. Es el corte que separa a un socio real del free float bursatil: en
 * Enel Chile y Engie, los duenos que lista la CMF bajo el 5% son bancos,
 * corredoras y AFP. Guardarlos no dice de quien es el proyecto y cada nombre
 * cuesta un credito.
 */
export const UMBRAL_REGISTRO = 5;
/** Niveles de propiedad hacia arriba que se recorren como máximo. */
export const NIVEL_MAXIMO = 2;

export interface EntidadCadena {
  rutNumerico: string;
  /** RUT con dígito verificador reconstruido, para cruzar contra company.rut. */
  rut: string;
  nombre: string | null;
  tipo: "company" | "person" | "foreign_company";
  /** 0 es la sociedad consultada; 1 su dueño directo; 2 el dueño de ese. */
  nivel: number;
}

export interface RelacionCadena {
  duenoRut: string;
  poseidoRut: string;
  /** null cuando la fuente no publica el porcentaje — no se infiere. */
  porcentaje: number | null;
  fuente: string | null;
  fechaFuente: string | null;
  /** El porcentaje supera el umbral de control. */
  esControl: boolean;
}

export interface CadenaPropiedad {
  raizRutNumerico: string;
  entidades: EntidadCadena[];
  relaciones: RelacionCadena[];
  /** Aristas de propiedad que la fuente entregó sin porcentaje. */
  sinPorcentaje: number;
  /** Se alcanzó NIVEL_MAXIMO con dueños de control aún sin explorar. */
  truncada: boolean;
  llamadas: number;
}

function porcentajeDe(rel: RelacionCruda): number | null {
  const info = rel.information_source ?? {};
  const valor = typeof info.shares_percent === "number" ? info.shares_percent : info.shareholder_pct;
  return typeof valor === "number" ? valor : null;
}

/** Aristas de propiedad que salen de `rut` — en este grafo, sus dueños. */
function duenosDirectos(relaciones: RelacionCruda[], rut: string): RelacionCruda[] {
  const porDueno = new Map<string, RelacionCruda>();
  for (const rel of relaciones) {
    if (rel.label !== "OWNED_BY" || String(rel.source) !== rut) continue;
    // La misma pareja puede venir por dos registros (ej. CMF y Diario Oficial).
    // Se conserva la que declara porcentaje; entre dos con porcentaje, la mayor.
    const previa = porDueno.get(String(rel.target));
    if (!previa) { porDueno.set(String(rel.target), rel); continue; }
    const a = porcentajeDe(previa) ?? -1;
    const b = porcentajeDe(rel) ?? -1;
    if (b > a) porDueno.set(String(rel.target), rel);
  }
  return [...porDueno.values()];
}

export async function construirCadena(
  client: DequienesClient,
  raizRutNumerico: string,
  opciones: {
    umbralControl?: number;
    umbralRegistro?: number;
    nivelMaximo?: number;
    resolverNombres?: boolean;
    /** Nombres ya conocidos por RUT numerico — evita gastar un credito por nodo. */
    nombresConocidos?: Map<string, string>;
  } = {},
): Promise<CadenaPropiedad> {
  const umbral = opciones.umbralControl ?? UMBRAL_CONTROL;
  const umbralRegistro = opciones.umbralRegistro ?? UMBRAL_REGISTRO;
  const nivelMaximo = opciones.nivelMaximo ?? NIVEL_MAXIMO;
  const resolverNombres = opciones.resolverNombres ?? true;
  const nombresConocidos = opciones.nombresConocidos ?? new Map<string, string>();
  const llamadasInicio = client.llamadas;

  const entidades = new Map<string, EntidadCadena>();
  const relaciones = new Map<string, RelacionCadena>();
  let sinPorcentaje = 0;
  let truncada = false;

  const registrar = (rutNum: string, nivel: number) => {
    const previa = entidades.get(rutNum);
    // Una entidad puede aparecer por dos caminos; se queda con el más corto.
    if (previa) { previa.nivel = Math.min(previa.nivel, nivel); return; }
    entidades.set(rutNum, {
      rutNumerico: rutNum,
      rut: rutDesdeApi(rutNum),
      nombre: nombresConocidos.get(rutNum) ?? null,
      tipo: tipoEntidadPorRut(rutNum),
      nivel,
    });
  };
  registrar(raizRutNumerico, 0);

  let frente = [raizRutNumerico];
  const visitados = new Set<string>();

  for (let nivel = 0; nivel < nivelMaximo && frente.length > 0; nivel += 1) {
    const siguiente: string[] = [];
    for (const rut of frente) {
      if (visitados.has(rut)) continue;
      visitados.add(rut);

      const crudas = await client.relaciones(rut, 1);
      for (const rel of duenosDirectos(crudas, rut)) {
        const dueno = String(rel.target);
        const pct = porcentajeDe(rel);
        // Una participacion bajo el umbral es free float: se descarta entera,
        // sin registrar la entidad ni gastar un credito en pedirle el nombre.
        if (pct !== null && pct < umbralRegistro) continue;
        if (pct === null) sinPorcentaje += 1;
        registrar(dueno, nivel + 1);
        relaciones.set(`${dueno}:${rut}`, {
          duenoRut: dueno,
          poseidoRut: rut,
          porcentaje: pct,
          fuente: rel.information_source?.source ?? null,
          fechaFuente: rel.information_source?.started_at ?? null,
          esControl: pct !== null && pct >= umbral,
        });
        // Solo se sube por donde hay control: una participación minoritaria se
        // registra, pero seguir su cadena no dice de quién es el proyecto.
        if (pct !== null && pct >= umbral) {
          if (nivel + 1 < nivelMaximo) siguiente.push(dueno);
          else truncada = true;
        }
      }
    }
    frente = siguiente;
  }

  if (resolverNombres) {
    for (const entidad of entidades.values()) {
      if (entidad.nombre) continue;
      const { nombre } = await client.entidad(entidad.rutNumerico);
      entidad.nombre = nombre;
    }
  }

  return {
    raizRutNumerico,
    entidades: [...entidades.values()].sort((a, b) => a.nivel - b.nivel),
    relaciones: [...relaciones.values()],
    sinPorcentaje,
    truncada,
    llamadas: client.llamadas - llamadasInicio,
  };
}
