# Transition LATAM

Plataforma de inteligencia de mercado para la transición energética en Latinoamérica (ONIX Consulting Group). MVP enfocado en Chile.

La visión de producto, el modelo de datos, la arquitectura técnica/IA, el modelo de negocio, suscripciones, seguridad y el roadmap están documentados en [`/docs`](docs/) — empezar por [`docs/01-vision-producto.md`](docs/01-vision-producto.md) y [`docs/DECISIONS.md`](docs/DECISIONS.md) (registro de decisiones arquitectónicas).

**¿Retomando el proyecto con un asistente de IA (otra sesión, otra máquina)?** Leer primero [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md) — reglas de trabajo vigentes y resumen del estado/trabajo reciente.

## Stack

Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage). Ver [`docs/05-arquitectura-tecnica.md`](docs/05-arquitectura-tecnica.md).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con las credenciales de Supabase/IA
npm run dev
```

## Base de datos

Migraciones versionadas en [`supabase/migrations`](supabase/migrations/). Con Docker Desktop corriendo:

```bash
npx supabase start   # levanta Postgres/Auth/Storage local y aplica las migraciones
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run lint` — ESLint
- `npm run typecheck` — chequeo de tipos (TypeScript strict mode)

## Estructura

```
/app          # rutas Next.js (App Router)
/lib          # lógica de dominio — data-access, entitlements, ai, leads, ingestion
/supabase     # migraciones y configuración de Supabase
/docs         # documentación de producto y arquitectura
/dataset      # datos de muestra provistos por ONIX (no se sube a git, ver .gitignore)
```
