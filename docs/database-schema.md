# Database Schema Guide - Absent Aurora

## Overview

This guide describes the data model and how to work with it safely in the app.

Core rules:
- Data submissions are immutable
- Validation history is append-only
- Posts move through controlled status transitions

---

## Data Model Definitions

### serie_posts
Purpose: metadata for each submission (one indicator per post).

Key fields:
- `id`: unique post identifier (UUID)
- `indicator_id`: indicator code (for example, `E01`, `S15`)
- `submitted_by`: user who created the post
- `data_source`: data origin name
- `url`: optional source URL
- `frequency`: `monthly`, `annual`, or `quarterly`
- `status`: `pending`, `approved`, `rejected`, or `disabled`
- `notes`: optional reviewer or author notes
- `submitted_at`, `created_at`, `updated_at`: lifecycle timestamps

Business constraint:
- Post content is immutable. Only status transitions are allowed.

### serie_data
Purpose: time-series points attached to a post.

Key fields:
- `id`: unique row identifier
- `post_id`: parent post reference
- `date`: time point
- `value`: numeric value

Format rules:
- Annual series use `YYYY`
- Monthly and quarterly series use `YYYY-MM-DD`

Relationship:
- One post has many data points.

### serie_validations
Purpose: event log of peer validations.

Key fields:
- `id`: unique validation event id
- `post_id`: referenced post
- `validated_by`: reviewer user id
- `validated_at`: validation timestamp
- `validation_status`: `approved` or `rejected`
- `validation_notes`: optional reviewer notes

Constraint:
- A user can validate the same post only once.

---

## Derived Views

### duplicate_data_detector
Purpose: highlights duplicated indicator/source/date/value points across posts.

Usage:
- Review possible duplicated submissions
- Support moderation and quality checks

### validation_summary
Purpose: summarizes validations per post.

Usage:
- Show approval/rejection totals
- Build validation dashboards and review queues

---

## Analysis Domain Definitions

These tables store the `AnalysisState` from the analysis form.

### analysis
Root analysis record.

Maps:
- `titulo` -> `title`
- `descripcion` -> `description`
- `modoAlineacion` -> `alignment_mode`
- `region` -> `region`
- `showBase100Line` -> `show_base100`

### analysis_indicators
Stores selected indicators for an analysis, preserving UI order.

### analysis_periods
Stores configured periods (`name`, start/end dates, color, order).

### analysis_source_selections
Stores selected post source per `(indicator, date)` point.

### analysis_macro_events
Stores selected macro events and marker customization.

---

## Status and Integrity Rules

### Status transitions
- `pending` -> `approved`
- `pending` -> `rejected`
- Any status -> `disabled`
- `disabled` is terminal

### Immutability
- Do not edit existing post metadata or data points.
- If a submission is wrong, create a new post.
- Validation events are append-only.

### Cascading behavior
- Removing a post also removes its data points and validations.

---

## How to Use This Schema in the App

### Read path
1. Load posts and related series points for dashboards and detail pages.
2. Use validation summary data for review states.
3. Use duplicate detector data for moderation and data quality workflows.

### Write path
1. Create a new post with `pending` status.
2. Add all related data points for that post.
3. Reviewers append validation events.
4. Update post status according to review outcome.

### Safe update strategy
- Prefer insert-only behavior for content changes.
- Use `disabled` for soft-removal of invalid/outdated posts.

### Client integration guidance
- **Never generate or hand-write TypeScript types for Supabase tables.** Always import the existing types from `src/lib/supabase.ts`. 
- Always handle Supabase errors before using returned data.
- Keep all user-facing strings in Spanish.

---

## Operational Instructions

- Versioned DDL and policies: `supabase/migrations/`, captured from the linked project with `pnpm exec supabase db pull`.
- Migration process: create SQL with `pnpm exec supabase migration new <name>`, validate locally or on a dedicated test database, and review `pnpm exec supabase db push --dry-run` before an authorized deployment.
- Version control: commit migrations and `supabase/config.toml`; exclude credentials and `supabase/.temp/`.
- Type generation uses the official CLI to introspect the linked database; `db pull` does not refresh application types automatically.
- **After applying database schema changes, regenerate TypeScript types by running:**
  ```bash
  pnpm generate:types
  ```
  This updates the generated `Database` type used by `createClient<Database>` in `src/lib/supabase.ts`. For a running local database, use `pnpm generate:types --local`. Run `pnpm check` and `pnpm build` after generation. The wrapper preserves the last generated file if the CLI fails.
- If enabling RLS, validate with real user sessions and role-scoped tests.

---

**Last Updated**: 2026-09-08
