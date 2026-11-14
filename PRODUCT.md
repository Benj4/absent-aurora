# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences are equally important:

- Analysts enter data and create analyses. Their work centers on interacting with charts and the underlying data.
- The general public views published analyses and expresses opinions about them. This is a confirmed audience need; the participation mechanism remains an open product decision, not a verified existing commenting feature.

## Product Purpose

Absent Aurora supports publishing, validating, and interpreting economic and social time series. Its central promise is the reliability of data and analyses: readers must be able to recognize when an analysis depends on invalid information, and analysts must correct the record through new data and new analyses.

Success means that a published analysis retains its provenance and that invalid supporting information remains visible as a problem instead of being silently replaced.

## Positioning

Reliability is built into the content lifecycle. Submitted data cannot be edited. Incorrect data is invalidated and replacement data must be submitted as a new record. An analysis using invalid data must remain marked; a corrected analysis requires new data references and a new analysis. This mechanism is a product commitment, not a claim of independent verification or guaranteed factual accuracy.

## Operating Context

Analysts browse indicators, submit annual, monthly, or quarterly series with sources, review data, compare periods in charts, incorporate macro events, and save or publish analyses. Readers explore published analyses and their evidence.

The existing application separates drafts from published and hidden analyses. Draft configuration is editable; published content and version relationships are immutable. Visibility and reference validity are separate concerns.

## Capabilities and Constraints

- User-facing content is in Spanish. Code and technical documentation are in English.
- Series corrections create new records. Invalidation preserves the record and its effect on dependent analyses.
- Published analyses preserve their selected source references. Missing or invalid references must not silently fall back to current alternatives.
- Unknown reference completeness or unavailable history must be presented as unknown rather than inferred as valid.
- Reference validity can change independently of publication visibility. Existing restoration workflows can restore validity when supporting records become valid again.
- Macro events provide contextual markers for analyses and have their own validity state.
- Privileged actions use roles from the authenticated session and are enforced by database policies. Audience groups are product personas, not additional authorization roles.
- The public opinion workflow, any moderation requirements for it, and its implementation scope remain undecided.

## Brand Commitments

The product is referred to as Absent Aurora. Maintain a persistent design baseline expressed through reusable components. Reuse those components across surfaces; design iterations should primarily resolve usability and composition rather than repeatedly reconsider colors or aesthetic choices. Existing conventions in `docs/conventions.md` remain the implementation authority.

## Evidence on Hand

- `README.md`: application capabilities and local setup.
- `docs/components.md`: domains, routes, and implementation entry points.
- `docs/database-schema.md`: content lifecycle, provenance, visibility, and authorization rules.
- `src/data/indicators.json`: indicator catalog.
- `src/types/database.types.ts` and `supabase/migrations/`: database declarations and versioned policy implementation. Repository presence does not establish remote deployment status.

The audience, reliability priority, and component reuse commitment were confirmed by the product owner during initialization. No customer results, independent accuracy certification, or engagement metrics were established.

## Product Principles

1. Preserve the evidence trail: corrections add records rather than rewriting published history.
2. Make invalid and uncertain supporting information visible wherever it affects interpretation.
3. Serve both analytical creation and public understanding, with workflows appropriate to each audience.
4. Keep a consistent component baseline and prioritize improvements that make tasks and compositions clearer.
