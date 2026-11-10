# Manual workflow review and demo-user provisioning plan

Last reviewed: 2026-11-05. Status: partially implemented; runtime walkthrough and optional fixture/report/cleanup tooling remain pending.

## Scope and evidence

Deliver two things incrementally: a manual review inventory with actors and steps, and a repeatable way to provision users and roles in an empty Supabase environment. Optional sample data should accelerate individual reviews without replacing the full manual journey.

This inventory is based on the current routes, React components, generated database types, and all twelve checked-in SQL migrations. It describes code paths, not completed runtime verification. The user's empty database has not been inspected or modified; whether it contains the current schema still needs checking. This document review creates no accounts, tests, migrations, or application changes. Account provisioning and several original backlog items already exist in the repository.

Evidence entry points:

- [Domain map](components.md), [conventions](conventions.md), [database guide](database-schema.md), [package scripts](../package.json).
- [Authentication normalization](../src/lib/auth-session.ts), [login flow](../src/lib/login.ts), [login UI](../src/components/LoginForm.tsx).
- [Series submission](../src/components/SeriesForm.tsx), [reviews and status changes](../src/components/PostDetail.tsx).
- [Analysis persistence](../src/lib/analysis.ts), [builder](../src/components/AnalysisBuilder.tsx), [reader](../src/components/AnalysisViewer.tsx).
- [Macro-event administration](../src/components/macro-events/MacroEventsPage.tsx).
- [Baseline schema](../supabase/migrations/20260908032319_remote_schema.sql), [role synchronization and analysis access](../supabase/migrations/20261029000000_restrict_analysis_deletion.sql), [status RPCs](../supabase/migrations/20261030000000_status_history.sql), [analysis versions](../supabase/migrations/20261102000000_analysis_versions.sql), [published-content protection](../supabase/migrations/20261102000001_protect_published_analyses.sql).

Additional current evidence: [migration directory](../supabase/migrations/), [account provisioning](../scripts/demo-users.ts), [live approved-data loader](../src/components/ApprovedSeriesLoader.tsx). Later migrations override the baseline: visibility, atomic saving and validation integrity (`20261102000002`–`20261102000004`), authenticated event creation and reference provenance (`20261103000000`–`20261103000001`), public version copying and administrator reason rules (`20261104000000`–`20261104000001`). Deployment of these files was not checked in this review.

## Actors and proposed accounts

There is no separate reviewer role. Any authenticated account can submit a peer validation. Ownership is independent of role. The role table supports exactly one of `user`, `editor`, or `admin` per user; do not seed combined roles or invent a `reviewer` role.

Use six persistent demo accounts plus a signed-out browser:

| Alias / proposed local email | Stored role | Purpose |
|---|---|---|
| `author-a` / `aa-demo-author-a@example.test` | `user` | Submit series, own analyses, make corrections and versions |
| `reviewer-b` / `aa-demo-reviewer-b@example.test` | `user` | Independent review; second author; attempt access to A's content |
| `reviewer-c` / `aa-demo-reviewer-c@example.test` | `user` | Opposing review and independent duplicate-review checks |
| `editor` / `aa-demo-editor@example.test` | `editor` | Series moderation; create, correct, invalidate and restore events |
| `admin` / `aa-demo-admin@example.test` | `admin` | Moderation plus permitted deletion of records and others' draft analyses |
| `no-role` / `aa-demo-no-role@example.test` | No row and no metadata role | Exercise ordinary authentication without privileged claims; compare with `user` |
| Visitor | No account/session | Public reading and denied writes |

Use separate browser profiles or explicitly sign out before switching actors. Browser-local drafts are separate from saved database drafts and may survive account switching; review this explicitly. Use a separate disposable signup address for registration/recovery cases. Local fake addresses depend on the local mail catcher; remote email cases require a controlled deliverable mailbox.

Expected permission model from code:

