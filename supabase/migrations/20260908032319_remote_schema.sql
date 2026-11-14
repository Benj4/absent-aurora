SET local check_function_bodies = off;

CREATE TABLE "public"."analysis_indicators" (
  "analysis_id"  uuid                  NOT NULL,
  "indicator_id" character varying(10) NOT NULL,
  "sort_order"   smallint              NOT NULL DEFAULT 0,
  CONSTRAINT "analysis_indicators_pkey" PRIMARY KEY (analysis_id, indicator_id)
);

CREATE TABLE "public"."analysis_macro_events" (
  "analysis_id"    uuid                  NOT NULL,
  "macro_event_id" uuid                  NOT NULL,
  "marker_mode"    character varying(10),
  "marker_color"   character varying(7),
  CONSTRAINT "analysis_macro_events_marker_color_check" CHECK (((marker_color IS NULL) OR ((marker_color)::text ~ '^#[0-9a-fA-F]{6}$'::text))),
  CONSTRAINT "analysis_macro_events_marker_mode_check"
    CHECK
    (((marker_mode IS NULL) OR ((marker_mode)::text = ANY ((ARRAY['none'::character varying, 'start'::character varying, 'end'::character varying, 'both'::character
    varying])::text[])))),
  CONSTRAINT "analysis_macro_events_pkey" PRIMARY KEY (analysis_id, macro_event_id)
);

CREATE TABLE "public"."analysis_periods" (
  "id"          uuid                 NOT NULL,
  "analysis_id" uuid                 NOT NULL,
  "name"        text                 NOT NULL,
  "start_date"  date                 NOT NULL,
  "end_date"    date                 NOT NULL,
  "color"       character varying(7) NOT NULL,
  "sort_order"  smallint             NOT NULL DEFAULT 0,
  CONSTRAINT "analysis_periods_color_check" CHECK (((color)::text ~ '^#[0-9a-fA-F]{6}$'::text)),
  CONSTRAINT "analysis_periods_dates_check" CHECK ((end_date >= start_date)),
  CONSTRAINT "analysis_periods_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."analysis_source_selections" (
  "analysis_id"  uuid                  NOT NULL,
  "indicator_id" character varying(10) NOT NULL,
  "date"         date                  NOT NULL,
  "post_id"      uuid                  NOT NULL,
  CONSTRAINT "analysis_source_selections_pkey" PRIMARY KEY (analysis_id, indicator_id, date)
);

CREATE TABLE "public"."analysis" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"          text                     NOT NULL,
  "description"    text,
  "alignment_mode" character varying(20)    NOT NULL DEFAULT 'indice_cero'::character varying,
  "region"         text,
  "show_base100"   boolean                  NOT NULL DEFAULT false,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "status"         text                     NOT NULL DEFAULT 'draft'::text,
  CONSTRAINT "analysis_alignment_mode_check" CHECK (((alignment_mode)::text = ANY ((ARRAY['indice_cero'::character varying, 'calendario'::character varying])::text[]))),
  CONSTRAINT "analysis_pkey" PRIMARY KEY (id),
  "created_by"     uuid                     NOT NULL DEFAULT auth.uid()
);

CREATE TABLE "public"."macro_events" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"        text                     NOT NULL,
  "description" text,
  "start_date"  date                     NOT NULL,
  "end_date"    date,
  "geo_scope"   text,
  "geo_region"  text,
  "source_url"  text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "macro_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."serie_data" (
  "id"      uuid          NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid          NOT NULL,
  "date"    date          NOT NULL,
  "value"   numeric(20,6) NOT NULL,
  CONSTRAINT "serie_data_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."serie_data"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."serie_posts" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "indicator_id" character varying(10)    NOT NULL,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "data_source"  text                     NOT NULL,
  "frequency"    character varying(50)    NOT NULL,
  "status"       character varying(20)    NOT NULL DEFAULT 'pending'::character varying,
  "notes"        text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "url"          text,
  CONSTRAINT "serie_posts_pkey" PRIMARY KEY (id),
  CONSTRAINT "serie_posts_status_check"
    CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'disabled'::character varying])::text[]))),
  "submitted_by" uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."serie_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."serie_validations" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "post_id"           uuid                     NOT NULL,
  "validated_by"      uuid                     NOT NULL,
  "validated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "validation_status" character varying(20)    NOT NULL,
  "validation_notes"  text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "serie_validations_pkey" PRIMARY KEY (id),
  CONSTRAINT "serie_validations_validation_status_check" CHECK (((validation_status)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying])::text[])))
);

