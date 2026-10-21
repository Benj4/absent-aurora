# Coding Conventions & Patterns

## Code Style

- **Astro components**: TypeScript in front matter (`---`), HTML in body, `<script>` for client-side
- **Type safety**: Import `SeriePost`, `SerieDataPoint` from `src/lib/supabase.ts` — never redefine
- **Early returns**: Prefer guard clauses over nested conditions
- **Error handling**: Always check `error` in Supabase responses before accessing `data`
- **Spanish UI**: All user-facing text must be in Spanish (`placeholder`, `label`, error messages)

---

## TypeScript Constraints

```typescript
// ✅ CORRECT
import { supabase } from '../lib/supabase';
import type { SeriePost } from '../lib/supabase';

// ❌ NEVER — DO NOT create multiple clients
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(...);
```

---

## Styling Rules

- **DaisyUI foundation**: Keep DaisyUI as the visual foundation. Use its component classes, such as `btn`, `input`, `card`, `alert`, and `table`, with Tailwind utilities for layout, spacing, and responsive adjustments.
- **Style entry point**: `src/styles/global.css` imports Tailwind and registers DaisyUI. Tailwind is integrated through the Vite plugin in `astro.config.mjs`. Keep shared CSS, font declarations, and theme customizations in the global stylesheet; prefer utilities for component styling.
- **Semantic colors**: Prefer DaisyUI roles such as `primary`, `base-100`, `base-200`, `base-content`, `success`, and `error` over fixed colors for application surfaces, text, and feedback.
- **Themes and dark mode**: The global stylesheet explicitly enables DaisyUI’s `light` default theme and `dark` theme for the system dark preference. Keep theme configuration here. `tailwind.config.mjs` declares `darkMode: 'class'`, but the stylesheet does not explicitly load that config. Do not assume this declaration controls the active theme or Tailwind's `dark:` variant. Review the stylesheet and layout when changing theme behavior.
- **Forms**: Use `input`, `select`, and `textarea` directly; their borders are built in. Do not use removed `*-bordered`, `form-control`, or `label-text` classes. Use Tailwind layout utilities to group labels and controls, and allow long labels to wrap. Preserve DaisyUI’s default focus indicators.
- **Simple composition**: Prefer DaisyUI classes directly in existing markup. Add wrappers or shared components only when they remove meaningful duplication or centralize shared behavior. Keep Tailwind for layout and specialized UI, including chart containers.
- **Responsive grid**: The dashboard uses `grid-cols-[repeat(auto-fit,minmax(220px,1fr))]` for its indicator grid.
- **Typography**: JetBrains Mono Variable is declared in `src/styles/global.css` and explicitly applied to `code`. It is not currently set as the global body font.

### Tokens, Components, and Patterns

- **Tokens**: Use DaisyUI's semantic theme roles and Tailwind's utility scales as the shared base. The project does not currently define a separate application token layer or the previously documented `--theme-*` variables.
- **Components**: Reuse existing shared and domain components. DaisyUI classes can be used directly; a dedicated React or Astro wrapper is not required for every control. Extract a component when repeated markup or behavior benefits from a shared implementation.
- **Patterns**: Forms, filtered lists, loading indicators, errors, and empty states currently live in individual domain components. There is no separate pattern catalog. When updating these flows, follow nearby implementations and keep labels, validation, feedback, and accessibility consistent.

---

## Data Validation

- **Annual dates**: `YYYY` (e.g., `"2024"`)
- **Monthly/Quarterly dates**: `YYYY-MM-DD` (e.g., `"2024-01-15"`)
- **Numeric precision**: `NUMERIC(20, 6)` in database
- **Unique constraints**: `(post_id, validated_by)` prevents duplicate validations

---

## Supabase Patterns

```typescript
// ✅ Fetch posts with nested data
const { data, error } = await supabase
  .from('serie_posts')
  .select(`
    id, indicator_id, data_source, url, frequency, status,
    serie_data(id, date, value)
  `)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Error:', error);
  return; // Show user-friendly message in Spanish
}

// ✅ Auth check
const { data: { user } } = await supabase.auth.getUser();

// ❌ NEVER use process.env in client code
// ✅ Use import.meta.env.PUBLIC_*
```

---

## Testing Rules

- **Unit tests**: Keep isolated tests under `tests/unit/`; `pnpm test` must not contact external services.
- **Integration tests**: Keep Supabase and RLS tests under `tests/rls/` and run them explicitly with `pnpm test:integration`.
- **Test project only**: Integration tests require a local or dedicated Supabase test project and the safety variables documented in `.env.test.example`.
- **Admin client**: Use `getAdminClient()` for setup and teardown only; it bypasses RLS.
- **Unique accounts**: Every integration run must create its own users and delete only those users.
- **Scoped cleanup**: `cleanupTestData()` must receive the exact test-user IDs for the current run. Never delete all rows from a table.
- **Timeout**: Integration database operations use 30-second test and hook timeouts in `vitest.integration.config.ts`.

---

## Astro Component Template

```astro
---
// Server-side TypeScript
import Layout from '../layouts/Layout.astro';
import { supabase } from '../lib/supabase';
import type { SeriePost } from '../lib/supabase';

const { data, error } = await supabase.from('serie_posts').select('*');
if (error) return Astro.redirect('/');
---

<Layout>
  <h1>Título</h1>
  <!-- HTML content -->
</Layout>

<script>
  // Client-side JavaScript
</script>
```
