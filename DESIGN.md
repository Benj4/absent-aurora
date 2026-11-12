---
name: Absent Aurora
description: A sober, precise, functional workspace for analyzing and understanding data.
colors:
  editor-primary: "#173964"
  editor-primary-content: "#ffffff"
  editor-secondary: "#365f86"
  editor-secondary-content: "#ffffff"
  editor-base-100: "#ffffff"
  editor-base-200: "#f3f6fa"
  editor-base-300: "#cbd4df"
  editor-base-content: "#1a2c40"
  editor-neutral: "#526275"
  editor-info: "#3b4fc4"
  editor-success: "#173964"
  editor-warning: "#f3e3d3"
  editor-warning-content: "#7a4510"
  editor-error: "#b42318"
  editor-field-border: "#b8c5d4"
  editor-soft: "#e7f1fa"
typography:
  editor-body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
  editor-panel-title:
    fontSize: "20px"
    fontWeight: 700
  editor-report-title:
    fontSize: "24px"
    fontWeight: 700
  editor-report-title-desktop:
    fontSize: "28px"
    fontWeight: 700
  editor-label:
    fontSize: "12px"
    fontWeight: 600
  editor-section-title:
    fontSize: "15px"
    fontWeight: 700
  editor-section-summary:
    fontSize: "13px"
  code:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace"
rounded:
  editor-field: "8px"
  editor-box: "0.75rem"
components:
  editor-button-primary:
    backgroundColor: "{colors.editor-primary}"
    textColor: "{colors.editor-primary-content}"
    rounded: "{rounded.editor-field}"
    typography: "{typography.editor-body}"
  editor-button-outline:
    rounded: "{rounded.editor-field}"
    typography: "{typography.editor-body}"
  editor-button-soft:
    backgroundColor: "{colors.editor-soft}"
    textColor: "{colors.editor-primary}"
    rounded: "{rounded.editor-field}"
  editor-input:
    backgroundColor: "{colors.editor-base-100}"
    rounded: "{rounded.editor-field}"
    typography: "{typography.editor-body}"
  editor-card:
    backgroundColor: "{colors.editor-base-100}"
    rounded: "{rounded.editor-box}"
---

# Design System: Absent Aurora

## Overview

**Creative North Star: "Informe en construcción"**

Absent Aurora takes the character of a statistical publication in progress. The approved analysis editor is the visual reference: a navy working header, cool blue-gray canvas, and a white report surface. Clear controls support sustained analytical work while evidence and provenance remain visible.

Use this visual language across all views, including the dashboard, authentication, publications, series, events, and user workspace. New and revised screens should inherit its restrained typography, surface hierarchy, control shapes, spacing rhythm, and action hierarchy. Adapt composition to the task; the editor's guided configuration flow belongs to analysis creation and editing.

This is an app-wide design direction, not a completed migration of every screen. Outside the editor, light is the default and dark is an optional manual choice in the shared navigation. Never select a theme automatically from the system preference. Remember explicit choices across navigation and reloads when browser storage is available. Apply shared patterns through semantic DaisyUI roles in the active theme; palette or theme changes require a deliberate implementation in `src/styles/global.css`.

**Key Characteristics:**
- Clear, contained controls with a distinct primary content surface.
- Contained depth: structural separation with occasional elevation.
- Functional color names that remain useful when palette values change.
- Reusable components across views with explicit theme boundaries.

**Scope and evidence.** The user approved the analysis view as the shared design reference. The concrete source for the captured direction is `AnalysisBuilder.tsx` and its editor components, with theme values in `src/styles/global.css`. The general application still uses DaisyUI light/dark themes; `AnalysisBuilder.tsx` explicitly selects the light `analysis-editor` theme. Frontmatter names prefixed `editor-` identify the implemented reference tokens, not a second global token namespace. Reuse their semantic roles and visual relationships across screens; their literal values remain scoped until a theme migration is implemented.

The editor implementation was inspected in source. The parent build review exercised desktop (1440px), mobile (390px), and narrow (320px) layouts; this document does not independently certify all computed states. Save, publication, and database integration were not verified by this documentation pass. Sidecar snippets are portable previews, not live application integrations. The executable stylesheet and components remain authoritative when this snapshot drifts.

## Colors

Use functional names rather than hue-based brand names. The current values above are a replaceable snapshot of the editor theme, not permanent brand commitments.

### Primary

`editor-primary` supplies the navy toolbar and primary actions. The editor's accent and success roles currently share its value, but remain semantically distinct roles. Soft selected controls use `editor-soft` with primary-colored text and a stronger border.

### Secondary

