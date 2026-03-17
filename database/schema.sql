-- ============================================================================
-- ABSENT AURORA - SERIE DATA DATABASE SCHEMA
-- PostgreSQL specific schema for time-series data submission and validation
-- ============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: serie_posts
-- Stores metadata about each data submission (one indicator per post)
-- Posts are immutable - they can only be disabled, not edited
-- -----------------------------------------------------------------------------
CREATE TABLE serie_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id VARCHAR(10) NOT NULL,           -- e.g., 'E01', 'S15'
    submitted_by UUID NOT NULL default auth.uid (),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_source TEXT NOT NULL,                   -- e.g., 'Banco Central de Chile'
    url TEXT,                                    -- Optional source URL (e.g., original dataset/report link)
    frequency VARCHAR(50) NOT NULL,              -- e.g., 'monthly', 'annual', 'quarterly'
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    notes TEXT,                                  -- Optional submission notes
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_serie_posts_indicator ON serie_posts(indicator_id);
CREATE INDEX idx_serie_posts_status ON serie_posts(status);
CREATE INDEX idx_serie_posts_submitted_by ON serie_posts(submitted_by);
CREATE INDEX idx_serie_posts_submitted_at ON serie_posts(submitted_at DESC);

COMMENT ON TABLE serie_posts IS 'Metadata for each serie data submission. One post contains data for one indicator with multiple date-value pairs.';

-- -----------------------------------------------------------------------------
-- TABLE: serie_validations
-- Tracks validation history - multiple users can validate the same post
-- -----------------------------------------------------------------------------
CREATE TABLE serie_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES serie_posts(id) ON DELETE CASCADE,
    validated_by UUID NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    validation_status VARCHAR(20) NOT NULL CHECK (validation_status IN ('approved', 'rejected')),
    validation_notes TEXT,                       -- Optional validation comments
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_serie_validations_post_id ON serie_validations(post_id);
CREATE INDEX idx_serie_validations_validated_by ON serie_validations(validated_by);
CREATE INDEX idx_serie_validations_validated_at ON serie_validations(validated_at DESC);

-- Prevent same user from validating the same post twice
CREATE UNIQUE INDEX idx_serie_validations_unique ON serie_validations(post_id, validated_by);

COMMENT ON TABLE serie_validations IS 'Validation history. Multiple validators can approve/reject each post independently.';

-- -----------------------------------------------------------------------------
-- TABLE: serie_data
-- Stores actual time-series data points (one row per date-value pair)
-- Linked to a post via post_id
-- -----------------------------------------------------------------------------
CREATE TABLE serie_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES serie_posts(id) ON DELETE CASCADE,
    date DATE NOT NULL,                          -- Can be year, month, or day depending on frequency
    value NUMERIC(20, 6) NOT NULL               -- Support decimals with high precision
);

-- Indexes for performance and duplicate detection
CREATE INDEX idx_serie_data_post_id ON serie_data(post_id);
CREATE INDEX idx_serie_data_date ON serie_data(date);
CREATE INDEX idx_serie_data_composite ON serie_data(post_id, date);

COMMENT ON TABLE serie_data IS 'Individual time-series data points. Each row represents one date-value pair linked to a post.';
COMMENT ON COLUMN serie_data.date IS 'Date of the observation. Format depends on frequency (YYYY for annual, YYYY-MM for monthly, etc.)';

-- -----------------------------------------------------------------------------
-- VIEW: duplicate_data_detector
-- Helps identify potential duplicate submissions across different posts
-- Note: Duplicates are allowed but should be flagged for review
-- -----------------------------------------------------------------------------
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

COMMENT ON VIEW duplicate_data_detector IS 'Identifies duplicate data points across different posts. Duplicates are allowed but flagged for review.';

-- -----------------------------------------------------------------------------
-- VIEW: validation_summary
-- Provides a summary of validation status for each post
-- -----------------------------------------------------------------------------
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
    ARRAY_AGG(sv.validated_by ORDER BY sv.validated_at) FILTER (WHERE sv.validation_status = 'approved') as approved_by,
    ARRAY_AGG(sv.validated_by ORDER BY sv.validated_at) FILTER (WHERE sv.validation_status = 'rejected') as rejected_by
FROM serie_posts sp
LEFT JOIN serie_validations sv ON sp.id = sv.post_id
GROUP BY sp.id, sp.indicator_id, sp.submitted_by, sp.submitted_at, sp.status;

COMMENT ON VIEW validation_summary IS 'Summary of validation status for each post, showing approval/rejection counts and validators.';