ALTER TABLE "public"."serie_validations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_roles" (
  "user_id" uuid NOT NULL,
  "role"    text NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "user_roles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'user'::text])))
);

CREATE TYPE "public"."macro_event_topic" AS ENUM (
  'politics',
  'economy',
  'nature',
  'health',
  'social'
);

ALTER TABLE "public"."macro_events"
  ADD COLUMN "topic" public.macro_event_topic NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_update_user_role()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.serie_posts_enforce_update_rules()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  -- Determine if any protected column (anything except status + updated_at) changed
  IF (
    NEW."indicator_id" IS DISTINCT FROM OLD."indicator_id" OR
    NEW."data_source" IS DISTINCT FROM OLD."data_source" OR
    NEW."frequency" IS DISTINCT FROM OLD."frequency" OR
    NEW."notes" IS DISTINCT FROM OLD."notes" OR
    NEW."submitted_by" IS DISTINCT FROM OLD."submitted_by" OR
    NEW."url" IS DISTINCT FROM OLD."url" OR
    NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at" OR
    NEW."created_at" IS DISTINCT FROM OLD."created_at"
  ) THEN
    -- Is the user the owner?
    IF (OLD."submitted_by" IS DISTINCT FROM auth.uid()) THEN
      -- not owner: must be editor, and editors may only change status
      IF NOT EXISTS (
        SELECT 1 FROM public."user_roles" ur
        WHERE ur."user_id" = auth.uid() AND ur."role" = 'editor'::text
      ) THEN
        RAISE EXCEPTION 'only editors or owners can update serie_posts';
      END IF;

      -- Editors must not change other columns
      RAISE EXCEPTION 'only status can be updated by editors';
    END IF;

    -- Owner can update other columns only while status is draft (existing row status)
    IF OLD."status"::text <> 'draft'::text THEN
      RAISE EXCEPTION 'only owners can update other fields when status is draft';
    END IF;
  END IF;

  RETURN NEW;
end;
$function$;

ALTER TABLE "public"."analysis_indicators"
  ADD CONSTRAINT "analysis_indicators_analysis_fkey" FOREIGN KEY (analysis_id) REFERENCES public.analysis(id) ON DELETE CASCADE;

ALTER TABLE "public"."analysis_macro_events"
  ADD CONSTRAINT "analysis_macro_events_analysis_fkey" FOREIGN KEY (analysis_id) REFERENCES public.analysis(id) ON DELETE CASCADE;

ALTER TABLE "public"."analysis_periods"
  ADD CONSTRAINT "analysis_periods_analysis_fkey" FOREIGN KEY (analysis_id) REFERENCES public.analysis(id) ON DELETE CASCADE;

ALTER TABLE "public"."analysis_source_selections"
  ADD CONSTRAINT "analysis_source_selections_analysis_fkey" FOREIGN KEY (analysis_id) REFERENCES public.analysis(id) ON DELETE CASCADE;

ALTER TABLE "public"."analysis_macro_events"
  ADD CONSTRAINT "analysis_macro_events_event_fkey" FOREIGN KEY (macro_event_id) REFERENCES public.macro_events(id) ON DELETE CASCADE;

ALTER TABLE "public"."analysis_source_selections"
  ADD CONSTRAINT "analysis_source_selections_post_fkey" FOREIGN KEY (post_id) REFERENCES public.serie_posts(id) ON DELETE RESTRICT;

ALTER TABLE "public"."serie_data"
  ADD CONSTRAINT "serie_data_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.serie_posts(id) ON DELETE CASCADE;

