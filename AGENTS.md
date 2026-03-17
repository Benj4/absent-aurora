# AGENTS.md - Absent Aurora Project Context

## Project Signature

**Absent Aurora** is a PostgreSQL-backed time-series data platform for submitting, validating, and visualizing economic/social indicators with immutable audit trails and peer validation workflows. Built on Astro SSR with Supabase for auth and data persistence.

---

## Tech Stack & Environment

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js (Volta-pinned) | 24.12.0 |
| **Package Manager** | pnpm (Volta-pinned) | 10.26.1 |
| **Framework** | Astro (SSR + Static) | 5.16.6 |
| **Styling** | Tailwind CSS | 4.1.18 |
| **Database** | Supabase (PostgreSQL) | - |
| **Auth** | Supabase Auth | @supabase/auth-js |
| **Client SDK** | @supabase/supabase-js | 2.89.0 |
| **Testing** | Vitest + @vitest/ui | 4.0.16 |
| **TypeScript** | Strict mode | latest |
| **UI Components** | @bentogrid/core | 1.1.1 |
| **Font** | JetBrains Mono Variable | 5.2.8 |
| **PostCSS** | @tailwindcss/postcss | 4.1.18 |

---

## Critical Context & Architecture

### Design Pattern
- **Hybrid SSR/Static**: Astro pages use server-side rendering for auth-gated content, static generation for public routes
- **Database-First**: PostgreSQL schema (`database/schema.sql`) defines strict immutability constraints
- **Event-Sourced Validations**: Append-only `serie_validations` table tracks all peer review actions

### Data Immutability Model
```
serie_posts (immutable) ─┬─> serie_data (immutable)
                         └─> serie_validations (append-only)
```
- **Posts**: UUID-keyed metadata (indicator_id, source, source_url opcional, frequency, status)
- **Status transitions**: `pending` → `approved|rejected` OR `any` → `disabled` (soft delete only)
- **No edits allowed**: New data = new post submission

### Core Business Logic Locations
- **Submission**: `src/pages/` (file-based routing for POST handlers)
- **Validation**: `src/pages/post.astro` (validation form + status updates)
- **Visualization**: `src/components/Dashboard.astro` (BentoGrid + SVG sparklines)
- **Auth Gates**: `src/lib/supabase.ts` (single client instance pattern)

---

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Dashboard (BentoGrid with all approved indicators) |
| `src/pages/login.astro` | Supabase Auth login/signup |
| `src/pages/post.astro` | Single post view + validation form |
| `src/pages/postlist.astro` | All posts list view |
| `src/lib/supabase.ts` | **SINGLE SOURCE** for Supabase client + TypeScript types |
| `database/schema.sql` | Complete DDL for tables, views, indexes, RLS policies (commented) |
| `src/data/indicators.json` | 2119-line catalog of economic/social indicators |

### Routing Patterns
```
/                           # Dashboard
/login                      # Auth
/post?id={uuid}             # Single post + validation
/postlist                   # All posts
/user/[iduser]/             # User-specific posts
/indicators/[id]/           # Indicator detail pages
/series/annual|monthly/     # Frequency-filtered series
/edit/[id]                  # Post edit (disabled status only)
```

---

## Dev Workflow (Strict)

### Installation
```bash
pnpm install
```

### Development
```bash
pnpm dev          # localhost:4321
pnpm build        # Production build
pnpm preview      # Preview built site
```

### Testing
```bash
pnpm test         # Run Vitest once
pnpm test:watch   # Watch mode
pnpm test:ui      # Launch Vitest UI
```

### Environment Files
```
.env              # Development (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
.env.test         # Testing (add SUPABASE_SERVICE_ROLE_KEY, TEST_USER_* vars)
```

### Database Migrations
- **No migration runner**: Apply `database/schema.sql` manually to Supabase SQL editor
- **RLS policies**: Currently commented out in schema, apply if enabling RLS

---

## Implementation Details (Rules)

### Code Style
- **Astro components**: TypeScript in front matter (`---`), HTML in body, `<script>` for client-side
- **Type safety**: Import `SeriePost`, `SerieDataPoint` from `src/lib/supabase.ts` - never redefine
- **Early returns**: Prefer guard clauses over nested conditions
- **Error handling**: Always check `error` in Supabase responses before accessing `data`

