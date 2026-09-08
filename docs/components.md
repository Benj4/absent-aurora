# Domain and Component Map

This document maps product domains to their routes, UI entry points, and supporting modules. It intentionally avoids duplicating the complete `src/` tree, because file-by-file inventories become stale quickly.

Update this map when a route, domain boundary, important entry point, or ownership rule changes. Ordinary file additions inside an existing domain do not require an update.

## Runtime flow

```text
Astro route
  -> layout and page composition
  -> React or Astro domain component
  -> reusable logic in src/lib
  -> singleton Supabase client
  -> PostgreSQL tables and views
```

Astro owns routing and build-time page composition. React components own interactive state and client-side Supabase operations. Shared data-access and transformation logic belongs in `src/lib/` rather than page files.

## Domain map

| Domain | Routes | UI entry points | Supporting modules |
|---|---|---|---|
| Dashboard | `/` | `Dashboard.astro`, `IndicatorCard.tsx` | `data/indicators.json`, `lib/frequency.ts`, `lib/paths.ts` |
| Authentication and navigation | `/login` | `Welcome.astro`, `Navbar.tsx`, `Breadcrumbs.tsx`, `AuthSessionBootstrap.tsx` | `lib/auth-session.ts`, `lib/use-auth-session.ts`, `lib/supabase.ts` |
| Posts and validation | `/post`, `/postlist` | `PostDetail.tsx`, `PostCard.tsx`, `PostListClient.tsx`, `PostListFilters.tsx` | `lib/supabase.ts`, generated database types |
| Indicators and series | `/indicators/[id]/data`, `/series/[frequency]/[id]` | `ApprovedSeriesSelector.tsx`, `IndicatorChart.tsx`, `IndicatorPostsLoader.tsx`, `SeriesForm.tsx` | `lib/frequency.ts`, `lib/series-form-draft.ts`, `lib/url-title.ts` |
| Analyses | `/analisis`, `/analisis/nuevo`, `/analisis/editar` | `AnalysisBuilder.tsx`, `AnalysisViewer.tsx`, `components/analysis-builder/` | `lib/analysis.ts`, `lib/macro-events.ts` |
| Macro events | `/admin/macro-events` | `components/macro-events/MacroEventsPage.tsx`, `MacroEventForm.tsx` | `lib/macro-events.ts` |
| User workspace | `/user`, `/user/reviews`, `/user/analisis` | `components/user/UserPosts.tsx`, `UserReviews.tsx`, `UserAnalyses.tsx`, `UserEdit.tsx` | `lib/auth-session.ts`, `lib/paths.ts`, `lib/supabase.ts` |
| Shared shell | All routes using the main layout | `layouts/Layout.astro`, `Navbar.tsx` | `styles/global.css`, `lib/paths.ts` |

Paths in the table are relative to `src/` unless they begin with `/`.

## Important entry points

### Application shell

- `src/layouts/Layout.astro`: global document shell, styles, and navigation.
- `src/pages/index.astro`: dashboard route.
- `src/pages/login.astro`: authentication route.
- `src/lib/paths.ts`: GitHub Pages base-path helpers. Internal links must use these helpers where required.

### Supabase and generated types

- `src/lib/supabase.ts`: singleton application client and database-type re-exports.
- `src/types/database.types.ts`: generated table interfaces; never edit manually.
- `scripts/generate-types.ts`: official Supabase CLI type-generation wrapper.
- `supabase/migrations/`: versioned database schema and policy history.
- `supabase/config.toml`: local Supabase CLI configuration.

### Analysis builder

`src/components/analysis-builder/` is the most developed domain folder:

- `analysis-builder.types.ts`: UI state and chart types.
- `analysis-builder.data.ts`: indicator lookup data.
- `analysis-builder.utils.ts`: pure transformations and chart helpers.
- `use-analisis-state.ts`: orchestration, loading, and derived state.
- `AnalysisSidebar.tsx`: editor controls.
- `AnalysisContent.tsx`: editable analysis canvas.
- `AnalysisChart.tsx`: Highcharts wrapper.
- `SourceConflictResolver.tsx`: source conflict handling.

`src/components/AnalysisBuilder.tsx` and `AnalysisViewer.tsx` are the public entry components for editing and reading analyses.

## Dependency direction

Prefer dependencies in this direction:

```text
pages -> domain components -> shared components and lib -> Supabase client/types
```

Avoid importing UI component types from `src/lib/`. If a type is shared by data access and UI, place it in a domain-neutral module and import it from both layers.

## Placement guidance for new work

- Keep page front matter focused on route parameters, redirects, and page composition.
- Add domain UI beside the closest existing domain folder.
- Create a new domain folder when a feature gains several related components; do not add an unrelated cluster to the root of `src/components/`.
- Put pure parsing, validation, URL, and data-access logic in `src/lib/`.
- Put isolated tests in `tests/unit/` and external Supabase/RLS tests in `tests/rls/`.
- Keep product notes and positioning under `docs/`, never inside `src/components/`.

## Known structural pressure

Several legacy components at `src/components/` combine data access, state, and presentation. When changing them substantially, prefer extracting cohesive logic rather than performing a repository-wide move. The intended long-term direction is domain-oriented grouping, but migrations should remain incremental and reviewable.

**Last reviewed:** 2026-08-27
