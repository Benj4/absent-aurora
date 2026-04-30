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

- **Tailwind only**: No custom CSS except in `src/styles/global.css` for CSS variables
- **Dark mode**: Use `class` strategy (not media queries)
- **Responsive grid**: `grid-cols-[repeat(auto-fit,minmax(220px,1fr))]` for BentoGrid
- **CSS variables**: `--theme-accent`, `--theme-foreground`, `--theme-background`, `--theme-heading1-6`
- **Font**: JetBrains Mono Variable applied globally via `font-family` in body

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

- **Admin client**: `getAdminClient()` for setup/teardown only (bypasses RLS)
- **User clients**: `getAuthenticatedClient(email, password)` for policy tests
- **Cleanup**: Always call `cleanupTestData()` in `afterAll`
- **Timeout**: 30s for database operations (`vitest.config.ts`)
- **Orphaned data**: Failing tests leave orphaned data — always run cleanup in hooks

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