`editor-secondary` records the declared secondary role. Its presence in the theme does not establish a required allocation or a prominent use on every screen.

### Neutral

`editor-base-100` is the panel and field surface; `editor-base-200` is the surrounding canvas; `editor-base-300` separates regions. `editor-base-content` is the main text role, and `editor-neutral` supplies secondary text. `editor-field-border` is the explicit field and outline-button border override. The scoped DaisyUI theme declares `--editor-field-border` and `--editor-soft`; editor CSS consumes those variables alongside semantic colors and `--radius-field`, rather than repeating palette and radius literals.

### Feedback and data

Info, success, warning, and error retain distinct semantic roles. Warning has its own darker content token; info, success, error, and neutral currently use white content in the editor theme. Status badges include Spanish text; do not rely on color alone.

Chart colors encode indicators in calendar mode and periods in index-zero mode. User-assigned series colors are data configuration, not brand tokens. Invalid chart points use diamond markers and a separate fixed red outline in `chart-options.ts`; that exception is not the theme error token.

**The Theme Boundary Rule.** Carry the analysis view's visual hierarchy across all screens through semantic colors in the active theme. Keep literal editor palette values and editor-only tokens scoped until an explicit theme migration.

## Typography

The general application inherits its sans-serif stack from the framework styles. It does not explicitly set a global display font. The editor explicitly uses the operating system UI stack recorded in `editor-body`; no Inter dependency is implied. Its hierarchy uses bold 20px working headings and an editable report title that grows from 24px to 28px at the large breakpoint. This is a functional interface hierarchy, not an independent decorative display face.

JetBrains Mono Variable is bundled and explicitly assigned to `code`. Tailwind monospace utilities used by dates and values do not automatically select that font. Tabular numerals are applied to some table values and dates.

The observed hierarchy uses larger, bold page and dashboard headings; regular body copy; semibold labels and card titles; and smaller muted metadata. Dashboard headings grow at the medium breakpoint. Editor section titles and summaries use the explicit sizes in frontmatter. The chart legend uses small medium-weight text; event labels are smaller still.

For new and revised views, use the editor's system UI sans character and compact hierarchy as the reference: a clear page title, bold section titles, readable body copy, and smaller secondary metadata. Reserve the report-title treatment for the main content title. Keep standard form text at least 16px on mobile, and use tabular numerals where aligned values or dates aid comparison. These are shared design targets; the current global stylesheet does not yet enforce the editor's typography outside its scope.

**Cascade caveat.** Unlayered editor field, button, and label rules can override utility typography. Ghost inputs and textareas are excluded from the standard field override; selects are not. Document utility declarations as intended local styling until computed styles have been checked; do not claim every requested size is rendered.

## Layout

General routes use a centered, bounded content area with responsive gutters. The dashboard packs indicator cards into an automatic grid with a minimum column width of 220px. Groups and sections are separated by spacing and thin borders.

The analysis editor is bounded to 1600px. At the large breakpoint (1024px), a 320–410px configuration column sits beside a flexible, minimum-zero report column with a 32px gap and 40px horizontal gutters. Below it, 16px gutters and a configuration/preview switch show one working surface at a time. The navy toolbar combines the three labeled steps (Datos, Períodos, Contexto) and save controls in one compact row. A labeled native status select sits beside Save, with a light field surface and dropdown arrow; an adjacent question-mark help control reveals on click or keyboard activation that the chosen state applies on save. On small screens, this group moves below the steps while keeping status and Save side by side. The current step has a light underline and bold text. Creation and editing routes omit the separate breadcrumb strip; the editor page heading remains accessible but visually hidden because the working panel already carries context. At mobile widths, save uses a short visible label with a full accessible name, and configuration/preview switching occupies a second compact row. Controls retain a minimum 44px height, and the toolbar can wrap for longer saving states. Step navigation preserves configuration and selects the configuration view. Navigation and preview switching do not programmatically move focus or scroll.

The configuration panel exposes only the current step: data selection; periods and alignment; then context through macro events, expanded by default with review guidance below. Disclosure groups remain within these steps, with thin separators rather than separate rounded cards. Their summaries have a minimum height of 64px; open content retains a 22px bottom inset. The report remains visible alongside configuration on desktop. Title, notes, chart, and sources share one white bordered report surface; chart and event sections use internal separators. Data errors, save errors, and saved-reference warnings remain outside the toggled report so changing mobile views does not hide them.

Spacing is primarily the Tailwind utility scale: recurring small gaps, moderate panel padding, and larger separation between sections. There is no separate application spacing token system. Do not duplicate the framework scale as a new independent authority.