-- -----------------------------------------------------------------------------
-- VIEW: approved_series_view
-- Returns all datapoints for posts that have been APPROVED. Useful for charting.
-- -----------------------------------------------------------------------------
CREATE VIEW approved_series_view AS
SELECT
  sp.id AS post_id,
  sp.indicator_id,
  sp.data_source,
    sp.url,
  sp.frequency,
  sd.date,
  sd.value
FROM serie_data sd
JOIN serie_posts sp ON sd.post_id = sp.id
WHERE sp.status = 'approved'
ORDER BY sp.indicator_id, sd.date;

COMMENT ON VIEW approved_series_view IS 'All datapoints for posts with status = approved. Useful for charting aggregated indicator series.';

-- -----------------------------------------------------------------------------
-- FUNCTION: update_updated_at_column
-- Automatically updates the updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_serie_posts_updated_at
    BEFORE UPDATE ON serie_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- SAMPLE QUERIES FOR COMMON OPERATIONS
-- -----------------------------------------------------------------------------

-- Query 1: Get all pending posts with their data
-- SELECT sp.*, sd.date, sd.value
-- FROM serie_posts sp
-- JOIN serie_data sd ON sp.id = sd.post_id
-- WHERE sp.status = 'pending'
-- ORDER BY sp.submitted_at DESC;

-- Query 2: Get validation history for a specific post
-- SELECT sp.indicator_id, sp.submitted_by, sp.submitted_at,
--        sv.validated_by, sv.validated_at, sv.validation_status, sv.validation_notes
-- FROM serie_posts sp
-- LEFT JOIN serie_validations sv ON sp.id = sv.post_id
-- WHERE sp.id = 'YOUR_POST_ID'
-- ORDER BY sv.validated_at;

-- Query 3: Get all approved data for a specific indicator
-- SELECT sp.data_source, sp.url, sd.date, sd.value
-- FROM serie_posts sp
-- JOIN serie_data sd ON sp.id = sd.post_id
-- WHERE sp.indicator_id = 'E01' 
--   AND sp.status = 'approved'
-- ORDER BY sd.date;

-- Query 4: Find potential duplicates
-- SELECT * FROM duplicate_data_detector;

-- Query 5: Get validation summary for all posts
-- SELECT * FROM validation_summary
-- ORDER BY submitted_at DESC;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) SETUP FOR SUPABASE
-- Uncomment and configure based on your auth requirements
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
-- ALTER TABLE serie_posts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE serie_validations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE serie_data ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view approved posts
-- CREATE POLICY "Anyone can view approved posts"
--     ON serie_posts FOR SELECT
--     USING (status = 'approved');

-- Policy: Users can view their own posts
-- CREATE POLICY "Users can view own posts"
--     ON serie_posts FOR SELECT
--     USING (auth.jwt() ->> 'email' = submitted_by);

-- Policy: Users can insert their own posts
-- CREATE POLICY "Users can insert own posts"
--     ON serie_posts FOR INSERT
--     WITH CHECK (auth.jwt() ->> 'email' = submitted_by);

-- Policy: Users can update status of their own posts (only to 'disabled')
-- CREATE POLICY "Users can disable own posts"
--     ON serie_posts FOR UPDATE
--     USING (auth.jwt() ->> 'email' = submitted_by)
--     WITH CHECK (status = 'disabled');

-- Policy: Users can add validations (but not to their own posts)
-- CREATE POLICY "Users can validate others' posts"
--     ON serie_validations FOR INSERT
--     WITH CHECK (
--         auth.jwt() ->> 'email' = validated_by AND
--         auth.jwt() ->> 'email' != (
--             SELECT submitted_by FROM serie_posts WHERE id = post_id
--         )
--     );

-- Policy: Users can view data from approved posts
-- CREATE POLICY "Anyone can view data from approved posts"
--     ON serie_data FOR SELECT
--     USING (
--         EXISTS (
--             SELECT 1 FROM serie_posts 
--             WHERE id = post_id AND status = 'approved'
--         )
--     );

-- Policy: Users can view data from their own posts
-- CREATE POLICY "Users can view data from own posts"
--     ON serie_data FOR SELECT
--     USING (
--         EXISTS (
--             SELECT 1 FROM serie_posts 
--             WHERE id = post_id AND submitted_by = auth.jwt() ->> 'email'
--         )
--     );

-- -----------------------------------------------------------------------------
-- END OF SCHEMA
-- -----------------------------------------------------------------------------