### TypeScript Constraints
```typescript
// ✅ CORRECT
import { supabase } from '../lib/supabase';
import type { SeriePost } from '../lib/supabase';

// ❌ NEVER
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(...); // DO NOT create multiple clients
```

### Styling Rules
- **Tailwind only**: No custom CSS except in `src/styles/global.css` for CSS variables
- **Dark mode**: Use `class` strategy (not media queries)
- **Responsive grid**: `grid-cols-[repeat(auto-fit,minmax(220px,1fr))]` for BentoGrid
- **Custom CSS variables**: `--theme-accent`, `--theme-foreground`, `--theme-background`, `--theme-heading1-6`
- **Font**: JetBrains Mono Variable applied globally via `font-family` in body

### Data Validation
- **Date formats**:
  - Annual: `YYYY` (e.g., "2024")
  - Monthly/Quarterly: `YYYY-MM-DD` (e.g., "2024-01-15")
- **Numeric precision**: `NUMERIC(20, 6)` in database
- **Unique constraints**: `(post_id, validated_by)` prevents duplicate validations

### Supabase Patterns
```typescript
// ✅ Fetch posts with nested data
const { data, error } = await supabase
  .from('serie_posts')
  .select(`
    id, indicator_id, data_source, url, frequency, status,
    serie_data(id, date, value)
  `)
  .order('created_at', { ascending: false });

// ✅ Auth check
const { data: { user } } = await supabase.auth.getUser();

// ❌ NEVER use process.env in client code
// ✅ Use import.meta.env.PUBLIC_*
```

### Testing Rules
- **Admin client**: `getAdminClient()` for setup/teardown only (bypasses RLS)
- **User clients**: `getAuthenticatedClient(email, password)` for policy tests
- **Cleanup**: Always call `cleanupTestData()` in `afterAll`
- **Timeout**: 30s for database operations (`vitest.config.ts`)

---

## Memory Bank / Context Map

```
src/
├── components/          # Reusable Astro components
│   ├── Dashboard.astro  # BentoGrid layout + SVG sparklines
│   ├── Navbar.astro     # Auth state + navigation (profile menu, login/logout)
│   ├── PostCard.astro   # Individual post display (status badge, data table)
│   └── Welcome.astro    # Landing page hero
├── data/
│   └── indicators.json  # 2119-line catalog (DO NOT MODIFY structure)
│                        # Structure: {sections: [{groups: [{indicatorIds}]}], indicators: [...]}
├── layouts/
│   └── Layout.astro     # Base HTML shell + <Navbar /> + global styles
├── lib/
│   └── supabase.ts      # SINGLE Supabase client + all TypeScript types
│                        # Exports: supabase, SeriePost, SerieDataPoint
├── pages/               # File-based routing (SSR + Static)
│   ├── *.astro          # Top-level routes
│   ├── edit/[id].astro  # Dynamic edit routes (disable only)
│   ├── indicators/[id]/ # Indicator drill-down
│   ├── series/          # Frequency-filtered views (annual/, monthly/)
│   └── user/[iduser]/   # User-specific posts
├── styles/
│   └── global.css       # CSS variables + Tailwind imports + font-face
└── types/
    └── jsx.d.ts         # JSX type augmentation (key prop support)

tests/
├── setup.ts             # Loads .env.test + validates required env vars
├── rls/
│   └── serie-posts.test.ts # RLS policy verification (when enabled)
└── utils/
    └── supabase-test-client.ts # Test client factories
                                  # Functions: getAdminClient, getAnonClient,
                                  # getAuthenticatedClient, createTestUser,
                                  # deleteTestUser, cleanupTestData

database/
└── schema.sql           # PostgreSQL DDL (tables, views, indexes, RLS)
                         # Tables: serie_posts, serie_validations, serie_data
                         # Views: duplicate_data_detector, validation_summary
                         # Triggers: update_updated_at_column
```

---

## Database Schema

See **[database/AGENTS.md](database/AGENTS.md)** for complete schema documentation including:
- Table structures (`serie_posts`, `serie_data`, `serie_validations`)
- Views (`duplicate_data_detector`, `validation_summary`)
- Triggers (`update_updated_at_column`)
- RLS policies (currently disabled)
- Data integrity rules and common queries

