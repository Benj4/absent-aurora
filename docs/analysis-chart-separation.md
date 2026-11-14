# Calendar and index-zero chart separation (ZEH-15)

Status: architecture proposal; no application refactor or color feature implemented.
Issue: [ZEH-15](https://linear.app/zehuti/issue/ZEH-15/analizar-la-separacion-de-los-graficos-calendario-e-indice-0).

This audit describes the working tree inspected on 2026-11-06, including existing uncommitted editor changes. File locations refer to that snapshot. Source inspection establishes current code paths, not successful browser or database execution.

## Current flow and ownership

All paths below are relative to the repository root. Function names supplement line anchors so locations remain discoverable after edits.

| Responsibility | Current evidence | Implication |
|---|---|---|
| Configuration | `src/components/AnalysisBuilder.tsx:15` and `src/components/analysis-builder/use-analisis-state.ts:26` | Builder owns save feedback; hook owns title, description, visibility/status, region, indicators, periods, source selections, selected events, marker settings and base-100 toggle. Sidebar and content receive callbacks. The exported reducer in utils is not the hook's active state implementation. |
| Creation/edit hydration | `use-analisis-state.ts:69` and `:91` | New analyses restore/sanitize and persist `analysis-builder-draft:v1`; editing loads `loadAnalysis`, stores the original `savedScope`, and skips localStorage. |
| Editor data | `use-analisis-state.ts:205` | Queries approved catalog points over configured indicators and date bounds, in parallel with `loadSavedPoints`. Merges original references with catalog candidates while excluding unrecorded historical points inside saved scope; query readiness prevents saving stale results. Mode changes do not change the fetch key. |
| Source semantics | `src/components/analysis-builder/analysis-builder.utils.ts:192`, `:222`, `:238`, `:265`; `src/lib/analysis-sources.ts:5` | Conflicts group indicator/date by post. Explicit selection never falls back. Period filtering resolves sources and sorts dates. Capture saves every displayed point's post, including nonconflicting points, and rejects missing active selections. Saved loading reads recorded posts regardless of approval and reports missing points. |
| Editor projection | `use-analisis-state.ts:255`; `src/components/analysis-builder/AnalysisContent.tsx` (`AnalysisChart` call) | Hook appends optional overlays to ordinary series and builds event markers; content handles loading/empty UI, source controls and marker controls. Marker color edits have a local 180 ms debounce and timer cleanup. |
| Viewer loading | `src/components/AnalysisViewer.tsx:103`, `:218` | Loads configuration, author, validity and version metadata; loads only saved point references and selected events, without querying today's approved catalog. Errors and unknown validity remain visible. |
| Viewer projection | `AnalysisViewer.tsx:249`, `:254`, `:262`, `:270`, `:511` | Reuses the same series/overlay/marker builders and chart. A local `selectedMode` overrides the loaded mode only in `chartState`; viewing another alignment does not save it. Table values remain original values. |
| Rendering/lifecycle | `src/components/analysis-builder/AnalysisChart.tsx:14` | One effect assembles mode-dependent X axes, common Y axes, event plot lines, tooltips, legend and line styling. It destroys/recreates Highcharts on series, marker or mode changes, destroys for empty series, and cleans up on unmount. |
| Persistence | `src/components/AnalysisBuilder.tsx:48`; `src/lib/analysis.ts:26`, `:102` | Capture precedes save/update. Loading assembles five tables. One `save_analysis` RPC writes configuration, order, periods, sources and marker settings. `alignment_mode` and `show_base100` are independent persisted fields. |

`src/lib/supabase.ts` remains the single typed client, backed by generated `src/types/database.types.ts`. The latter declares `analysis.alignment_mode`, `show_base100`, `reference_capture_version`, and the save RPC. No database interface or schema change is required for this split. Validity/provenance behavior is documented in [the database guide](database-schema.md).

## Semantics to preserve

Calendar X values are `new Date(date).getTime()` timestamps. Index-zero X values are UTC calendar month differences from **the configured period start**, not observation array positions, day durations or offsets from the first available observation. January to March is two months even if February has no observation. Annual and quarterly series therefore retain gaps; different days in the same month share an offset. The index axis is linear, starts at zero, disallows decimal ticks and displays `M{value}`.

Base 100 is an independent, optional Y transformation in `applyBase100` (`analysis-builder.utils.ts:177`). Each indicator/period uses its first resolved chronological observation as baseline: `value / firstValue * 100`. Empty input stays empty; a zero baseline currently returns unchanged values. It adds reference lines on Y axis 1, with reduced width/opacity and no point markers; original lines and table values stay unchanged. Both alignments support overlays. Changing zero-baseline behavior would be a separate behavioral change.

Ordinary lines use period color and indicator-index dash style (four styles cycle), in period-then-indicator order. Nonapproved recorded observations remain in the ordinary line and also produce diamond warning points, with no connecting warning line (`buildChartSeries`, `:296`). Overlays currently do not produce a separate invalid-point layer. Preserve names, ordering and this behavior before changing presentation.

`buildMacroEventMarkers` (`:381`) has genuinely different projection rules. Calendar emits selected start/end boundaries as timestamps without period clipping. Index zero repeats boundaries per period, clips each boundary inclusively to that period, and uses month offsets plus period-specific marker IDs/labels. Neither mode duplicates an end equal to start; absent ends produce no end marker. Marker settings default to `both`, support `none/start/end/both`, and retain invalid-event warnings. Colors use explicit event color or the existing ID hash plus selected-event index fallback; index mode also contains period-color fallbacks. Do not silently change default colors or event ordering during extraction.

## Coupling and risks

- Coordinate selection is repeated in ordinary points, invalid points and overlays (`:303`, `:322`, `:340`). Changing one branch alone misaligns layers.
- Marker clipping and labels are mixed with color/default policy inside one mode-branching function. Applying index clipping globally would remove calendar events; projecting calendar timestamps onto the index chart would place markers outside its useful range.
- The renderer chooses X axis independently of the upstream projection. Its `series` and `mode` props permit mismatched coordinates and axes. A file-only split would leave that risk intact.
- Editor and viewer duplicate concatenation of ordinary/overlay series and marker preparation. Extracting only the editor pipeline leaves divergent behavior likely.
- State, source resolution, serialization and chart transformations share a utils module. Moving fetching or persistence into each chart would duplicate authoritative reference handling.
- `src/lib/analysis.ts` and `analysis-sources.ts` import types from the UI folder. A shared domain-neutral type home avoids deepening this dependency when adding chart components.
- Fresh derived arrays in the editor cause the chart effect to recreate on unrelated renders. Preserve current recreation behavior first; incremental Highcharts updates or memoization are separate optimizations with their own lifecycle validation.

## Proposed component and file map

Names below are proposed files, not existing entry points. Keep routes and current public builder/viewer entry components.

| Proposed file | Explicit owner |
|---|---|
| `src/components/analysis/AnalysisContainer.tsx` | General analysis composition. Receives controlled configuration and loaded resources, owns no Supabase client or duplicate configuration store; chooses chart from effective alignment and composes editor or read-only controls/content. |
| `src/components/analysis/charts/CalendarChart.tsx` | Calendar model projection and datetime X axis; never receives a mode prop. |
| `src/components/analysis/charts/IndexZeroChart.tsx` | Month-offset projection, per-period event boundaries and linear X axis; never receives a mode prop. |
| `src/components/analysis/charts/HighchartsAdapter.tsx` | Single DOM ref, chart ref, create/destroy effect and empty/unmount cleanup. Takes complete options and `hasSeries`; contains no alignment or persistence decisions. Retains current 360 px height. |
| `src/components/analysis/charts/chart-options.ts` | Common Highcharts line, warning-point, overlay Y axis, legend, tooltip and plot-line styling. Accepts already projected model and explicit X axis; no mode branch. |
| `src/lib/analysis-chart.ts` | Shared pure source/period preparation and base-100 generation, producing dated groups once; retains ordering, labels, colors and warning layers. No fetches. |
| `src/lib/analysis-calendar.ts` | Pure `buildCalendarModel`: timestamp projection for all layers, calendar event boundaries. |
| `src/lib/analysis-index-zero.ts` | Pure `buildIndexZeroModel`: monthDiff projection for all layers, period-clipped event boundaries. |
| `src/lib/analysis-types.ts` | Shared configuration/point/model types moved from UI, importing generated database types where appropriate. Existing UI type module can re-export during migration. |

Keep configuration hydration/mutation in `useAnalisisState` for editing, saved loading and local viewing mode in `AnalysisViewer`, and save/update in `AnalysisBuilder` using existing services. Container responsibility means one composition boundary for configuration, not a second state copy or a new universal fetching hook. Sidebar/content controls use the existing callbacks; marker debounce stays in the editor content.

Proposed contracts (type descriptions, not an implementation):

- `AnalysisContainerProps`: `configuration: AnalisisState`, `points: readonly RawPoint[]`, `selectedEvents: readonly MacroEvent[]`, `effectiveMode: ModoAlineacion`, `loading: boolean`, `error: string | null`, and a discriminated `access` contract. `access.kind = 'editor'` supplies existing configuration/source/marker callbacks and save feedback; `access.kind = 'viewer'` supplies only `onViewingModeChange`. Validity/version actions stay in the viewer shell and can be composed alongside the container.
- Both chart props: `input: AnalysisChartInput`. No setters, user/session, analysis ID, fetch callbacks or save callbacks. Input contains only selected indicators, periods, source selections, points, selected events, marker mode/color maps and `showBase100Line`; it excludes title, visibility and alignment. Charts own no mutable analysis state.
- Shared preparation: `prepareChartData(input)` returns dated groups by indicator/period, original values, optional normalized values, invalid-point subsets and presentation identity. Resolve/filter/sort once, then reuse those results for both value layers. Event boundary selection/default settings are shared; clipping and coordinate projection belong to each mode module.
- Mode builders return `AnalysisChartModel` with `series: HCSeriesData[]` and `markers: HCEventMarker[]`. A mode component projects its input and passes its fixed X axis plus model to the common options builder. Retain these existing model types initially rather than inventing a second Highcharts setup.
- `HighchartsAdapterProps`: `options: Highcharts.Options`, `hasSeries: boolean`. It alone instantiates/destroys charts. Shared options retain overlay-axis detection through `yAxis === 1` and existing marker label styling.

Editor flow: builder/hook -> controlled container -> selected chart -> shared adapter. Read-only flow: viewer saved loaders -> same container with local effective mode -> same selected chart -> same adapter. Both use identical pure preparation; their intentionally different data acquisition policies remain outside charts. Switching modes cannot trigger a new database query or serialize a viewer-only choice.

## Staged implementation and compatibility gates

1. Record baseline behavior in both screens using the scenarios below. Move shared types to `src/lib/analysis-types.ts` with temporary re-exports; preserve serialized names and defaults. No generated-type edits.
2. Extract source/period preparation and shared normalization without changing outputs. Keep old utility exports as delegating compatibility wrappers while migrating both consumers.
3. Extract calendar/index projection modules, covering ordinary, invalid and normalized points together with event coordinates. Preserve all current color policy. Remove mode branches from the common preparation path.
4. Extract common options and lifecycle adapter, keeping destroy/recreate semantics. Add the two fixed-mode chart files and the controlled container. Migrate editor and viewer together, preserving loading/errors, tables and controls.
5. Remove obsolete chart wrapper/delegating exports after checking all callers. Update [the component map](components.md) when actual entry points change. Run checks/build and the validation scenarios before a separate color feature begins.

No migration, backfill or stored format change is planned. Preserve `calendario`/`indice_cero`, local draft key, period IDs/order/dates/colors, indicator order, source keys `indicator:date`, event maps and `show_base100`. Preserve original reference capture and RPC validation; never refill historical gaps from today's catalog. Legacy `reference_capture_version = 0` remains explicitly unverified, including copied versions. Visibility and reference validity stay independent. Do not modify publication immutability, version links, role checks or database policies as part of this structural work.

## Validation scenarios for the later refactor

These are manual acceptance scenarios, not newly generated tests. Run existing `pnpm run check`, `pnpm run test` and `pnpm run build` as applicable, then verify with permitted local data:

| Scenario | Required observation |
|---|---|
| New/edit/view switching | Same points and configuration after switching both ways; index offsets derive from period start; viewer switch does not persist. Check annual, quarterly, monthly, missing months and same-month boundaries. |
| Base 100 in each mode | Toggle overlay on/off; baseline may start after period start. Nonzero, zero, negative and empty baselines preserve current results; secondary axis appears only with overlay series. Raw tables remain unchanged. |
| Sources and reload | Multiple posts for one date, explicit unavailable choice and sole-source points retain exact post references after save/reload. New catalog additions do not rewrite saved analyses. Editing outside saved scope still offers approved candidates. |
| Validity and history | Nonapproved recorded points remain plotted with diamonds; invalid events retain warning labels. Missing references/load failures show unknown state, never fallback. Legacy provenance remains unverified. |
| Events | none/start/end/both; null/equal end; boundaries inside/outside/at period limits; overlapping periods. Calendar remains unclipped; index repeats/clips by period. Explicit/default colors and labels match baseline. |
| Lifecycle and empty UI | Change title, mode, sources, periods and marker settings; toggle overlays; empty series; navigate away and remount. Exactly one active chart per mounted adapter; old instances and debounce timers cleaned up. Check resize and tooltip/legend behavior. |
| Persistence and access | New local draft restore/reset; edit bypasses localStorage; failed save keeps Spanish feedback; original alignment and overlay flag reload; viewer remains read-only except existing authorized visibility/version/draft actions. |

## Open decisions

The split and shared adapter are recommended. Before implementation, confirm the final container composition API against the evolving editor layout; prefer controlled props over a new context unless repeated prop plumbing warrants it. Decide separately whether to optimize recreation with `chart.update`, change the zero-baseline policy, change fallback color stability or improve same-month index tooltips. None is a prerequisite for extraction and none should be bundled silently. Future color requirements must specify period/indicator identity separately for each mode after structural parity is established.

## Investigation validation

Source paths, configuration, persistence mappings and type declarations were inspected locally. Runtime scenario checks above remain for the implementation stage; this documentation does not claim browser or Supabase integration verification. Check results are recorded in the issue handoff.
