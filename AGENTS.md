# Agent Guidelines & Engineering Standards — ITD336

These rules apply to every AI coding agent working in this repository, including Codex, Gemini CLI, Claude, Cursor, GitHub Copilot, Antigravity, and future tools. Human instructions for a task take precedence, but an agent must call out conflicts with safety, security, or database-history requirements rather than silently ignoring them.

## 1. Project principles

- Prefer maintainability over fast monolithic generation.
- Preserve the feature-driven architecture.
- Treat database safety and migration history as first-class concerns.
- Keep business rules explicit, configurable, and documented.
- Write testable code and add tests for non-trivial behavior.
- Minimize duplication, especially business and authorization logic.
- Apply least privilege and security by default.
- Never claim verification that was not actually executed successfully.
- Modify the smallest reasonable scope needed for the task.
- Avoid unrelated rewrites, dependency churn, and speculative abstractions.

## 2. Feature-driven architecture

Application features belong under `src/features/<feature-name>/`. Extend the existing structure rather than moving everything into generic top-level folders.

```text
src/features/<feature-name>/
├── components/
├── hooks/
├── lib/
├── types/
├── utils/
├── *.queries.ts
├── *.service.ts
└── index.ts
```

Create only the directories a feature needs:

- `components/`: presentational and interactive React components.
- `hooks/`: React state, effects, TanStack Query hooks, and UI orchestration.
- `lib/`: domain engines, API wrappers, and reusable feature logic.
- `types/`: TypeScript models, feature schemas, and appropriate enums.
- `utils/`: pure, stateless helpers.
- `*.queries.ts`: query-key factories and query definitions.
- `*.service.ts`: Supabase data access and RPC wrappers.
- `index.ts`: optional intentional public API; do not create barrel cycles.

Do not place an entire feature in one component or service file. Components should compose behavior rather than own database queries, validation engines, formatting, and every UI section at once.

## 3. Shared infrastructure

`src/lib/supabase/` is reserved for the Supabase client, generated database types, and genuinely shared Supabase helpers.

Use `src/shared/` only when shared UI, generic helpers, or common types are introduced and are truly reused across features. Do not move feature-specific logic into a shared directory merely for convenience or anticipated reuse.

Avoid circular feature dependencies. Extract a stable shared primitive only after its cross-feature responsibility is clear.

## 4. File and component size limits

Keep normal handwritten application files approximately 250–300 lines or fewer. This is a design signal, not a reason for arbitrary fragmentation. When a React component grows too large:

1. extract state, effects, and server-state orchestration into hooks;
2. split meaningful UI sections into components;
3. move transformations and calculations to `utils/` or `lib/`;
4. move models and schemas to `types/`;
5. move database access into query or service modules.

The limit does not automatically apply to generated files, `database.types.ts`, lockfiles, migration SQL, schema snapshots, seed files, large test fixtures, or machine-generated artifacts. Do not split a migration merely to satisfy a line count when doing so harms transactional correctness or ordering. Do not manually edit generated files unless their documented generation process requires it.

## 5. Supabase database rules

Files under `supabase/migrations/` are the source of truth for database structure.

Agents must not:

- manually change Supabase Cloud and leave migrations out of sync;
- casually delete historical migrations;
- rewrite an applied migration without understanding remote migration history;
- bypass database constraints with frontend-only checks;
- duplicate critical business rules only in React code;
- run destructive or production database commands without explicit authorization.

For a new database change:

1. create a new, ordered migration;
2. preserve existing migration history;
3. review SQL, dependencies, grants, and rollback implications;
4. run a dry-run when the CLI and environment support it;
5. apply only when the task authorizes the intended development environment;
6. verify the resulting schema and regenerate database types.

Never silently modify a production database. If the target environment cannot be confidently identified, stop and ask the user. Do not run `supabase db push` merely because general validation is requested.

## 6. Database business logic

Keep sensitive state transitions database-controlled where appropriate, including booking creation, approval, rejection, cancellation, key request, key approval, checkout, return, and audit insertion.

Prefer controlled RPC/functions to unrestricted direct table updates. Frontend code may validate for usability, but it must not become the only enforcement of scheduling conflicts, permissions, status transitions, or key uniqueness.

## 7. Supabase security

Require RLS on sensitive application tables, least-privilege grants, permission-based authorization, and careful `anon`/`authenticated` access.

Normal clients must not be able to approve their own bookings, arbitrarily change booking status, fake key returns, modify audit logs, or assign themselves roles or permissions.

Every `SECURITY DEFINER` function must:

- set an explicit safe `search_path`;
- validate caller authentication and authorization;
- avoid caller-controlled privilege escalation;
- qualify database objects where appropriate;
- remain narrowly scoped.

Never expose a service-role key, database password, Supabase secret key, private API token, or other privileged credential to frontend code. Never place privileged secrets in a `VITE_*` variable. Do not print secrets in logs, diffs, test output, or completion reports.

## 8. Generated database types