**Quick Reference**:
- **Tables**: 3 (posts, data, validations)
- **Indexes**: 10 total across all tables
- **Constraints**: Immutability + unique validation per user
- **Status**: RLS disabled, policies commented in `schema.sql`

---

## Critical Gotchas

1. **Supabase Client Singleton**: Import from `src/lib/supabase.ts` - creating multiple instances breaks auth state
2. **RLS Currently Disabled**: Schema includes policies but they're commented out - queries use service role
3. **Immutable Posts**: Update only to `status = 'disabled'` - all other changes require new post submission
4. **Spanish UI**: All user-facing text must be in Spanish (es)
5. **Tailwind 4.x**: PostCSS plugin syntax differs from v3 - check config carefully
6. **Date Format Mismatches**: Frequency (`annual|monthly|quarterly`) must match date format in `serie_data`
7. **Validation Uniqueness**: Database constraint prevents user from validating same post twice
8. **Test Cleanup**: Failing tests leave orphaned data - always run cleanup in hooks
9. **Environment Variables**: Client-side code must use `import.meta.env.PUBLIC_*` not `process.env`
10. **Volta Lock**: Node 24.12.0 + pnpm 10.26.1 are locked - don't override

---

## Data Flow (Critical Path)

```
User submits indicator data
    ↓
INSERT INTO serie_posts (metadata)
    ↓
BULK INSERT INTO serie_data (time-series points)
    ↓
status = 'pending'
    ↓
Peer validator views post
    ↓
INSERT INTO serie_validations (approved/rejected + notes)
    ↓
UPDATE serie_posts SET status = 'approved'
    ↓
Dashboard renders approved posts via BentoGrid
    ↓
SVG sparkline generated from sorted serie_data
```

---

## Visualization Details

### Dashboard (BentoGrid)
- **Component**: `src/components/Dashboard.astro`
- **Data source**: `src/data/indicators.json` (static catalog)
- **Layout**: Responsive grid with `minmax(220px, 1fr)` auto-fit columns
- **Sparklines**: SVG path generation via `sparklinePath()` function
  - Width: 160px, Height: 48px, Padding: 6px
  - Normalized to min-max range
  - Sorted by year before rendering

### PostCard
- **Component**: `src/components/PostCard.astro`
- **Props**: `post`, `maxDataPoints` (default 10), `showLinks` (default true)
- **Display**: Status badge, metadata grid, data table (sorted by date DESC)
- **Limits**: Shows first N data points with "showing X of Y" message

---

## For LLM Agents

### When generating code:
- Always check `src/lib/supabase.ts` for existing types before creating new ones
- Respect the immutability constraint - never suggest editing post data
- Use Spanish for all UI text (`placeholder`, `label`, error messages)
- Follow Astro component patterns in front matter (TypeScript) vs body (HTML)
- Test database changes with RLS policies in mind even though currently disabled
- Preserve existing Tailwind configuration and CSS variable naming
- Extract reusable logic to `src/lib/` utilities rather than duplicating in pages

### When suggesting changes:
- Reference specific files/line numbers from project structure
- Include imports from exact paths
- Show TypeScript interfaces for new data structures
- Provide Tailwind class examples consistent with theme
- Include both server-side (front matter) and client-side (`<script>`) approaches when applicable

### Common Patterns to Follow:

#### Astro Component Structure
```astro
---
// Server-side TypeScript
import Layout from '../layouts/Layout.astro';
import { supabase } from '../lib/supabase';
import type { SeriePost } from '../lib/supabase';

interface Props {
  title: string;
}

const { title } = Astro.props;

// Fetch data server-side
const { data, error } = await supabase.from('serie_posts').select('*');
---

<Layout>
  <h1>{title}</h1>
  <!-- HTML content -->
</Layout>

<script>
  // Client-side JavaScript
  console.log('Client-side code');
</script>
```

#### Error Handling Pattern
```typescript
const { data, error } = await supabase.from('table').select('*');

if (error) {
  console.error('Error:', error);
  // Show user-friendly message in Spanish
  return;
}

// Proceed with data
```

---

**Last Updated**: 2026-02-05  
**Version**: 0.0.1  
**Status**: Active Development
