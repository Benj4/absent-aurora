# AGENTS.md - Absent Aurora

**Absent Aurora** is a PostgreSQL-backed time-series data platform for submitting, validating, and visualizing economic/social indicators with immutable audit trails and peer validation workflows. Built on Astro SSR with Supabase for auth and data persistence.

## Deep Dives
- Component & file map → [docs/components.md](docs/components.md)
- Development conventions -> [docs/conventions.md](docs/conventions.md)
- Database schema → [docs/database-schema.md](docs/database-schema.md)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js (Volta-pinned) | 24.12.0 |
| **Package Manager** | pnpm (Volta-pinned) | 10.26.1 |
| **Framework** | Astro (SSR + Static) | 5.16.6 |
| **Styling** | Tailwind CSS | 4.1.18 |
| **Database** | Supabase (PostgreSQL) | - |
| **Auth** | Supabase Auth | @supabase/auth-js |
| **Client SDK** | @supabase/supabase-js | 2.89.0 |
| **Testing** | Vitest + @vitest/ui | 4.0.16 |
| **TypeScript** | Strict mode | latest |

---

## Architecture

- **Hybrid SSR/Static**: Auth-gated pages use SSR; public routes are static
- **Database-First**: Immutability enforced at the schema level (`database/schema.sql`)
- **Event-Sourced Validations**: Append-only `serie_validations` tracks all peer review actions

```
serie_posts (immutable) ─┬─> serie_data (immutable)
                         └─> serie_validations (append-only)
```

Status transitions: `pending` → `approved|rejected` or any → `disabled` (soft delete only). No edits — new data = new post.

---

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Dashboard (BentoGrid with approved indicators) |
| `src/pages/login.astro` | Supabase Auth login/signup |
| `src/lib/supabase.ts` | **SINGLE SOURCE** for Supabase client + TypeScript types |
| `database/schema.sql` | Complete DDL — tables, views, indexes, RLS policies |
| `src/data/indicators.json` | 2119-line indicator catalog |


---

## Dev Workflow

```bash
pnpm install
pnpm dev          # localhost:4321
pnpm build
pnpm test         # Vitest once
pnpm test:watch
pnpm test:ui
```

**Env files**: `.env` (dev) · `.env.test` (test — needs `SUPABASE_SERVICE_ROLE_KEY`, `TEST_USER_*`)  
**Migrations**: Apply `database/schema.sql` manually in the Supabase SQL editor. No migration runner.

---

## Critical Gotchas

1. **Supabase Client Singleton**: Import from `src/lib/supabase.ts` — multiple instances break auth state
2. **Immutable Posts**: Only `status = 'disabled'` updates allowed — all other changes require new post
3. **Spanish UI**: All user-facing text must be in Spanish
4. **English code**: All variable/function names, comments, and documentation must be in English
5. **Tailwind 4.x**: PostCSS plugin syntax differs from v3
6. **Date Format Mismatches**: Frequency must match date format in `serie_data` (annual: `YYYY`, monthly: `YYYY-MM-DD`)
7. **Validation Uniqueness**: DB constraint prevents same user validating same post twice
8. **Environment Variables**: Client-side must use `import.meta.env.PUBLIC_*`, not `process.env`
9. **Volta Lock**: Node 24.12.0 + pnpm 10.26.1 are locked — don't override

---


## Agent Guidelines

### When generating code
- Check `src/lib/supabase.ts` for existing types before creating new ones
- Extract reusable logic to `src/lib/` rather than duplicating in pages
- Preserve Tailwind config and CSS variable naming

### When suggesting changes
- Include imports from exact paths
- Show TypeScript interfaces for new data structures
- Provide Tailwind class examples consistent with theme
- Include both server-side (front matter) and client-side (`<script>`) approaches when applicable

### File map maintenance
**Whenever a file is created or deleted inside `src/`, update [docs/components.md](docs/components.md) in the same operation:**
- Add new files to the source tree and the relevant component group table
- Remove deleted files from both the source tree and all group tables
- If a new logical group is introduced, add a new table section for it

---

**Last Updated**: 2026-04-30 · **Version**: 0.0.2 · **Status**: Active Development
