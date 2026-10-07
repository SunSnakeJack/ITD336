# University Room Booking & Key Management

Backend/database foundation for a traceable university room-booking and physical-key workflow. The React application is intentionally a compile-only placeholder; business-critical operations live in PostgreSQL RPCs and are protected by Supabase Auth, permissions, grants, and RLS.

## Stack

React 19, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS 4, Supabase Auth/Database/Storage-ready PostgreSQL. Deployable to Vercel after environment variables are configured.

## Structure

```text
src/features/          Typed data-access services and query keys
src/lib/supabase/      Browser-safe Supabase client
supabase/migrations/   Schema, transactional RPCs, views, RLS, indexes
supabase/seed.sql      Idempotent development reference data
supabase/tests/        SQL verification checklist
docs/                  Architecture and workflow decisions
```

## Local setup

1. Copy `.env.example` to `.env.local`; provide the local/project URL and anon key. Never put a service-role key in a `VITE_` variable.
2. Run `npm install` and `npm run dev`.
3. Install the Supabase CLI separately, then run `supabase start` and `npm run db:reset`. This applies migrations and `seed.sql`.
4. Create test users through Supabase Auth. The auth trigger creates their profile. Assign roles through a trusted admin/server path, not browser code.
5. Generate exact types from the linked development project with `npm run db:types`, or use `npm run db:types:local` when a local database is intentionally running.

## Development commands

```bash
npm run typecheck
npm run lint
npm run build
npm run db:reset
```

Future clients should read through the modules under `src/features`. Use RPCs for booking creation/approval/cancellation and key state transitions. Do not duplicate availability or authorization rules in UI code.

See [architecture](docs/architecture.md), [database schema](docs/database-schema.md), [permissions](docs/permissions.md), and [pending decisions](docs/pending-requirements.md).
