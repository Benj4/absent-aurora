# Cloudflare deployment and rollback

## Migration state

ZEH-21 is in progress. The repository is prepared for Cloudflare Workers Static Assets, but no Worker, repository trigger, production build variables, Auth settings, or live deployment have been created or changed by this work. Do not describe the migration as complete until the production evidence below is recorded.

Verified account: `e868d8631a8f4ce28fc234b5d8a506ce`. Its existing Worker uses `bdiazcaballero.workers.dev`. The selected new Worker name is `absent-aurora`; the candidate URL is `https://absent-aurora.bdiazcaballero.workers.dev`. That URL is a proposed destination, not proof of deployment.

GitHub repository: `Benj4/absent-aurora`. Existing production: `https://benj4.github.io/absent-aurora/`. The last successful Pages workflow returned by GitHub on 2026-11-13 was [run 43345956589](https://github.com/Benj4/absent-aurora/actions/runs/43345956589), commit `20d837655365ed78b9d1578cc62bf1be1eb6574f` on `staging`. The Pages settings API was unavailable without authentication; the deployed Pages revision and settings still need confirmation before cutover. The initial local checkout was `d6eee301b98e835f1467c21e4e376a1e3aa1f500`.

Local validation on 2026-11-13: frozen-lockfile install passed; `pnpm run check` reported no errors, warnings, or hints; the static build generated 32 pages; `pnpm run deploy:dry-run` validated 114 static files without uploading. Missing public variables, local Supabase URLs for Cloudflare, and a `staging` deployment were rejected. The official Astro preview returned HTTP 200 for `/`, `/indicators/E01/data/`, `/post/?id=example`, and `/analisis/?id=example`, and HTTP 404 for an unknown route. This verifies static HTTP responses, not client-side data or query behavior. Preview was stopped and its status confirmed no running server. Browser verification could not run because the browser access host was unavailable. Production Auth flows, charts and write operations remain unverified.

## Build and publication

Use scripts in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm run preview
pnpm run build:cloudflare
pnpm run deploy:dry-run
```

`cf`, its configuration parser, and the Build Output utilities are pinned together because their beta interfaces can change. `scripts/package-cloudflare.ts` packages the existing Astro `dist` with the official utilities. No adapter, Worker handler, SSR, or database migration is required. `.cloudflare/output` is generated and ignored. Do not use `cf init` here: its Astro auto-configuration installs an adapter. `cf deploy --prebuilt` consumes the validated output without rebuilding or reconfiguring Astro.

`pnpm run build` fails before bundling when required public Supabase variables are missing or a privileged key is supplied. Shell variables take precedence over dotenv files. Cloudflare builds additionally reject local or non-HTTPS Supabase URLs. Only the public URL and anonymous/publishable key belong in browser code; service-role credentials and Cloudflare deployment tokens must never use the `PUBLIC_` prefix.

Astro loads application environment files for its active mode, preserving its standard precedence. The separate build preflight validates production files without injecting them into development. Set configuration variables such as `SITE_URL` and `DEPLOY_TARGET` in the shell or build platform environment; Astro configuration does not preload dotenv files.

After deployment authorization, create the Worker and connect it to the existing GitHub repository in Workers Builds. Record the connection and trigger IDs. Configure:

| Setting | Required value |
| --- | --- |
| Repository / root | `Benj4/absent-aurora` / repository root |
| Production branch | `master` |
| Preview builds | Disabled initially |
| Build command | `pnpm install --frozen-lockfile && pnpm run build:cloudflare` |
| Deploy command | `pnpm run deploy` |
| Node runtime | Match `mise.toml` |
| Package manager | Exact `packageManager` in `package.json` |
| `SKIP_DEPENDENCY_INSTALL` | `true` (the build command installs with the frozen lockfile) |
| `PUBLIC_SUPABASE_URL` | Existing production Supabase HTTPS API URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Public anonymous/publishable key for that project |
| `SITE_URL` | `https://absent-aurora.bdiazcaballero.workers.dev` |
| Deployment credentials | Cloudflare-managed build token; never committed |

`pnpm run deploy` requires the platform's `WORKERS_CI_BRANCH=master` and `WORKERS_CI_COMMIT_SHA`, matching the checkout and packaged revision. It checks the current remote `master` SHA immediately before deployment and rejects stale output; Git read access must work inside Builds. Do not override platform metadata. Configure serial production builds and confirm queue ordering/cancellation behavior in the account before enabling the trigger: the SHA check alone cannot eliminate a race after the remote check. Preserve the last successful deployment when build/check/deploy fails. A single Workers Builds trigger owns production; do not add a GitHub Actions deployment in parallel.

## Auth and cutover

Before changing Supabase Auth, export the current Site URL, allowed redirect URLs, and confirmation/recovery templates to a private operational record. Allow `https://absent-aurora.bdiazcaballero.workers.dev/login` and its `?recovery=1` destination. Keep the previous Pages destinations through the rollback window. Set Site URL to the Cloudflare origin at cutover; inspect templates for hard-coded Pages URLs. Sessions and browser drafts are origin-local and will not transfer automatically.

Validate confirmation, password recovery, sign-in/out, data reads, charts, and authorized writes with dedicated accounts and an isolated backend. Do not point write-flow previews at production or run integration tests without the repository's explicit authorization requirements.

Before retiring Pages, record:

- Deployed `master` commit, automatic Workers Builds run, Worker version and deployment IDs, and public HTTPS URL.
- Browser results for assets, navigation, direct nested routes/reloads, post and analysis query parameters, charts, and unknown-route HTTP 404 responses.
- Authentication confirmation/recovery results and the saved prior Auth settings.
- Trigger evidence that only `master` promotes, serialized build behavior, and failure evidence that a rejected build preserves the prior deployment.

Only after that evidence exists, remove Pages deploy/upload jobs, `pages:write`, `id-token:write`, and Pages-specific concurrency/environment settings from `.github/workflows/astro.build.yml`. Preserve useful validation. Update README and AGENTS to mark Cloudflare active and record the verified URL. Old GitHub Pages links cannot receive Cloudflare HTTP redirects: retain a Pages transition artifact or explicitly agree on their retirement before disabling Pages hosting.

## Rollback

For a failed Cloudflare build, preserve the currently serving version. For a bad published version, disable the Builds trigger first, then redeploy the previous known-good Worker version from Cloudflare's deployment history. Record its commit/version and verify HTTPS, nested routes, and Auth before restoring automatic builds. Inspect `pnpm run cloudflare workers deployments --help` for the pinned CLI's operations before making changes.

To restore GitHub Pages after cutover, recover `.github/workflows/astro.build.yml` and the known-good source from the recorded pre-cutover revision in a reviewed rollback change. Preserve or archive its artifact before GitHub retention expires. Re-enable Pages' GitHub Actions source and workflow permissions. Build explicitly with `DEPLOY_TARGET=github-pages`, `GITHUB_REPOSITORY_OWNER=Benj4`, and `GITHUB_REPOSITORY=Benj4/absent-aurora`; the existing workflow now sets the target explicitly. Restore saved Supabase Site URL/template settings while keeping both origins allowed. Verify assets, navigation, nested routes and authentication under `/absent-aurora/`. No custom domain or DNS change is part of this migration.

References: [cf project builds](https://developers.cloudflare.com/cf/projects/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
