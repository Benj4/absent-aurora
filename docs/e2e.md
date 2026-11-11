# Manual Puppeteer E2E

This tooling executes human-recorded Chrome DevTools Recorder JSON and future explicitly requested Puppeteer cases. It does not generate application tests. Use the existing Linear issue-creation skill to define future cases, assertions, fixtures and evidence. No new Linear skill or mandatory report format is required.

## Setup

Use the Node and pnpm configuration in `mise.toml` and `package.json`. Install dependencies with `pnpm install`, then explicitly install Puppeteer's compatible Chrome with `pnpm run e2e:install`. The lockfile pins the dependency resolution; Puppeteer selects its supported browser build. Installation scripts are disabled for Puppeteer in `pnpm-workspace.yaml`, so browser downloads are never triggered by replay. Chrome is cached in Puppeteer's default user cache (`~/.cache/puppeteer` on Linux). It is separate from system Chromium. `yauzl` allows extraction without a system `unzip`.

Start Docker and local Supabase manually with `pnpm run supabase:start`. Inspect configuration with `pnpm run supabase:status`. Configure `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in ignored `.env.local` using the local instance values. Use synthetic accounts and data.

Start Astro yourself with `pnpm run dev`, or run `pnpm run build` followed by `pnpm run preview`. Changing environment variables requires restarting development or rebuilding preview. The runner never starts/stops Astro or Supabase, resets the database or cleans data. Existing `supabase:clean` and `supabase:reset` scripts are separate, manual destructive operations; they are not troubleshooting prerequisites.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run e2e:install` | Explicitly install compatible Chrome. |
| `pnpm run e2e:doctor` | Check prerequisites, launch an isolated blank browser, print its version and close it. No recorded actions or data writes. |
| `PUPPETEER_HEADLESS=false pnpm run e2e:doctor --inspect` | Keep that blank browser open until Ctrl+C, for installation/lifecycle troubleshooting. |
| `pnpm run e2e:replay tests/e2e/recordings/<journey>.json` | Execute reviewed Recorder JSON manually. |
| `pnpm run e2e:replaytest` | Existing shortcut for the series-insert recording; it can write application data. |
| `pnpm run e2e:test` | Execute future `tests/e2e/cases/*.e2e.ts` cases. An empty suite fails. |
| `pnpm run e2e:check` | Check JavaScript tooling syntax; does not run browser checks. |

`E2E_BASE_URL` selects the local app root, including any base path. It is provided in `.env.example` and local `.env` / `.env.local`. All entry points, including direct `node scripts/e2e-doctor.mjs` invocation, load `.env.local` before `.env`; existing shell variables take precedence. E2E does not load `.env.test` or demo-account files. Doctor and Vitest default to `http://localhost:4321/`. Replay otherwise derives the origin from the first navigation. Recorded URLs are not rewritten: record and replay against the same origin. Set `PUPPETEER_HEADLESS=false` for visible Chrome. If overriding the browser with `PUPPETEER_EXECUTABLE_PATH`, you are responsible for its compatibility; the managed Chrome is preferred.

## Prerequisites and diagnostics

Before any recorded actions or Vitest cases, the runner:

1. Rejects CI and non-loopback application URLs.
2. Checks the app root and its `e2e-environment.json` endpoint. This endpoint contains only an application marker and the public Supabase URL, captured from the same Astro environment as the application. It also works in static preview, so stale production configuration is detected instead of trusting current `.env` files.
3. Requires that URL to be local, then requests its `/auth/v1/.well-known/jwks.json` endpoint without keys or credentials. A successful JSON response with a `keys` array confirms Supabase Auth responds. An empty array is valid for projects using legacy symmetric JWT keys.
4. Checks the Chrome executable before launch and prints the actual browser version after launch.

Missing prerequisites stop execution with the applicable startup/configuration commands. The runner uses HTTP only to check Supabase availability; it does not invoke Supabase CLI or require Docker socket access. Docker remains necessary to start local services manually. HTTP checks have bounded timeouts and reject redirects. They do not prove application assertions or RLS correctness.

Replay reports step number, zero-based JSON index and type. Errors omit raw selectors, values and exception stacks to avoid leaking recorded credentials. A timeout can mean missing authentication or an incorrect page state; simply increasing it may not help.

## Browser lifecycle

Each replay gets a new temporary browser profile, independent of your normal Chrome session. The runner owns browser launch and closes it in `finally` on success/failure. SIGINT (Ctrl+C) and SIGTERM close owned resources. Cleanup waits for browser exit, with a bounded forced-stop fallback. It never kills pre-existing Astro, Supabase or browser processes. SIGKILL cannot be handled by application code.

Future Vitest cases must use `launchE2EBrowser` from `scripts/e2e-browser.mjs` instead of launching unmanaged browsers. The E2E setup file closes managed browsers after each file, including failures; cases should close isolated contexts in their own teardown. Do not create application cases as part of infrastructure setup.

## Human recordings and future cases

Open Chrome DevTools → More tools → Recorder. Record a complete journey from a clean session, including login where needed. Wait for an authenticated state before protected actions. Replay in Recorder, add meaningful visible assertions, export **JSON**, and review it before saving under `tests/e2e/recordings/`.

Recordings may contain passwords in selectors as well as input values. Do not commit personal credentials. Removing a password without replacing its input source prevents automated login. Future cases can inject credentials through environment variables; the replay runner does not perform placeholder substitution or automatic authentication.

Keep human recordings as baselines. Generate derived cases only on explicit request, citing the source, changed inputs, expected outcomes and fixture requirements. Follow `tests/e2e/AGENTS.md`, use locators and condition-based waits, and preserve unit/RLS suite separation. Execution is manual, outside CI, with no automatic retries or watchers. Optional screenshots and other reviewed evidence belong in ignored `.e2e-artifacts/`; redact secrets before sharing.

## Official references

- [Recorder export and assertions](https://developer.chrome.com/docs/devtools/recorder/reference)
- [Puppeteer Replay](https://github.com/puppeteer/replay)
- [Puppeteer installation](https://pptr.dev/guides/installation)
- [Browser cleanup](https://pptr.dev/api/puppeteer.browser.close)
- [Astro static endpoints](https://docs.astro.build/en/guides/endpoints/)
