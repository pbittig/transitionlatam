const BASE_URL = "https://sipub.api.coordinador.cl";

function apiKey(): string {
  const key = process.env.COORDINADOR_SIPUB_API_KEY;
  if (!key) throw new Error("COORDINADOR_SIPUB_API_KEY no está configurada en .env.local");
  return key;
}

/** GET contra la API SIPUB del Coordinador, autenticado por query param `user_key` (ver ADR-019). */
export async function sipubGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", apiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new Error(`SIPUB ${path} respondió ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Detecta el sufijo `[NO_MOSTRAR]`/`[No_Mostrar]` (case-insensitive) que el Coordinador usa para borradores internos. */
export function isMarkedHidden(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\[no[_ ]?mostrar\]/i.test(text);
}

/** Quita los sufijos de anotación interna (`[NO_MOSTRAR]`, `[EN_REVISION]`, etc.) para dejar el nombre limpio. */
export function stripAnnotations(text: string): string {
  return text.replace(/\s*\[[a-z_ ]+\]\s*/gi, " ").trim();
}
