/**
 * Declaración mínima de `pg`, escrita a mano en vez de instalar `@types/pg`.
 *
 * El motivo no es evitar una dependencia: es que agregarla obliga a correr
 * `npm install`, y el `package-lock.json` de este repo se generó con npm 11+
 * mientras el VPS tiene npm 10.9.8, que al reescribirlo le borra 57 bloques de
 * metadata `libc` (ver docs/AI-HANDOFF.md, sesión 2026-08-11). La regla del
 * proyecto es `npm ci`, no `npm install`.
 *
 * Cubre solo lo que usa `scripts/check-project-visibility.ts`. Está tipada de
 * verdad y no como `any` a propósito: un `declare module "pg"` vacío apagaría
 * la comprobación de tipos en cualquier uso futuro sin que nadie lo note, que
 * es la misma clase de silencio que este chequeo vino a evitar.
 *
 * Si algún día se necesita más superficie de `pg` en TypeScript, conviene
 * instalar `@types/pg` de verdad — con npm 11 desde la PC, no desde el VPS.
 */
declare module "pg" {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
  }

  export interface ClientConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: { ca?: string; rejectUnauthorized?: boolean } | boolean;
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query<R = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
}