| Operation | Visitor | Authenticated, including no-role | Editor | Admin |
|---|---|---|---|---|
| Read posts, points, events, review records | Yes | Yes | Yes | Yes |
| Submit series / peer review | No | Yes | Yes | Yes |
| Save own analysis draft | No | Yes | Yes | Yes |
| Change series/event state | No | No | Yes | Yes |
| Create event or correction | No | Yes | Yes | Yes |
| Delete unreferenced series/event | No | No | No | Yes |
| Edit analysis configuration | No | Own draft | Own draft | Own draft |
| Delete draft analysis | No | Own draft | Own draft | Any draft |
| Create version of public analysis | No | Any public analysis | Any public analysis | Any public analysis |

With the visibility migration applied, public analysis roots and children are readable by everyone; draft and hidden content is author-only. Administrators have no special private-read permission. Draft deletion policy allows administrators, but the current client delete path also selects the deleted ID and the reader cannot load another author’s private draft; verify effective API behavior separately instead of assuming an admin UI flow exists.

## Workflow inventory

UI = present in the interface; API = database capability without a complete UI path; Review = code inconsistency or policy decision must be resolved. All outcomes below still require runtime confirmation.

### Authentication and browsing

| ID | Actor / route | Steps | Result and review focus |
|---|---|---|---|
| F01 | Visitor, `/` | Open dashboard; choose an indicator; open its data page. | Catalog metadata is visible even with no submissions; empty data state is understandable. UI. |
| F02 | Visitor, `/login` | Enter a fresh address and password; submit; follow confirmation when enabled. | Login is attempted first; `invalid_credentials` invokes signup fallback. Local confirmation is disabled in checked-in config. UI. |
| F03 | Each account, `/login` | Sign in; navigate; reload; sign out; reload again. | Correct account and permissions throughout; protected actions disappear after logout. UI; see G05. |
| F04 | Account, `/login` | Choose password recovery; request email; open link; set password; sign in again. | Correct recovery/base-path redirect; invalid/expired link and wrong-password feedback. UI; local mail catcher or configured remote mail required. |
| F05 | Visitor or account, `/postlist` | Filter by status, search text, date range and sort; open result; revisit filter URL. | Matching posts and empty results; filters survive URL navigation. UI. |
| F06 | Visitor or account, `/indicators/{ID}/data` | Open populated indicator; select source; resolve overlapping dates where offered; inspect chart and post links. | Approved observations shown with source provenance; pending/rejected/disabled records excluded from approved data. UI; fetched on browser mount, not a build-time snapshot. |
| F07 | Visitor or account, detail routes | Open missing/invalid post or analysis ID; open empty lists; simulate unavailable connection manually. | Spanish failure/empty states; unknown data validity must not be reported as confirmed invalidation. UI. |

### Series, peer reviews and moderation

