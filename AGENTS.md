# AGENTS.md — Absent Aurora

Absent Aurora is an Astro and Supabase application for publishing, validating, and visualizing economic and social time-series data. This file is the stable operating contract for AI agents working in the repository.

## Read first

- Domain ownership and entry points: [docs/components.md](docs/components.md)
- Coding and UI conventions: [docs/conventions.md](docs/conventions.md)
- Database concepts and operational notes: [docs/database-schema.md](docs/database-schema.md)
- Human setup and commands: [README.md](README.md)

## Sources of truth

| Concern | Source |
|---|---|
| Dependencies, versions, commands | `package.json` |
| Astro build and base path | `astro.config.mjs` |
| Supabase client | `src/lib/supabase.ts` |
| Generated database interfaces | `src/types/database.types.ts` |
| Type generator | `scripts/generate-types.ts` |
| Database migrations and CLI configuration | `supabase/migrations/`, `supabase/config.toml` |
| Indicator catalog | `src/data/indicators.json` |
| CI deployment behavior | `.github/workflows/astro.build.yml` |

Do not copy versions into documentation when they can be read from `package.json`. If documentation conflicts with executable configuration or schema, treat the executable source as authoritative and update the documentation in the same change.

## Current architecture

- Astro 6 generates the route shell and the GitHub Pages build.
- React islands implement interactive forms, charts, authentication state, and data loading.
- Supabase provides browser authentication and PostgreSQL access.
- `src/lib/supabase.ts` is the only application client instance. Tests use isolated clients under `tests/utils/`.
- Database interfaces are generated into `src/types/database.types.ts` and re-exported by `src/lib/supabase.ts`.
- GitHub Pages builds from `staging`; the repository base path is added only during GitHub Actions builds.

Use Supabase CLI migrations in `supabase/migrations/` for database changes. Capture remote schema with `supabase db pull` and review generated SQL before committing. Remote migration application requires authorization. Run `pnpm generate:types` after schema changes to introspect the linked database with the official CLI.

## Non-negotiable rules

1. All user-facing text must be in Spanish.
2. Code identifiers, comments, and technical documentation must be in English.
3. Import the application Supabase client from `src/lib/supabase.ts`; do not create another application client.
4. Import existing database types instead of redefining table interfaces.
5. Preserve post immutability semantics. A content correction creates a new post; disabling is the soft-removal mechanism.
6. Match dates to frequency: annual uses `YYYY`; monthly and quarterly use `YYYY-MM-DD`.
7. Use `import.meta.env.PUBLIC_*` in browser code. Never expose service-role credentials to the application bundle.
8. Do not edit generated `src/types/database.types.ts` manually.
9. Do not hand-edit vendored `.agents/skills/` content unless the task is explicitly about maintaining that skill. Preserve `skills-lock.json` provenance.
10. Preserve unrelated working-tree changes. The repository may already contain user work.

## Safe commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:watch
pnpm test:ui
pnpm generate:types
```

`pnpm test` runs only `tests/unit/**/*.test.ts` and never loads Supabase credentials.

### Integration tests require explicit authorization

`pnpm test:integration` uses a Supabase service-role key, creates users, and mutates database rows. Run it only when all of these are true:

- The task requires database integration or RLS verification.
- `.env.test` targets a local or dedicated test project, never production.
- `ALLOW_SUPABASE_INTEGRATION_TESTS=true` is set intentionally.
- For a remote project, `SUPABASE_TEST_PROJECT_REF` matches `SUPABASE_URL`.

The cleanup helper must always receive the exact user IDs created by the current run. Never restore broad predicates such as deleting every row where an ID differs from a sentinel value.

## Change workflow

1. Inspect the relevant domain in `docs/components.md` and read the implementation before editing.
2. Check `src/lib/supabase.ts` and generated types before adding data structures.
3. Keep routes thin: route files assemble layouts and domain components; reusable behavior belongs in components or `src/lib/`.
4. Handle every Supabase `error` before consuming `data`, and show Spanish user-facing failures.
5. Update documentation when commands, domain ownership, routes, or invariants change.
6. Validate in proportion to the change.

| Change | Minimum validation |
|---|---|
| Documentation only | Check paths, commands, and links against the repository |
| TypeScript, React, or Astro | `pnpm build` and relevant unit tests |
| Generated database interfaces | `pnpm generate:types`, inspect the diff, then `pnpm build` |
| SQL or RLS | Review all migration SQL files; run integration tests only against an isolated test project |
| Route or domain ownership | Update `docs/components.md` |

## Placement rules

- `src/pages/`: routing and page composition.
- `src/components/analysis-builder/`, `macro-events/`, and `user/`: domain-specific UI.
- `src/components/`: shared UI and legacy domain components not yet grouped.
- `src/lib/`: reusable application and data-access logic, not visual components.
- `src/types/database.types.ts`: generated database declarations.
- `tests/unit/`: isolated tests with no external services.
- `tests/rls/`: Supabase integration tests.

`docs/components.md` is a domain map, not a manually maintained full file tree. Update it only when a route, domain boundary, important entry point, or placement rule changes.

**Last reviewed:** 2026-08-27

**Package version:** 0.0.1