**The Shared Composition Rule.** Reuse the analysis view's bounded canvas, clear content surface, compact action group, and internal separators across routes. Preserve each view's task and information hierarchy rather than copying the editor's sidebar or steps.

Use these adaptations when building or revising other views:

| Surface | Shared design application |
|---|---|
| Dashboard and catalogs | Bounded canvas, compact title/action row, consistent metadata, and restrained card borders; preserve the dashboard's responsive indicator grid. |
| Publications, series, and analysis reader | One main reading surface with title, metadata, evidence, and sources; separate subsections with spacing and thin rules. |
| Data-entry and event forms | Group labeled controls by task, use the reference control shapes and minimum heights, and place validation near the affected fields. |
| User workspace and review lists | Compact filters and actions above readable rows; use textual statuses and contain horizontal table overflow. |
| Authentication | A focused form with the same type hierarchy, labeled controls, and action variants; size its container to the shorter task. |

The 1600px maximum and split configuration/report columns are editor measurements, not mandatory widths for every route. Keep a visible page title and useful breadcrumbs on other screens; the editor's hidden heading is a local response to its toolbar. Mobile layouts stack content and wrap actions; use a configuration/preview switch only for a workflow that needs it.

The analysis reader uses a single bordered report surface on a muted canvas, bounded to 1280px with responsive gutters. Its visible title, publication status, region, description, validity warnings, and linked versions precede a two-column indicator and period summary that stacks on mobile. Chart controls have 44px minimum targets; an accessible Help button toggles the initially hidden calendar and index-zero definitions; changes apply only to the current view. Source references use separated rows with explicit series links. Macro events and detailed values are expanded by default, with contained keyboard-focusable table scrolling, wrapped names, and right-aligned tabular values. The reader consumes the active light or dark theme and does not force the editor theme.

The event catalog uses the analysis reader's bounded 1280px muted canvas. A visible heading and separate filter/action toolbar precede a grid of independent bordered event cards, with two columns from 1024px and one below. Cards have a subdued date strip with prominent day numerals and month/year; periods connect their start and end with an arrow, while single-date events are labeled “Hito puntual”. The title and expandable narrative lead the card body, followed by textual status and topic metadata. Geography and the external source link share a separated footer with small line icons. The compact, accessibly named actions menu leaves room for long titles. Cards size to their content and use active-theme surfaces and radii without hover elevation or nested cards. The inline creation form groups information, dates, and geography with fieldsets and thin rules; this form is also reused in the analysis editor. Catalog controls have 44px minimum heights and fields use 16px text below the desktop breakpoint. The catalog retains the active light or dark theme and its semantic colors; it does not apply the editor theme.

Correction provenance occupies a subdued region at the bottom of an event card: the immediate predecessor is labeled “Corrección de”, and an initially closed disclosure shows the number of direct corrections. Expanding it reveals their links, creation dates, and invalidity when applicable. These links clear the status filter and focus the linked event; URL fragments support direct access and a primary-colored ring highlights the target. The creation form identifies the event being corrected before submission. Correction relationships remain separate from validity badges.

Tables use horizontal overflow containers. The detailed data table also has a bounded scroll area and a sticky header. Chips and action rows wrap. The main navigation changes from a dropdown on small screens to horizontal links at the medium breakpoint.

## Elevation & Depth

Contained depth: structural separation with occasional elevation. The editor uses borders, adjacent surface tones, and rounded result panels. Its theme disables depth and noise, and editor buttons explicitly remove shadows. The wider application retains small card shadows with stronger hover shadows, while dropdown menus use a larger shadow.

The observed shadow vocabulary is the framework's small, medium, and large utilities. Exact framework shadow values are not promoted to application tokens in this capture. Do not replace this hybrid with a blanket no-shadow rule.

Across new and revised views, prefer the editor's restrained tonal separation and thin borders for working and reading surfaces. Retain elevation where it communicates interaction or an overlay; avoid adding hover lift to static content just to imitate a dashboard card.

## Shapes

Editor fields and buttons have gently rounded corners defined by `editor-field`; theme boxes use `editor-box`. Explicit component utilities can introduce larger corners on detailed-data panels and empty states. Pills and circular step markers coexist with rectangular controls; there is no single universal radius.

Fields have thin borders. Selected soft controls have a stronger two-pixel primary border. Editor buttons and standard fields have a minimum height of 44px, rather than a fixed height; multiline labels can expand. On narrower screens, standard inputs, selects, and textareas use 16px text to avoid mobile focus zoom; the title retains its larger heading size. Title and description ghost fields have transparent backgrounds and borders with square corners.