ALTER TABLE "public"."serie_validations"
  ADD CONSTRAINT "serie_validations_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.serie_posts(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "user_roles_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE VIEW "public"."approved_series_view" AS  SELECT sp.id AS post_id,
    sp.indicator_id,
    sp.data_source,
    sp.frequency,
    sd.date,
    sd.value
   FROM (public.serie_data sd
     JOIN public.serie_posts sp ON ((sd.post_id = sp.id)))
  WHERE ((sp.status)::text = 'approved'::text)
  ORDER BY sp.indicator_id, sd.date;

CREATE INDEX idx_analysis_created_at ON public.analysis USING btree (created_at DESC);

CREATE INDEX idx_analysis_macro_events_event_id ON public.analysis_macro_events USING btree (macro_event_id);

CREATE INDEX idx_analysis_periods_analysis_id ON public.analysis_periods USING btree (analysis_id);

CREATE INDEX idx_analysis_source_selections_post_id ON public.analysis_source_selections USING btree (post_id);

CREATE INDEX idx_serie_data_composite ON public.serie_data USING btree (post_id, date);

CREATE INDEX idx_serie_data_date ON public.serie_data USING btree (date);

CREATE INDEX idx_serie_data_post_id ON public.serie_data USING btree (post_id);

CREATE INDEX idx_serie_posts_indicator ON public.serie_posts USING btree (indicator_id);

CREATE INDEX idx_serie_posts_status ON public.serie_posts USING btree (status);

CREATE INDEX idx_serie_posts_submitted_at ON public.serie_posts USING btree (submitted_at DESC);

CREATE INDEX idx_serie_validations_post_id ON public.serie_validations USING btree (post_id);

CREATE UNIQUE INDEX idx_serie_validations_unique ON public.serie_validations USING btree (post_id, validated_by);

CREATE INDEX idx_serie_validations_validated_at ON public.serie_validations USING btree (validated_at DESC);

CREATE INDEX idx_serie_validations_validated_by ON public.serie_validations USING btree (validated_by);

CREATE INDEX macro_events_start_date_idx ON public.macro_events USING btree (start_date);

CREATE INDEX macro_events_topic_idx ON public.macro_events USING btree (topic);

CREATE INDEX user_roles_role_user_id_idx ON public.user_roles USING btree (ROLE, user_id);

CREATE TRIGGER analysis_set_updated_at
  BEFORE UPDATE ON public.analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER serie_posts_enforce_update_rules_trg
  BEFORE UPDATE ON public.serie_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.serie_posts_enforce_update_rules();

CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_update_user_role();

CREATE POLICY "Enable read access for all users" ON "public"."serie_data"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."serie_posts"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Only editors can status" ON "public"."serie_posts"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'editor'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'editor'::text)))));

CREATE POLICY "serie_validations_allow_read" ON "public"."serie_validations"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "serie_validations_insert" ON "public"."serie_validations"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((validated_by = ( SELECT auth.uid() AS uid)));

