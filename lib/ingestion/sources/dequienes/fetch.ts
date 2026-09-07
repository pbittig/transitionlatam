/**
 * Cliente de la API de dequienes.cl — relaciones societarias desde registros
 * públicos (SII, CMF, Diario Oficial).
 *
 * Autenticación por header `x-api-key`, sin prefijo Bearer.
 *
 * Sobre el costo: cada llamada consume un crédito del tope de la cuenta, tanto
 * las de grafo como las de entidad. La tabla de facturación publicada no lista
 * `graph/relationships`, pero medido contra `billing/credits` sí descuenta
 * (verificado 2026-09-06). Por eso el cliente lleva la cuenta de llamadas y el
 * sincronizador acota la expansión del grafo.
 */

const BASE = "https://dequienes.cl/api";

export class DequienesError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DequienesError";
  }
}

/** Las relaciones vienen con los nodos como RUT numérico, sin nombre. */
export interface RelacionCruda {
  source: string;
  target: string;
  label: "OWNED_BY" | "REPRESENTED_BY" | string;
  information_source?: {
    source?: string;
    started_at?: string;
    shares_percent?: number;
    shareholder_pct?: number;
    [k: string]: unknown;
  };
}

export interface Creditos {
  request_cap: number;
  consumed_credits: number;
  updated_at?: string;
  last_reset_at?: string | null;
}

export interface OpcionesCliente {
  apiKey: string;
  timeoutMs?: number;
  reintentos?: number;
}

export class DequienesClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly reintentos: number;
  /** Llamadas efectivamente enviadas: es lo que se descuenta del tope. */
  llamadas = 0;

  constructor({ apiKey, timeoutMs = 20_000, reintentos = 3 }: OpcionesCliente) {
    if (!apiKey) throw new DequienesError("Falta DEQUIENES_API_KEY");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.reintentos = reintentos;
  }

  private async pedir<T>(ruta: string, cuentaCredito = true): Promise<T> {
    let ultimo: unknown;
    for (let intento = 0; intento <= this.reintentos; intento += 1) {
      const control = new AbortController();
      const corte = setTimeout(() => control.abort(), this.timeoutMs);
      try {
        if (cuentaCredito) this.llamadas += 1;
        const res = await fetch(`${BASE}${ruta}`, {
          headers: { "x-api-key": this.apiKey, accept: "application/json" },
          signal: control.signal,
        });
        // 429 y 5xx son transitorios: se reintentan con espera creciente.
        if (res.status === 429 || res.status >= 500) {
          ultimo = new DequienesError(`HTTP ${res.status} en ${ruta}`, res.status);
          const espera = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** intento;
          await new Promise((r) => setTimeout(r, espera));
          continue;
        }
        if (!res.ok) {
          throw new DequienesError(`HTTP ${res.status} en ${ruta}: ${(await res.text()).slice(0, 200)}`, res.status);
        }
        return (await res.json()) as T;
      } catch (error) {
        if (error instanceof DequienesError && error.status && error.status < 500 && error.status !== 429) throw error;
        ultimo = error;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** intento));
      } finally {
        clearTimeout(corte);
      }
    }
    throw new DequienesError(`Sin respuesta tras ${this.reintentos + 1} intentos en ${ruta}: ${String(ultimo)}`);
  }

  /** Estado del cupo. No descuenta crédito. */
  async creditos(): Promise<Creditos> {
    return this.pedir<Creditos>("/billing/credits", false);
  }

  /**
   * Relaciones de una entidad. `distancia` es el número de saltos en el grafo:
   * con 1 se obtienen los dueños y representantes directos; subir a 2 o más
   * arrastra la red accionaria completa (en una sociedad abierta son cientos de
   * aristas hacia AFP y bancos, con participaciones bajo el 1%).
   */
  async relaciones(rutNumerico: string, distancia = 1): Promise<RelacionCruda[]> {
    const datos = await this.pedir<{ relationships?: RelacionCruda[] }>(
      `/graph/relationships/${rutNumerico}?distance=${distancia}`,
    );
    return datos.relationships ?? [];
  }

  /** Nombre y metadatos de una entidad. El grafo solo entrega RUT. */
  async entidad(rutNumerico: string): Promise<{ nombre: string | null; tipo: string | null }> {
    const datos = await this.pedir<{ fields?: { name?: string; sddocname?: string } }>(`/entity/${rutNumerico}`);
    return { nombre: datos.fields?.name ?? null, tipo: datos.fields?.sddocname ?? null };
  }
}
