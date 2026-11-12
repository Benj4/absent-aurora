# AGENTS.md — Absent Aurora

Absent Aurora is an Astro and Supabase application for publishing, validating, and visualizing economic and social time-series data. This file is the stable operating contract for AI agents working in the repository.

## Read first

- Product purpose and constraints: [PRODUCT.md](PRODUCT.md)
- Visual system and theme boundaries: [DESIGN.md](DESIGN.md)
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

- Astro generates the route shell and the GitHub Pages build.
- React islands implement interactive forms, charts, authentication state, and data loading.
- Supabase provides browser authentication and PostgreSQL access.
- `src/lib/supabase.ts` is the only application client instance. Tests use isolated clients under `tests/utils/`.
- Database interfaces are generated into `src/types/database.types.ts` and re-exported by `src/lib/supabase.ts`.
- GitHub Pages builds from `staging`; the repository base path is added only during GitHub Actions builds.

Use Supabase CLI migrations in `supabase/migrations/` for database changes. Capture remote schema with `supabase db pull` and review generated SQL before committing. Remote migration application requires authorization. Run `pnpm run generate:types` after schema changes to introspect the linked database with the official CLI.

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
11. Run project tasks only through scripts defined in `package.json`, using `pnpm run <script>`. Do not bypass them with direct executable calls or substitute servers such as `python -m http.server`. If a required task has no script, add an appropriate script to `package.json` before running it.
12. Never leave processes started for a task running after the task ends. Track any servers, watchers, and other long-running processes you start, stop them and their child processes before the final response, and verify that they have exited. Preserve processes that were already running before the task.
13. Whenever application behavior requires a role check, use the authenticated user's roles from the current session (`user.app_metadata.role`). Reuse `src/lib/use-auth-session.ts` and the normalization in `src/lib/auth-session.ts`; check exact role membership. Do not query `user_roles` or another database table to determine the current user's roles. Treat a missing session or missing roles as having no privileged role. Enforce protected operations in database policies as well, reading roles from the validated JWT's `app_metadata.role` via `auth.jwt()`; UI checks alone do not authorize an operation. Role changes take effect after the session token is refreshed.
14. Create or generate tests of any kind only when the user explicitly requests them. This restriction does not prevent running existing tests under the applicable safety rules.

## UI implementation

- Use DaisyUI component classes for controls and Tailwind utilities for layout, spacing, and responsive behavior.
- Reuse existing domain components and preserve route composition; extract shared components only for meaningful reuse or behavior.
- Keep Tailwind integration in `astro.config.mjs` and CSS configuration in `src/styles/global.css`.
- Define colors and radii in the active DaisyUI theme and consume its semantic variables; use the shared custom light/dark variants and keep editor-only layout overrides scoped to `.analysis-editor`. Avoid repeated literal values and duplicate CSS rules.
- Preserve DaisyUI focus indicators, dropdown arrows, disabled states, and native control behavior when adding CSS overrides.
- Keep `DESIGN.md` and `.impeccable/design.json` aligned with visual changes. These files document the design; they are not runtime style configuration.

## Safe commands

Use the scripts in `package.json` for development, builds, checks, tests, previews, and generators. Preview a production build with `pnpm run preview` after `pnpm run build`; do not serve the output with an ad hoc HTTP server. Long-running scripts must follow the process cleanup rule above.

```bash
pnpm run dev
pnpm run build
pnpm run check
pnpm run preview
pnpm run generate:types
```

### Integration tests require explicit authorization

`pnpm run test:integration` uses a Supabase service-role key, creates users, and mutates database rows. Run it only when all of these are true:

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
| TypeScript, React, or Astro | `pnpm run check`, `pnpm run build`, and relevant browser verification |
| Generated database interfaces | `pnpm run generate:types`, inspect the diff, then `pnpm run build` |
| SQL or RLS | Review all migration SQL files; run integration tests only against an isolated test project |
| Route or domain ownership | Update `docs/components.md` |

## Placement rules

- `src/pages/`: routing and page composition.
- `src/components/analysis-builder/`, `macro-events/`, and `user/`: domain-specific UI.
- `src/components/`: shared UI and legacy domain components not yet grouped.
- `src/lib/`: reusable application and data-access logic, not visual components.
- `src/types/database.types.ts`: generated database declarations.
- `tests/rls/`: Supabase integration tests.

`docs/components.md` is a domain map, not a manually maintained full file tree. Update it only when a route, domain boundary, important entry point, or placement rule changes.

**Last reviewed:** 2026-11-10

**Package version:** 0.0.1
