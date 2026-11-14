# Absent Aurora

Absent Aurora is a time-series data platform for submitting, reviewing, and visualizing economic and social indicators. It uses Astro with React islands for the interface and Supabase for authentication and PostgreSQL persistence.

## Current capabilities

- Submit annual, quarterly, and monthly indicator series.
- Review posts through Supabase-backed validation workflows.
- Browse approved indicator data and compare available sources.
- Create and view analyses with periods, source selections, and macro-event markers.
- Manage personal posts, reviews, and analyses.

## Stack

- Node.js and pnpm versions are specified in `mise.toml`.
- Astro, React, TypeScript, Tailwind CSS, and DaisyUI versions are specified in `package.json`.
- Supabase Auth and PostgreSQL.
- Vitest for Supabase integration tests.
- Cloudflare Workers Static Assets configuration for production from `master`; cutover is pending. GitHub Pages remains active from `staging` until Cloudflare validation. See [deployment and rollback](docs/deployment.md).

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

For a local Supabase environment, install and start Docker, then run `pnpm run supabase:start`. Use the local API URL and anonymous key shown by `pnpm run supabase:status` in `.env.local`; this file takes precedence over `.env` and is ignored by Git. Run `pnpm run supabase:stop` when finished. The first start downloads the container images and applies the migrations. Automatic seeding is disabled; no seed file is provided.

Run `pnpm run supabase:clean` to delete local application records without restarting containers. It preserves Auth users and their roles, the current schema and migration history, and does not remove Storage objects or other Supabase service data. This operation cannot be undone. Use `pnpm run supabase:reset` instead to recreate the local database and reapply migrations; it recreates the PostgreSQL container and restarts dependent services.
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
| `/eventos` | Public macro-event catalog and role-based management |
| `/admin/macro-events` | Redirect to the macro-event catalog |

Cloudflare builds use root routes. The explicit `DEPLOY_TARGET=github-pages` rollback build includes the repository base path. `GITHUB_ACTIONS` alone never changes routing.

## Cloudflare migration (ZEH-21)

Candidate URL: https://absent-aurora.bdiazcaballero.workers.dev (not deployed or verified yet).
The account and its `bdiazcaballero.workers.dev` subdomain were confirmed through `cf`.
Production remains https://benj4.github.io/absent-aurora/ until cutover is verified.

`pnpm run build:cloudflare` runs checks, builds Astro, and packages `dist` as assets-only Cloudflare Build Output. `pnpm run deploy:dry-run` also validates that output with `cf` without uploading it. `pnpm run deploy` is reserved for the Workers Builds `master` trigger and rejects other branches and stale commits. Configure the connected build as documented in [deployment and rollback](docs/deployment.md); repository files alone do not enable automatic deployment.

Create a migration with `pnpm run supabase:migration:new <name>`.

## Commands

```bash
pnpm dev                 # development server
pnpm build               # production build
pnpm preview             # preview the production build
pnpm test:integration    # RLS tests against an isolated Supabase test project
pnpm generate:types      # generate official TypeScript types from the linked database
pnpm generate:indicator-map
```

The RLS suite is intentionally isolated behind `pnpm test:integration`.

### Supabase integration-test safety

Copy `.env.test.example` to `.env.test` and use only a local Supabase instance or a dedicated remote test project. Remote execution requires all of the following:

- `ALLOW_SUPABASE_INTEGRATION_TESTS=true`.
- `SUPABASE_TEST_PROJECT_REF` matching the hostname in `SUPABASE_URL`.
- A service-role key belonging to that test project.

The suite creates unique users for each run and deletes only posts owned by those users. Never point `.env.test` at production.

## Documentation

- [Agent instructions](AGENTS.md)
- [Product purpose and constraints](PRODUCT.md)
- [Visual system](DESIGN.md)
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

## Manual browser E2E

Chrome Recorder baselines and AI-derived Puppeteer cases are isolated from unit tests and CI. See [the manual workflow](docs/e2e.md). Execute only on human request with `pnpm run e2e:replay <recording.json>` or `pnpm run e2e:test`.

Set `E2E_BASE_URL=http://localhost:4321/` in `.env.local` (also documented in `.env.example`); the E2E tools load `.env.local` before `.env`, with shell variables taking precedence. Supabase availability is checked through its public JWKS endpoint without Docker CLI access.

Run `pnpm run e2e:doctor` to check the running Astro application, its local Supabase configuration and services, and Chrome launch/cleanup without executing recorded actions. Start services manually; failed prerequisites show the commands needed to fix them.
