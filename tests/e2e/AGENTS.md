# Manual E2E contract

- Run E2E only on explicit human request. Never connect it to CI, hooks, unit tests, builds, watchers or scheduled jobs.
- Initial baselines must be human-recorded Chrome DevTools Recorder JSON in recordings/. Never fabricate a baseline.
- Preserve original recordings. Derived cases belong in cases/*.e2e.ts and must cite their source recording, changed input, expected outcome and fixture requirements.
- Use Puppeteer page.locator(), accessible or stable selectors, observable assertions and state-based waits. Do not use arbitrary sleeps or retries to hide failures.
- Use launchE2EBrowser from scripts/e2e-browser.mjs so teardown and interruption handlers own browser cleanup. Own an isolated browser context per case and close it even on failure.
- Use local Supabase and synthetic accounts only. The shared preflight verifies the served PUBLIC_SUPABASE_URL and local services before actions. Never bypass it or start/stop services or clean data automatically.
- Review recordings for passwords, tokens and personal data before committing. Inject secrets from environment variables in derived cases; never use personal browser profiles or browser service-role keys.
- Store optional screenshots in ignored .e2e-artifacts/. Review before sharing.
- Preserve immutable posts, frequency-specific dates, and session app_metadata.role checks. UI tests do not replace RLS integration tests.
- Wait for a human baseline before generating cases. Derive relevant invalid-input, date-boundary, missing-session, insufficient-role and unavailable-reference cases.