The generated Supabase type file lives at `src/lib/supabase/database.types.ts`. Treat it as generated code. Do not redesign, partially edit, or weaken it manually.

After meaningful schema changes, regenerate it with the appropriate Supabase CLI command. If regeneration reveals TypeScript errors, fix consuming application code instead of falsifying the generated types.

## 9. Requirement safety

Do not invent unresolved university policies. Pending decisions include university SSO, external users, booking limits, advance-booking rules, no-show penalties, retention, report formats, weekend/out-of-hours behavior, a housekeeper role, teacher auto-approval, recurring schedules, key-request rejection, and final booking lifecycle rules.

When behavior is unconfirmed, keep it configurable, document the assumption, and update `docs/pending-requirements.md`. Do not silently hard-code a permanent rule.

## 10. Testing guidelines

Use Vitest for unit/integration tests and React Testing Library for React behavior. New features and non-trivial logic require proportionate tests.

- Test pure functions in `utils/` and `lib/` with `*.test.ts`.
- Test complex components and forms with `*.test.tsx`.
- Add a regression test for a bug fix whenever practical.
- Cover normal flows, boundaries, invalid inputs, and authorization-sensitive behavior where feasible.
- Prefer behavior assertions over implementation-detail assertions.
- Do not add meaningless tests solely to increase test counts.

## 11. Database testing

Database work needs more than frontend tests. Review or test migration execution, constraints, RLS, grants, RPC authorization, booking conflicts, invalid transitions, duplicate key checkout, loan uniqueness, and audit behavior as applicable. Extend `supabase/tests/` when appropriate.

If authenticated end-to-end testing cannot be performed, state `NOT RUN — AUTH TEST USERS REQUIRED`. If only catalogs or SQL structure were checked, state `PARTIAL — STRUCTURAL VERIFICATION ONLY`. Never label either situation as a complete pass.

## 12. Tailwind CSS v4 strict rules

This repository uses Tailwind CSS v4. Follow v4 canonical conventions:

- Never use `break-words`; use `wrap-break-word`.
- Prefer CSS-variable utilities such as `w-(--name)`, `h-(--name)`, and `bg-(--name)` over `w-[var(--name)]`, `h-[var(--name)]`, and `bg-[var(--name)]`.
- Prefer standard scale utilities such as `max-w-7xl` when an equivalent token exists.
- Prefer `aspect-video` over a manually reproduced 16:9 ratio.
- Prefer dedicated utilities such as `bg-[radial-gradient(...)]` and `bg-size-[28px_28px]` over raw `[background-image:...]` or `[background-size:...]` properties.
- Move very large multi-layer gradients or other semantic styling to the project stylesheet instead of embedding them in React `className` strings.

## 13. TanStack Query and data access

Use this dependency direction where appropriate:

```text
component → hook/query → service → Supabase query/RPC
```

Do not put large inline Supabase queries in components. Use stable query-key factories, keep server state in TanStack Query, and do not scatter unrelated literal query-key arrays throughout the application.

## 14. TypeScript rules

Use strict TypeScript. Avoid `any` unless technically unavoidable and documented. Prefer generated database types and derive aliases from them when useful. Do not duplicate database enums when generated types already express them.

Do not silence errors with broad casts, `@ts-ignore`, disabled lint rules, or non-null assertions simply to make a build pass. A narrow cast at a validated serialization boundary must be explained by the surrounding type contract.

## 15. Error handling

Do not silently swallow Supabase, network, or API errors. Service functions must provide consistent, meaningful error behavior. UI code should eventually translate technical failures into understandable messages without exposing SQL errors, secrets, internal identifiers, or connection information.

## 16. Git safety

Before completing significant changes, run `git status`, review the diff, and run `git diff --check`. Do not commit secrets, local `.env` files, generated cloud-link state, dependencies, or build output.

Never force-push unless the user explicitly authorizes it. Avoid mixing unrelated changes in one commit and do not rewrite remote history to simplify a task. Preserve user changes in a dirty worktree.

## 17. Documentation

Update relevant documentation whenever architecture, database behavior, permissions, setup, or business rules change. Existing sources include:

- `docs/architecture.md`
- `docs/database-schema.md`
- `docs/booking-flow.md`
- `docs/key-flow.md`
- `docs/permissions.md`
- `docs/pending-requirements.md`

Do not let implementation and documentation drift substantially apart.

## 18. Definition of done

Run the applicable repository checks before claiming a normal coding task is complete:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

If a script does not exist or cannot run, report that fact; do not claim it passed. Database changes also require safe, environment-appropriate verification, which may include `npx supabase db push --dry-run`. A cloud database push requires explicit task authorization and is never an automatic validation step.

No check may be reported as passing unless it actually completed successfully.

## 19. Task completion report

Summarize files modified, architecture changes, tests added, commands executed, typecheck/test/lint/build results, database verification where applicable, skipped checks, and unresolved warnings. Keep the report evidence-based and never conceal partial or skipped verification.