| ID | Actor / route | Steps | Result and review focus |
|---|---|---|---|
| F08 | A, `/series/{frequency}/{ID}` | Select a catalog indicator with matching frequency; enter source, URL, notes and points; add/remove rows; submit; open result. Repeat annual, monthly and quarterly. | Atomic post plus points, initially `pending`. Annual input `YYYY` is stored as January 1; monthly/quarterly input uses `YYYY-MM-DD`. UI. |
| F09 | A, same form | Enter partial data; reload; resume; use form reset; attempt empty/invalid values; repeat signed out. | Draft recovery/reset and validation; signed-out submission denied. No partial database series on failed RPC. UI. |
| F10 | B, `/post?id={PENDING_ID}` | Read A's submission; select approval and notes; submit; revisit detail and `/user/reviews?userId={B_ID}`. | One review by B; series remains pending until moderation. UI. |
| F11 | C, same post | Submit rejection with notes; inspect reviews after voting; attempt a second vote as B. | Conflicting reviews coexist; unique `(post_id, validated_by)` prevents duplicate vote. Pending-post UI reveals other reviews after the current account has voted. UI. |
| F12 | A / any account | Attempt self-review; attempt review on nonpending post through API; attempt updating an existing review. | Self-review and review updates are denied; another account may review in any series status. UI/API; verify append-only enforcement. |
| F13 | Editor, post detail | Inspect reviews; select approved; save; inspect post and approved-data consumers. Repeat rejection on a separate pending post with reason. | Explicit moderator decision; no vote threshold or automatic approval exists. History records actor, time and reason. UI. |
| F14 | Editor or admin, post detail | Change an approved series to rejected/pending/disabled with reason; try without reason; inspect saved analysis referencing it. | Reason required when losing approval or entering rejected/disabled; analysis retains original points and shows warning/history. UI. |
| F15 | Editor or admin, post detail | Revisit a rejected post; approve or return to pending; disable a separate post; attempt reactivation. | RPC permits transitions among pending/approved/rejected; editors cannot leave disabled, but administrators can reactivate it with a reason. Repeat same status and check no extra history entry. UI/API. |
| F16 | A then editor | Submit corrected content as a new post; moderate the new post; disable the old one when appropriate. | Original content remains immutable; existing analyses are not silently redirected to the replacement. UI. |
| F17 | A/B, `/user?userId={ID}` and `/user/reviews?userId={ID}` | Open each actor's posts and reviews; follow post links; use another user ID. | These lists can address a selected user; inspect actual visibility rather than assuming private workspace access. UI. |
| F18 | Admin, API | Delete an unreferenced disposable series; attempt deletion of one referenced by an analysis; repeat as editor/user. | Admin-only RPC; references block deletion; successful deletion cascades points/reviews. No series-delete button found. API. |

### Macro events

| ID | Actor / route | Steps | Result and review focus |
|---|---|---|---|
| F19 | Visitor/account, `/eventos` | Open list (also verify the legacy `/admin/macro-events` redirect); inspect topics, dates, source and geography. | The catalog is public; read and write capabilities are distinct. UI. |
| F20 | Any authenticated account, event administration or analysis builder | Create event with name, topic, source URL, start/end dates and geography; save; select it in an analysis. | New event is valid; no privileged role is required. Form handles required fields and date range. Repeat all five topics across fixtures. UI. |
| F21 | Editor/admin, event list | Choose “Crear corrección”; change content; save. | A new event ID is created; original event and saved references remain unchanged. UI. |
| F22 | Editor/admin, event list | Invalidate a referenced event with reason; inspect analysis; restore event; inspect history. | Invalid event remains in saved analysis, cannot be newly selected, and can be restored. Missing reason fails invalidation; administrators also need a reason for restoration. UI. |
| F23 | Admin, event list | Cancel deletion once; then delete disposable unreferenced event; attempt deletion of referenced event. | Confirmation and successful deletion only when unreferenced; FK protects references. Editor/user cannot delete. UI. |

### Analyses

