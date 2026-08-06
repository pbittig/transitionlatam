const PGP_BASE_URL = "https://pgp.coordinador.cl";

interface RawPgpRequest {
  id?: string;
  _id?: string | { $oid?: string };
  correlativo?: string | number | null;
  nup?: string | null;
  completition_status?: number | string | null;
  name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PgpProjectProgress {
  pgpId: string;
  nup: string;
  projectName: string | null;
  progressPercent: number;
  sourceUrl: string;
  raw: RawPgpRequest;
}

function rowsFromPayload(payload: unknown): RawPgpRequest[] {
  if (Array.isArray(payload)) return payload as RawPgpRequest[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["data", "results", "irequests", "requests", "items", "docs"]) {
    if (Array.isArray(value[key])) return value[key] as RawPgpRequest[];
    if (value[key] && typeof value[key] === "object") {
      const nested = rowsFromPayload(value[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function pgpId(row: RawPgpRequest): string | null {
  if (typeof row.id === "string") return row.id;
  if (typeof row._id === "string") return row._id;
  if (row._id && typeof row._id === "object" && row._id.$oid) return row._id.$oid;
  return null;
}

async function fetchPgpRows(queryNup: string): Promise<RawPgpRequest[]> {
  const params = new URLSearchParams({ page: "1", per_page: "10", project: queryNup });
  const response = await fetch(`${PGP_BASE_URL}/api/request/irs?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "Transition-Latam-PGP-Sync/1.0" },
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PGP respondió ${response.status} ${response.statusText}`);

  const payload = await response.json() as unknown;
  const rows = rowsFromPayload(payload);
  return rows;
}

function normalizeNup(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Queries only eligible NUPs; the unfiltered endpoint embeds full phase trees and is very large. */
export async function fetchPgpProjectProgress(nups: string[]): Promise<PgpProjectProgress[]> {
  const uniqueNups = [...new Set(nups.map((nup) => nup.trim()).filter(Boolean))];
  const rows: RawPgpRequest[] = [];
  const concurrency = 5;
  for (let index = 0; index < uniqueNups.length; index += concurrency) {
    const batch = uniqueNups.slice(index, index + concurrency);
    const results = await Promise.all(batch.map((nup) => fetchPgpRows(nup)));
    rows.push(...results.flat());
  }

  const parsed = rows.flatMap((row) => {
    const id = pgpId(row);
    const nup = String(row.correlativo ?? row.nup ?? "").trim();
    const progress = Number(row.completition_status);
    if (!id || !nup || !uniqueNups.some((candidate) => normalizeNup(candidate) === normalizeNup(nup)) || !Number.isFinite(progress) || progress < 0 || progress > 100) return [];
    return [{
      pgpId: id,
      nup,
      projectName: row.name ?? null,
      progressPercent: progress,
      sourceUrl: `${PGP_BASE_URL}/irequests/${id}`,
      raw: row,
    }];
  });

  // PGP can contain historical/re-staged records with the same correlativo.
  // Keep the most recently updated record so one NUP maps to one observation.
  const latestByNup = new Map<string, PgpProjectProgress>();
  for (const row of parsed) {
    const key = normalizeNup(row.nup);
    const current = latestByNup.get(key);
    const rowDate = Date.parse(row.raw.updated_at ?? row.raw.created_at ?? "") || 0;
    const currentDate = current ? Date.parse(current.raw.updated_at ?? current.raw.created_at ?? "") || 0 : -1;
    if (!current || rowDate > currentDate) latestByNup.set(key, row);
  }
  return [...latestByNup.values()];
}