CREATE POLICY "serie_validations_update" ON "public"."serie_validations"
  FOR UPDATE
  TO "authenticated"
  USING ((validated_by = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((validated_by = ( SELECT auth.uid() AS uid)));

COMMENT ON COLUMN "public"."serie_data"."date" IS 'Date of the observation. Format depends on frequency (YYYY for annual, YYYY-MM for monthly, etc.)';

COMMENT ON TABLE "public"."analysis" IS 'One row per saved analysis configuration. Root of the AnalysisState graph.';

COMMENT ON TABLE "public"."analysis_indicators" IS 'Many-to-many join between an analysis and indicator catalog IDs. Maps: indicadores[].';

COMMENT ON TABLE "public"."analysis_macro_events" IS 'Macro events shown on the chart with per-event marker config. Merges macroEventIds[], markerModeByEventId{}, markerColorByEventId{}. NULL columns mean use client-side default.';

COMMENT ON TABLE "public"."analysis_periods" IS 'Ordered comparison periods for an analysis. Maps: periodos[]. Client-generated UUIDs are stored as-is.';

COMMENT ON TABLE "public"."analysis_source_selections" IS 'Per-indicator-date post override. Maps: sourceSelections{"E02:2024-01-01": "<post_id>"}. Composite key replaces the string key for queryability and FK integrity.';

COMMENT ON TABLE "public"."serie_data" IS 'Individual time-series data points. Each row represents one date-value pair linked to a post.';

COMMENT ON TABLE "public"."serie_posts" IS 'Metadata for each serie data submission. One post contains data for one indicator with multiple date-value pairs.';

COMMENT ON TABLE "public"."serie_validations" IS 'Validation history. Multiple validators can approve/reject each post independently.';

COMMENT ON VIEW "public"."approved_series_view" IS 'All datapoints for posts with status = approved. Useful for charting aggregated indicator series.';

GRANT EXECUTE ON FUNCTION "public"."handle_update_user_role"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."serie_posts_enforce_update_rules"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_indicators" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_macro_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_periods" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_source_selections" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."macro_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."serie_data" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."serie_posts" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."serie_validations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_roles" TO "anon", "authenticated", "postgres", "service_role";

GRANT USAGE ON TYPE "public"."macro_event_topic" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."approved_series_view" TO "anon", "authenticated", "postgres", "service_role";

ALTER TABLE "public"."analysis"
  ADD CONSTRAINT "analysis_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_analysis_created_by ON public.analysis USING btree (created_by);

CREATE VIEW "public"."duplicate_data_detector" AS  SELECT sp.indicator_id,
    sp.data_source,
    sd.date,
    sd.value,
    count(*) AS occurrence_count,
    array_agg(sp.id ORDER BY sp.submitted_at) AS post_ids,
    array_agg(sp.submitted_by ORDER BY sp.submitted_at) AS submitters,
    min(sp.submitted_at) AS first_submission,
    max(sp.submitted_at) AS last_submission
   FROM (public.serie_data sd
     JOIN public.serie_posts sp ON ((sd.post_id = sp.id)))
  WHERE ((sp.status)::text <> 'disabled'::text)
  GROUP BY sp.indicator_id, sp.data_source, sd.date, sd.value
 HAVING (count(*) > 1)
  ORDER BY (count(*)) DESC, sp.indicator_id, sd.date;

CREATE VIEW "public"."validation_summary" AS  SELECT sp.id AS post_id,
    sp.indicator_id,
    sp.submitted_by,
    sp.submitted_at,
    sp.status AS post_status,
    count(sv.id) AS total_validations,
    count(sv.id) FILTER (WHERE ((sv.validation_status)::text = 'approved'::text)) AS approvals,
    count(sv.id) FILTER (WHERE ((sv.validation_status)::text = 'rejected'::text)) AS rejections,
    array_agg(sv.validated_by ORDER BY sv.validated_at) FILTER (WHERE ((sv.validation_status)::text = 'approved'::text)) AS approved_by,
    array_agg(sv.validated_by ORDER BY sv.validated_at) FILTER (WHERE ((sv.validation_status)::text = 'rejected'::text)) AS rejected_by
   FROM (public.serie_posts sp
     LEFT JOIN public.serie_validations sv ON ((sp.id = sv.post_id)))
  GROUP BY sp.id, sp.indicator_id, sp.submitted_by, sp.submitted_at, sp.status;

CREATE INDEX idx_serie_posts_submitted_by ON public.serie_posts USING btree (submitted_by);

CREATE POLICY "Enable insert based on user_id post parent" ON "public"."serie_data"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) IN ( SELECT serie_posts.submitted_by
   FROM public.serie_posts
  WHERE (serie_posts.id = serie_data.post_id))));

CREATE POLICY "Enable insert for users based on user_id" ON "public"."serie_posts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = submitted_by));

CREATE POLICY "Only owner can update when draft" ON "public"."serie_posts"
  FOR UPDATE
  TO "authenticated"
  USING (((submitted_by = auth.uid()) AND ((status)::text = 'draft'::text)))
  WITH CHECK (((submitted_by = auth.uid()) AND ((status)::text = 'draft'::text)));

COMMENT ON VIEW "public"."duplicate_data_detector" IS 'Identifies duplicate data points across different posts. Duplicates are allowed but flagged for review.';

COMMENT ON VIEW "public"."validation_summary" IS 'Summary of validation status for each post, showing approval/rejection counts and validators.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."duplicate_data_detector" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."validation_summary" TO "anon", "authenticated", "postgres", "service_role";