| ID | Actor / route | Steps | Result and review focus |
|---|---|---|---|
| F24 | Visitor/account, `/analisis/nuevo` | Choose indicators, title, description, region; add/edit/remove periods and colors; compare calendar/index-zero alignment and base-100 line. | Chart/table update; regions and alignment are presentation configuration. Anonymous persistence must fail. UI. |
| F25 | Author, builder | Use overlapping approved sources; choose source per conflict; include points with only one source; choose events and marker colors/start/end/both/none. | Saving records every displayed point's source and selected event settings. Invalid events cannot be newly selected. UI. |
| F26 | Author, builder | Configure draft; reload; resume local draft; reset; save as database draft; open `/user/analisis` and `/analisis?id={ID}`. | Local draft and persisted analysis remain distinguishable; title, periods, points and markers survive reload. UI. |
| F27 | A, `/analisis/editar?id={DRAFT_ID}` | Edit own draft; save; reopen. As B/admin, attempt editing A's draft content. | Author may edit; others cannot modify child configuration. Saving uses the atomic RPC; verify rollback on failure. UI. |
| F28 | A, builder | Select public for a new configured analysis; save; separately try publishing an existing draft. | The save_analysis RPC writes draft configuration atomically and then applies the requested status. Verify complete publication and rollback on failure. UI. |
| F29 | Reader, `/analisis?id={ID}` | Open saved analysis; switch display alignment; inspect data/event tables and source links. | View-time alignment does not rewrite stored content. Verify anonymous reads of public content and denial for draft/hidden content. UI. |
| F30 | Any account for public; author for hidden analysis | Choose “Crear nueva versión”; inspect new draft, predecessor and copied references; modify draft; publish. | New ID linked to immediate predecessor; old content unchanged; B/admin can copy A's public analysis into their own draft, but cannot copy A's hidden analysis. Hidden analyses are accepted without changing their visibility; the successor remains a private draft. UI. |
| F31 | Author, analysis visibility | Attempt public-to-hidden and hidden-to-public status-only updates; try returning published content to draft. | Database allows visibility changes but blocks return to draft/content mutation. Author controls exist in the reader; return to draft remains blocked. UI/API. |
| F32 | A/admin, draft reader | Cancel deletion; delete own draft as A; attempt admin deletion of B's disposable draft through the API; try B deleting A's draft and try deleting public/hidden analysis. | Owner draft deletion is exposed in the reader; admin policy and private-read interaction require separate verification. Child configuration cascades. Published versions remain protected. UI. |
| F33 | Editor then A/reader | Invalidate referenced series/event; reopen analysis and `/user/analisis`; inspect warnings, original points and history; create corrected version and replace invalid references. | Old analysis keeps its sources and warnings; corrected draft/version uses explicit new references. UI. |
| F34 | A then editor | Save analysis; later add/approve alternative source and new dates; reopen original. | Existing analysis does not acquire new observations or silently switch sources. UI. |
| F35 | Reader | Inspect a legacy/incomplete-reference scenario and simulated fetch failure. | Existing analyses carry unverified reference provenance; new saves use capture version 1, and copied versions inherit provenance. Missing history is unavailable, missing evidence is unknown; never fabricate historical actor/reason or infer original missing points. Review with dedicated fixtures only. |

### Administrative and negative paths

| ID | Actor | Steps | Result and review focus |
|---|---|---|---|
| F36 | Provisioning operator, then account | Create Auth identity; assign role in trusted backend; sign in; change/remove role; refresh session or sign in again. | Table trigger synchronizes metadata; issued JWT keeps old claims until refresh. Browser cannot assign itself a role. API. |
| F37 | Visitor, no-role, B, editor | Attempt protected RPCs and direct writes using each real session; attempt another user's identity in review/analysis payloads. | Verify authorization in PostgreSQL, not just hidden controls. Use scoped disposable data; capture actual errors and before/after state. Manual verification, not generated tests. |
| F38 | Reader/operator | Inspect validation summary and duplicate detector with conflicting/identical points. | Views exist; no dedicated moderation dashboard for these views was found. API/database inspection only. |

Not currently separate supported workflows: OAuth/MFA setup, profile editing, browser role administration, bulk CSV import/export, editing submitted series in place, or an analysis public-search catalog. `UserEdit.tsx` references `/edit/{id}` but is not mounted by current routes; do not use it as a supported correction flow.

## Original findings and current verification status

These are repository findings, not new runtime results. G01–G08 are retained to map the original plan to implementation.

