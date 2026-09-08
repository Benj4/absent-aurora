# Absent Aurora

Absent Aurora is a time-series data platform for submitting, reviewing, and visualizing economic and social indicators. It uses Astro with React islands for the interface and Supabase for authentication and PostgreSQL persistence.

## Current capabilities

- Submit annual, quarterly, and monthly indicator series.
- Review posts through Supabase-backed validation workflows.
- Browse approved indicator data and compare available sources.
- Create and view analyses with periods, source selections, and macro-event markers.
- Manage personal posts, reviews, and analyses.

## Stack

- Node.js 24.12.0 and pnpm 10.26.1, pinned with Volta.
- Astro 6, React 19, TypeScript, Tailwind CSS 4, and DaisyUI.
- Supabase Auth and PostgreSQL.
- Vitest for unit and Supabase integration tests.
- GitHub Pages deployment from the `staging` branch.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The development server is available at `http://localhost:4321` by default. Configure these public variables in `.env`:

```dotenv
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

## Useful routes

| Route | Purpose |
|---|---|
| `/` | Indicator dashboard |
| `/login` | Authentication |
| `/postlist` | Post listing and filters |
| `/post?id={POST_ID}` | Post detail and validation |
| `/indicators/{ID}/data` | Approved series and source comparison |
| `/series/{frequency}/{ID}` | Submit an indicator series |
| `/analisis` | View an analysis selected by query parameter |
| `/analisis/nuevo` | Create an analysis |
| `/analisis/editar` | Edit an analysis |
| `/user` | Current user's posts |
| `/user/reviews` | Current user's reviews |
| `/user/analisis` | Current user's analyses |
| `/admin/macro-events` | Macro-event administration |

When the site is built for GitHub Pages, routes include the repository base path configured by Astro.

## Commands

```bash
pnpm dev                 # development server
pnpm build               # production build
pnpm preview             # preview the production build
pnpm test                # local unit tests; does not contact Supabase
pnpm test:watch          # unit tests in watch mode
pnpm test:ui             # unit-test UI
pnpm test:integration    # RLS tests against an isolated Supabase test project
pnpm generate:types      # generate official TypeScript types from the linked database
pnpm generate:indicator-map
```

There are currently no unit test files, so `pnpm test` succeeds without executing cases. The existing RLS suite is intentionally isolated behind `pnpm test:integration`.

### Supabase integration-test safety

Copy `.env.test.example` to `.env.test` and use only a local Supabase instance or a dedicated remote test project. Remote execution requires all of the following:

- `ALLOW_SUPABASE_INTEGRATION_TESTS=true`.
- `SUPABASE_TEST_PROJECT_REF` matching the hostname in `SUPABASE_URL`.
- A service-role key belonging to that test project.

The suite creates unique users for each run and deletes only posts owned by those users. Never point `.env.test` at production.

## Documentation

- [Agent instructions](AGENTS.md)
- [Domain and component map](docs/components.md)
- [Development conventions](docs/conventions.md)
- [Database guide](docs/database-schema.md)

### Database migrations

Use the Supabase CLI dependency with `pnpm exec supabase` (or `supabase` when installed on PATH). Docker must be running and accessible to your user. After joining the Docker group, log out and back in to refresh group membership.

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref yrffsentjvbkoycyxbdb
pnpm exec supabase db pull
pnpm exec supabase migration list
```

`db pull` captures remote schema changes in `supabase/migrations/`. It may ask to record the generated migration as applied in the remote migration history. Review and commit the generated SQL. Credentials and project-link cache stay outside version control.

Create subsequent changes with `pnpm exec supabase migration new <name>`, edit the generated SQL, and validate against a local or dedicated test database. Use `pnpm exec supabase db push --dry-run` to review pending migrations before an explicitly authorized remote deployment.

Run `pnpm generate:types` after schema changes to refresh `src/types/database.types.ts` using the official CLI. Use `pnpm generate:types --local` for a running local database after applying migrations. Commit the generated file; builds do not require CLI authentication. The singleton client uses `createClient<Database>` and exports table aliases and the official `Tables`, `TablesInsert`, `TablesUpdate`, and `Enums` helpers. `pnpm check` validates TypeScript and also runs in CI before building.

Official reference: [Supabase TypeScript generation](https://supabase.com/docs/guides/api/rest/generating-types).
