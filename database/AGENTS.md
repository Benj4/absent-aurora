# Database Schema - Absent Aurora

## Overview

PostgreSQL schema with strict immutability constraints. All tables use UUIDs as primary keys. Event-sourced validation tracking with append-only pattern.

---

## Tables

### `serie_posts`
**Purpose**: Metadata for each data submission (one indicator per post)

```sql
CREATE TABLE serie_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id VARCHAR(10) NOT NULL,           -- 'E01', 'S15', etc.
    submitted_by UUID NOT NULL DEFAULT auth.uid(),
    data_source TEXT NOT NULL,                   -- 'Banco Central de Chile'
    url TEXT,                                    -- Optional source URL
    frequency VARCHAR(50) NOT NULL,              -- 'monthly' | 'annual' | 'quarterly'
    status VARCHAR(20) DEFAULT 'pending'         -- 'pending' | 'approved' | 'rejected' | 'disabled'
        CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Indexes**:
- `idx_serie_posts_indicator` ON `indicator_id`
- `idx_serie_posts_status` ON `status`
- `idx_serie_posts_submitted_by` ON `submitted_by`
- `idx_serie_posts_submitted_at` ON `submitted_at DESC`

**Constraints**:
- Posts are **immutable** - can only update `status` to `'disabled'`
- All other modifications require new post submission

---

### `serie_data`
**Purpose**: Individual time-series data points (one row per date-value pair)

```sql
CREATE TABLE serie_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES serie_posts(id) ON DELETE CASCADE,
    date DATE NOT NULL,                          -- Format varies by frequency
    value NUMERIC(20, 6) NOT NULL                -- High precision decimals
);
```

**Indexes**:
- `idx_serie_data_post_id` ON `post_id`
- `idx_serie_data_date` ON `date`
- `idx_serie_data_composite` ON `(post_id, date)`

**Data Formats**:
- Annual: `YYYY` (e.g., "2024")
- Monthly/Quarterly: `YYYY-MM-DD` (e.g., "2024-01-15")

**Relationship**: One-to-many with `serie_posts` (CASCADE delete)

---

### `serie_validations`
**Purpose**: Track validation history (append-only event log)

```sql
CREATE TABLE serie_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES serie_posts(id) ON DELETE CASCADE,
    validated_by UUID NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    validation_status VARCHAR(20) NOT NULL       -- 'approved' | 'rejected'
        CHECK (validation_status IN ('approved', 'rejected')),
    validation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Indexes**:
- `idx_serie_validations_post_id` ON `post_id`
- `idx_serie_validations_validated_by` ON `validated_by`
- `idx_serie_validations_validated_at` ON `validated_at DESC`
- `idx_serie_validations_unique` UNIQUE ON `(post_id, validated_by)`

**Constraints**:
- One user can only validate same post once (UNIQUE constraint)
- Validations are permanent (never deleted or modified)

---

## Views

### `duplicate_data_detector`
**Purpose**: Identify potential duplicate submissions across different posts

```sql
CREATE VIEW duplicate_data_detector AS
SELECT 
    sp.indicator_id,
    sp.data_source,
    sd.date,
    sd.value,
    COUNT(*) as occurrence_count,
    ARRAY_AGG(sp.id ORDER BY sp.submitted_at) as post_ids,
    ARRAY_AGG(sp.submitted_by ORDER BY sp.submitted_at) as submitters,
    MIN(sp.submitted_at) as first_submission,
    MAX(sp.submitted_at) as last_submission
FROM serie_data sd
JOIN serie_posts sp ON sd.post_id = sp.id
WHERE sp.status != 'disabled'
GROUP BY sp.indicator_id, sp.data_source, sd.date, sd.value
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC, sp.indicator_id, sd.date;
```

**Note**: Duplicates are **allowed** but flagged for review.

---

### `validation_summary`
**Purpose**: Aggregate validation counts per post