| ID | Current implementation | Remaining verification |
|---|---|---|
| G01 | `saveAnalysis` calls transactional `save_analysis`; configuration is saved as draft before publication. | Browser save/edit/publish and rollback on invalid configuration. |
| G02 | Visibility migration restricts draft/hidden roots and children to the author and adds a status CHECK. | Confirm deployment and access using real sessions; inspect admin draft-delete interaction with SELECT policy. |
| G03 | Validation integrity migration rejects self-review and revokes browser update/delete/truncate. Reviews on others’ series are allowed in every status. | Real-session duplicate, identity and mutation attempts. |
| G04 | Validation integrity migration removes legacy series update policies and replaces the content-immutability trigger. | Effective privileges after all migrations; JWT role checks on protected RPCs. |
| G05 | Analysis viewer uses the shared auth-session hook. | Logout and refreshed roles without a page reload. |
| G06 | `ApprovedSeriesLoader` queries approved data when mounted in the browser. | Reload after moderation; no realtime subscription or automatic refresh is promised. |
| G07 | Automatic seed execution is disabled; packageManager and Volta pnpm declarations agree; README refers to package configuration. | Bootstrap/reset in an explicitly selected disposable environment. |
| G08 | Database guide describes annual SQL date storage and current transitions/reason requirements. | Editors cannot reactivate disabled series; admins can, and need reasons for every actual series/event change. |

## Provisioning design

### Local account script

`pnpm run demo:users` provisions the six accounts above in local Supabase only. Copy `.env.demo.example` to `.env.demo.local` and fill in the local API URL, anon key and service-role key shown by `pnpm run supabase:status`. Start local Supabase and apply the reviewed migrations first. The script checks Auth and the role table before writing; it does not verify the complete migration history. It rejects non-loopback targets and does not support remote projects.

On the first run it generates passwords in `.demo-users/credentials.json` and records target fingerprint, ownership marker and user IDs in `.demo-users/manifest.json`. Both files are ignored by Git and restricted to the local owner. Look up each password in the credentials file; the script prints only emails, roles and IDs. Keep both files together. A rerun preserves passwords and verifies fresh logins and metadata roles. Existing emails without the manifest marker cause the entire run to stop before account changes. If creation was interrupted before recording an ID, the marker allows recovery on rerun. If either local file is missing or the target changes, the script stops for manual investigation; it does not delete accounts or data. The no-role account has no role row or metadata role.

The service-role key is sensitive; use it only in the ignored local file. The script creates no series, analyses or other domain fixtures. The proposed plan/report/data/cleanup commands below remain unimplemented.

### Review progress (2026-11-05)

This review compared repository code, configuration, provisioning script and migrations. No database connection, account provisioning, browser walkthrough, build or test run was performed for this documentation update. Applied local/remote migration state and existing demo accounts are unverified.

Earlier notes recorded local rollback-only SQL exercises with simulated JWT claims for atomic saving, public/private reads, self-review denial, review immutability, editor transitions and authenticated event creation. Those historical observations are not real-session/browser coverage and were not repeated here. Earlier statements that only five migrations existed and that G01–G04 remained unimplemented are superseded by the current inventory above.

Account provisioning is implemented, but this review does not certify successful execution or safe reruns against the current local instance. Optional fixture generation, reporting and cleanup remain proposed. All workflow rows remain `not run` for this review.

### Scope and interfaces

Implement a Node/TypeScript administrative script under `scripts/`, using installed Supabase SDK and generated `Database` types. Keep it outside the browser import graph. Administrative and per-user clients belong only to this tooling; preserve the singleton application client.

Prefer Auth Admin API creation followed by trusted `user_roles` upsert. Avoid hand-written inserts into `auth.users`/`auth.identities`. The existing trigger writes the scalar role into `app_metadata.role`; role authorization in application code must still use the current session, never query `user_roles`. The no-role account gets neither a role row nor a role metadata key.

Provisioning scripts:

| Script | Behavior |
|---|---|
| `demo:plan` | Read-only preflight; resolve target, schema prerequisites, existing managed identities and intended changes; redact credentials |
| `demo:users` | Implemented for local Supabase: create/reconcile the six managed accounts and role rows; no domain records |
| `demo:data` | Optional staged domain fixtures using generated manifest IDs and real actor sessions |
| `demo:report` | Read-only report of identities, roles and fixture links; never print passwords, keys or JWTs |
| `demo:cleanup` | Explicit removal of manifest-owned data and accounts; refuse unknown IDs or externally referenced fixtures |

