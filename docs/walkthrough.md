# Engineering standards walkthrough

`AGENTS.md` establishes one repository-wide contract for human-assisted and autonomous coding tools. It was introduced to keep future work maintainable as the minimal application shell grows around the verified Supabase foundation.

- Features stay under `src/features/<feature-name>/`; components, hooks, domain logic, types, helpers, queries, and services have distinct responsibilities.
- Normal handwritten files should stay near 250–300 lines. Generated types, lockfiles, migrations, seeds, snapshots, and large fixtures are explicitly exempt when splitting would be misleading or unsafe.
- Vitest is the default test runner, with React Testing Library for UI behavior. New logic and bug fixes need proportionate tests.
- `supabase/migrations/` remains the database source of truth. Cloud changes require an ordered migration, review, safe dry-run, explicit authorization to apply, and schema verification.
- RLS, least-privilege grants, fixed `search_path` for security-definer functions, and browser-secret isolation are mandatory.
- Completion claims require actual results from the applicable typecheck, test, lint, build, and database checks. Skipped or structurally limited verification must be stated clearly.