Use the reference's gently rounded fields (8px) and main surfaces (12px) as the shared shape direction. Consume active-theme radius variables rather than repeating those literals in component CSS. Maintain 44px minimum heights for primary form controls and actions when adapting other views. Existing exceptions remain implementation details until those views are revised.

## Components

**Philosophy:** clear, contained controls. Reuse DaisyUI primitives directly and existing domain components. There is no separate general-purpose React button, input, or card API to import.

### Reuse across views

Use `btn-primary` for the main action, outline or ghost variants for secondary actions, and soft treatments for selected modes. Pair `bg-base-200` canvas regions with `bg-base-100` content surfaces, `border-base-300` separators, and `text-base-content` text resolved by the active theme. Use the theme's secondary-text treatment without applying the editor's literal neutral color to other themes. Preserve native select arrows, focus indicators, disabled states, and labels. Reuse domain components for their actual behavior; do not import `AnalysisBuilder` or apply `.analysis-editor` to unrelated pages as a styling shortcut.

Treat the editor's report surface, compact actions, labeled fields, section separators, and textual feedback as reusable patterns. Its three steps, mobile preview switch, source markers, and save-state help remain analysis-specific. New shared wrappers are justified by repeated behavior or meaningful markup reuse, not visual similarity alone.

### Buttons and fields

Primary, outline, ghost, and soft variants express action hierarchy. In the editor, outline accent controls receive an explicit accent border and text override. Preserve semantic button types, disabled/saving behavior, associated labels, and focus indicators. DaisyUI owns default interactive states; exact resolved hover and focus styles require verification against the installed package.

### Cards and navigation

`IndicatorCard.tsx` combines a title, unit and frequency metadata, an optional sparkline, and text links. `Navbar.tsx` owns the shared navigation and account dropdown. The editor's results panels use bordered surfaces and compact section headings; they should not inherit the dashboard card's hover elevation by default.

The navigation exposes a keyboard-accessible moon button labeled “Tema oscuro”; its pressed state indicates that dark is selected. It is available to signed-in visitors and guests at desktop and mobile widths. `Layout.astro` applies the saved theme before rendering to avoid a light-theme flash on return visits. The analysis editor retains its explicitly scoped light theme even when the surrounding shell is dark.

### Chips, statuses, and feedback

Period chips show a colored dot, name, and date range. Their tint and border derive from the selected period color. Status badges carry text and semantic feedback roles. Alerts, loading skeletons, and empty states appear within the affected region; keep instructions in Spanish and tied to the next available action.

### Analysis sections and charts

`AnalysisBuilder.tsx` owns guided step navigation, the mobile view switch, toolbar saving states, and warnings outside the report. `SidebarSection.tsx` supplies collapsible configuration groups; the current guided editor does not pass numbered badges into those groups. `AnalysisContent.tsx` supplies the editable title, period summary, chart panel, event table, and detailed data disclosure. `AnalysisSources.tsx` supplies source cards shared by editor and reader. Editor CSS reduces the series marker to a compact 8px dot; the reader retains its vertical color stripe. Source cards preserve their hover shadow, including within the editor.

The shared chart is transparent against its containing surface and inherits typography. Grid lines are subdued and dashed; legends and source tooltips explain the displayed data. Invalid series use diamond markers with no connecting line. Reference series use a thinner, partially transparent line. Chart animation is configured at 250ms; the detailed-data disclosure indicator uses a 200ms rotation transition. No project-wide motion scale or verified reduced-motion policy is established by this capture.

**Not canonized.** Any inherited glyph-based event warning or external-link decoration is a local implementation detail, not a reusable icon system. The operating system font is used for functional UI and editable report text, not prescribed as a decorative display treatment.

## Do's and Don'ts

### Do

- Do reuse the existing component baseline before introducing another visual treatment.
- Do use the approved analysis view as the visual reference for every new or revised screen.
- Do adapt its surface, typography, control, and spacing patterns to each view's task.
- Do name colors by their function and update this snapshot when their source values change.
- Do preserve theme scope, including the editor's explicitly light theme.
- Do prioritize usability, readable composition, and visible data provenance.
- Do preserve Spanish labels and textual status explanations.

### Don't

- Don't hard-code the editor palette into other views or bypass active-theme semantics.
- Don't copy analysis-specific steps, hidden headings, or preview switching into unrelated views.
- Don't introduce a separate rounded card around every report subsection.
- Don't assume the bundled code font is the rendered font of every monospace utility.
- Don't promote chart series colors or one-off utility values into brand tokens.
- Don't claim browser verification from source inspection alone.