Register scripts in `package.json` before running any of them; future invocations use `pnpm run <script>`. Start with `demo:users` only for a genuinely manual empty-to-full journey. `demo:data` is optional and must not silently run during ordinary development or deployment.

The remaining sections describe future tooling requirements, not capabilities guaranteed by the existing accounts-only script. In particular, full migration preflight, fixture checkpoints, reporting and cleanup are not implemented.

### Target and secrets

Default to local Supabase. Require an explicit dedicated-project target and reference match for remote demo provisioning; no production target. Do not infer destination from linked CLI caches or silently fall back from missing local variables to `.env`.

Use a dedicated ignored environment file with server-only URL, anon key, service-role key and account-password inputs. Add its ignore rule before creating it. Commit only a template without values. Store passwords separately from the manifest, or generate them into a local file with owner-only permissions; never put secrets in committed fixtures, logs, URLs or `PUBLIC_*` variables.

Check for a reachable Auth service, expected schema/RPCs, applied migration versions, and project identity before any write. “Empty” has two supported meanings: no domain rows with migrated schema, or a fresh Supabase project needing schema initialization. For the latter, apply reviewed migrations before provisioning; remote migration application needs separate explicit authorization.

### Idempotency and recovery

1. Read a versioned local manifest containing target identity, fixture-set name, account IDs, record IDs and completion checkpoints.
2. Paginate Auth account listing when checking email collisions. Reuse only manifest-owned users with matching target and provisioning marker; stop on unrelated collisions.
3. Create missing users with email confirmed for routine walkthroughs. Registration/confirmation itself uses a separate disposable flow, not these auto-confirmed users.
4. Upsert roles only for managed IDs; let the synchronization trigger populate metadata. For no-role, remove any managed role row and verify missing metadata role without removing unrelated metadata.
5. Obtain fresh per-user sessions after role assignment. Verify identity and effective role; never use an admin session as proof of ordinary-user access.
6. Persist each completed step immediately. On failure report the exact stage and recoverable IDs; rerun resumes without duplicate users, votes or series. Do not reset passwords or domain states silently on rerun.
7. Report email, role, ID and useful links. Supply credentials only through the protected local credentials file.

Auth creation and role assignment are not one transaction. If creation succeeds and role assignment fails, retain the recorded user ID and resume; do not create another identity. Domain generation must likewise distinguish incomplete work from completed/reviewed fixtures.

### Sample data modes

Use deterministic synthetic data with Spanish visible labels, explicitly marked as demonstration data. Select actual catalog indicator IDs and native frequencies from `src/data/indicators.json`; do not invent indicator codes or imply synthetic values are real economic measurements.

| Dataset | Minimum contents | Coverage |
|---|---|---|
| Empty | Accounts only | Empty UI, login and full manual creation |
| Series | One annual, monthly and quarterly approved series; two approved overlapping sources for one indicator with conflicting values; one identical overlap; pending, rejected and disabled posts; unreferenced disposable post | Forms, source selection, duplicate view, state filters, deletion |
| Reviews | B approval and C rejection on the same pending post, with separate unused pending posts | Review visibility, conflict, uniqueness, moderator independence |
| Events | Five topics; point and interval events; valid and invalid events; referenced and disposable unreferenced events | Creation, correction, invalidation, restoration and deletion |
| Analyses | A and B drafts; complete public analysis; hidden record; public predecessor plus draft successor; analysis referencing subsequently invalidated series/event | Ownership, versioning, source stability, history, visibility, deletion |
| Edge cases | Separate explicit legacy-reference/history fixture set | Unknown provenance; never mix intentionally incomplete fixtures into normal happy path |

Choose overlapping dates and at least two analysis periods so charts and conflicts are visible. Record catalog choices in the manifest. Use actor-authenticated `create_series_with_points`, peer-review inserts, `change_record_status`, event inserts, and version RPCs so provenance is real. Seed complete analysis configuration as a draft before publishing with the author's session; do not bypass the application RPC with service-role writes and then claim the UI works.