```sql
CREATE VIEW validation_summary AS
SELECT 
    sp.id as post_id,
    sp.indicator_id,
    sp.submitted_by,
    sp.submitted_at,
    sp.status as post_status,
    COUNT(sv.id) as total_validations,
    COUNT(sv.id) FILTER (WHERE sv.validation_status = 'approved') as approvals,
    COUNT(sv.id) FILTER (WHERE sv.validation_status = 'rejected') as rejections,
    ARRAY_AGG(sv.validated_by ORDER BY sv.validated_at) 
        FILTER (WHERE sv.validation_status = 'approved') as approved_by,
    ARRAY_AGG(sv.validated_by ORDER BY sv.validated_at) 
        FILTER (WHERE sv.validation_status = 'rejected') as rejected_by
FROM serie_posts sp
LEFT JOIN serie_validations sv ON sp.id = sv.post_id
GROUP BY sp.id, sp.indicator_id, sp.submitted_by, sp.submitted_at, sp.status;
```

**Returns**: Approval/rejection counts + arrays of validator UUIDs

---

## Triggers

### `update_updated_at_column`
**Purpose**: Auto-update `updated_at` timestamp on `serie_posts` modifications

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_serie_posts_updated_at
    BEFORE UPDATE ON serie_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Row Level Security (RLS)

**Current Status**: **DISABLED** (all policies commented out in `schema.sql`)

### Intended Policies (when enabled):

#### Public Read Access
```sql
-- Anyone can view approved posts
CREATE POLICY "Anyone can view approved posts"
    ON serie_posts FOR SELECT
    USING (status = 'approved');
```

#### User Ownership
```sql
-- Users can view their own posts
CREATE POLICY "Users can view own posts"
    ON serie_posts FOR SELECT
    USING (submitted_by = auth.uid());

-- Users can insert their own posts
CREATE POLICY "Users can insert own posts"
    ON serie_posts FOR INSERT
    WITH CHECK (submitted_by = auth.uid());

-- Users can update status to 'disabled' only
CREATE POLICY "Users can disable own posts"
    ON serie_posts FOR UPDATE
    USING (submitted_by = auth.uid())
    WITH CHECK (status = 'disabled' AND submitted_by = auth.uid());
```

**Note**: Apply policies by uncommenting in `schema.sql` and enabling RLS:
```sql
ALTER TABLE serie_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE serie_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE serie_data ENABLE ROW LEVEL SECURITY;
```

---

## Data Integrity Rules

### Immutability
1. **Posts**: Cannot modify `indicator_id`, `data_source`, `url`, `frequency`, `submitted_by`, `submitted_at`
2. **Data Points**: Never update - delete post and create new one if wrong
3. **Validations**: Append-only - no updates or deletes

### Status Transitions
```
pending ─┬─> approved
         ├─> rejected
         └─> disabled

approved ──> disabled
rejected ──> disabled
disabled (final state)
```

### Cascade Behavior
- Delete post → Deletes all `serie_data` and `serie_validations`
- Delete user → Sets `submitted_by` NULL (if FK configured)

---

## Common Queries

### Fetch all posts with nested data
```typescript
const { data, error } = await supabase
  .from('serie_posts')
  .select(`
        id, indicator_id, data_source, url, frequency, status, created_at,
    serie_data(id, date, value)
  `)
  .order('created_at', { ascending: false });
```

### Get validation history for post
```typescript
const { data, error } = await supabase
  .from('serie_validations')
  .select('*')
  .eq('post_id', postId)
  .order('validated_at', { ascending: false });
```

### Check for duplicates
```typescript
const { data, error } = await supabase
  .from('duplicate_data_detector')
  .select('*');
```

### Get validation summary
```typescript
const { data, error } = await supabase
  .from('validation_summary')
  .select('*')
  .order('submitted_at', { ascending: false });
```

---

## Migration Notes

- **No migration runner**: Apply `schema.sql` manually via Supabase SQL editor
- **Version control**: Commit schema changes as `.sql` files
- **Testing**: Use `SUPABASE_SERVICE_ROLE_KEY` for test setup/teardown
- **RLS Testing**: Create separate test users to verify policies

---

**Last Updated**: 2026-02-05  
**Schema Version**: 1.0.0