Generate history by real state transitions, not fabricated SQL history rows. A setup workaround must be disclosed in the fixture report and leaves the corresponding UI flow unverified.

### Cleanup

Delete only exact manifest-owned IDs, in dependency order: analysis successors before predecessors and their references, then series/points/reviews and events, then role rows and Auth accounts. Account deletion alone does not remove all domain rows because ownership fields do not universally have cascading Auth foreign keys. Account removal does not revoke already-issued JWTs immediately; dispose of demo sessions after cleanup.

Stop if user-created analyses reference fixtures or if ownership differs from the manifest. Preserve manual work by default. A full local database reset is a separate destructive choice, never the default cleanup or rerun strategy. Preserve status history unless an explicit fixture-cleanup operation targets its recorded IDs.

## Incremental implementation backlog

Each phase can be requested and reviewed independently. No automated tests are to be created unless explicitly requested later.

| Phase | Deliverables | Completion criteria / dependency |
|---|---|---|
| P0 — Environment and behavior baseline | Read-only target/schema inventory; resolve seed-file configuration; record current findings G01–G08 and target decision | Environment is identified as local/dedicated; migration state known; distinguish observed runtime errors from static findings |
| P1 — Accounts only | Script, environment template, ignore entries, manifest format, package scripts and operating documentation | Six accounts log in with expected claims; rerun makes no duplicates or unexpected changes; missing role has no privilege; no domain data required |
| P2 — Series and review walkthrough | Manual execution of F01–F18, F36–F38; optional series/review fixtures | A submits, B/C review, editor moderates; anonymous/ordinary/editor/admin differences verified using real sessions; failures recorded |
| P3 — Events | Optional event fixtures; review F19–F23 | Both moderation roles work; admin-only deletion and reference protection demonstrated |
| P4 — Analysis lifecycle corrections | Implemented in code: atomic saving, visibility and shared auth. Verify G01/G02/G05 with real sessions | Complete save/edit/publish/version flow with no partial persistence; immutable published content; ownership enforced |
| P5 — Analysis fixtures and complete journey | Optional analysis fixtures; review F24–F35 | Original references remain stable; invalidation warnings/history appear; correction through a new version works; privacy behavior documented |
| P6 — Repeatability and handoff | Report/cleanup commands, operator instructions and completed manual review record | Resume after failure, safe rerun and scoped cleanup demonstrated; unrelated data preserved; all task-started processes stopped |

P1 tooling exists; its completion criteria still require runtime evidence. P2/P3/P5 walkthroughs and P6 tooling remain pending. P4 implementation exists, but complete-journey claims require its runtime verification.

## Verification and final review record

For every flow, record: flow ID, actor email/role, target, record IDs, steps, expected result, actual result, error text where applicable, and status (`not run`, `passed`, `failed`, `blocked`). Include separate UI and database authorization observations. These are manual review notes, not generated test code.

Verified for this review: `pnpm` resolves to `/usr/bin/pnpm` and reports 12.16.1. Commands mentioned here map to package scripts; provisioning implementation was read but not executed. Historical CLI/SDK version snapshots have been removed. Before execution, verify installed binaries, local help and target configuration again.

For future TypeScript/React/Astro changes, use the existing package build/check scripts and relevant browser verification. The existing integration suite creates users and mutates data; it requires the explicit authorization and isolated-target safeguards in AGENTS.md. Do not run it automatically as part of demo provisioning. No new tests are authorized by this planning request.

Before a production-preview walkthrough, build/preview using project scripts. Approved observations load in the browser; new database fixtures do not require rebuilding the indicator page shell. Verify local redirects, base paths and mail behavior against the chosen environment. Track and stop every process started for review, preserving pre-existing processes.

Overall acceptance: the user can create the six accounts repeatably, perform each available flow with the appropriate actor, see unresolved flows clearly marked, optionally load only the fixtures needed for a particular review, and remove managed data without damaging unrelated work.
