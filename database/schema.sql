--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.0

-- Started on 2026-03-31 20:49:53

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 136 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- TOC entry 515 (class 1255 OID 93026)
-- Name: handle_update_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_update_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 391 (class 1259 OID 27490)
-- Name: serie_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serie_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    date date NOT NULL,
    value numeric(20,6) NOT NULL
);


--
-- TOC entry 389 (class 1259 OID 27453)
-- Name: serie_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serie_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    indicator_id character varying(10) NOT NULL,
    submitted_by uuid DEFAULT auth.uid() NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    data_source text NOT NULL,
    frequency character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    url text,
    CONSTRAINT serie_posts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'disabled'::character varying])::text[])))
);


--
-- TOC entry 395 (class 1259 OID 73997)
-- Name: approved_series_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.approved_series_view AS
 SELECT sp.id AS post_id,
    sp.indicator_id,
    sp.data_source,
    sp.frequency,
    sd.date,
    sd.value
   FROM (public.serie_data sd
     JOIN public.serie_posts sp ON ((sd.post_id = sp.id)))
  WHERE ((sp.status)::text = 'approved'::text)
  ORDER BY sp.indicator_id, sd.date;


--
-- TOC entry 392 (class 1259 OID 27638)
-- Name: duplicate_data_detector; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.duplicate_data_detector AS
 SELECT sp.indicator_id,
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


--
-- TOC entry 390 (class 1259 OID 27470)
-- Name: serie_validations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serie_validations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    validated_by uuid NOT NULL,
    validated_at timestamp with time zone DEFAULT now() NOT NULL,
    validation_status character varying(20) NOT NULL,
    validation_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT serie_validations_validation_status_check CHECK (((validation_status)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- TOC entry 398 (class 1259 OID 93009)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role text NOT NULL,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'user'::text])))
);


--
-- TOC entry 393 (class 1259 OID 27643)
-- Name: validation_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.validation_summary AS
 SELECT sp.id AS post_id,
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


--
-- TOC entry 3681 (class 2606 OID 27495)
-- Name: serie_data serie_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serie_data
    ADD CONSTRAINT serie_data_pkey PRIMARY KEY (id);


--
-- TOC entry 3670 (class 2606 OID 27465)
-- Name: serie_posts serie_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serie_posts
    ADD CONSTRAINT serie_posts_pkey PRIMARY KEY (id);


--
-- TOC entry 3676 (class 2606 OID 27480)
-- Name: serie_validations serie_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serie_validations
    ADD CONSTRAINT serie_validations_pkey PRIMARY KEY (id);


--
-- TOC entry 3683 (class 2606 OID 93046)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3677 (class 1259 OID 27503)
-- Name: idx_serie_data_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_data_composite ON public.serie_data USING btree (post_id, date);


--
-- TOC entry 3678 (class 1259 OID 27502)
-- Name: idx_serie_data_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_data_date ON public.serie_data USING btree (date);


--
-- TOC entry 3679 (class 1259 OID 27501)
-- Name: idx_serie_data_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_data_post_id ON public.serie_data USING btree (post_id);


--
-- TOC entry 3665 (class 1259 OID 27466)
-- Name: idx_serie_posts_indicator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_posts_indicator ON public.serie_posts USING btree (indicator_id);


--
-- TOC entry 3666 (class 1259 OID 27467)
-- Name: idx_serie_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_posts_status ON public.serie_posts USING btree (status);


--
-- TOC entry 3667 (class 1259 OID 27469)
-- Name: idx_serie_posts_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_posts_submitted_at ON public.serie_posts USING btree (submitted_at DESC);


--
-- TOC entry 3668 (class 1259 OID 27600)
-- Name: idx_serie_posts_submitted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_posts_submitted_by ON public.serie_posts USING btree (submitted_by);


--
-- TOC entry 3671 (class 1259 OID 27486)
-- Name: idx_serie_validations_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_validations_post_id ON public.serie_validations USING btree (post_id);


--
-- TOC entry 3672 (class 1259 OID 27527)
-- Name: idx_serie_validations_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_serie_validations_unique ON public.serie_validations USING btree (post_id, validated_by);


--
-- TOC entry 3673 (class 1259 OID 27488)
-- Name: idx_serie_validations_validated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_validations_validated_at ON public.serie_validations USING btree (validated_at DESC);


--
-- TOC entry 3674 (class 1259 OID 27526)
-- Name: idx_serie_validations_validated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_serie_validations_validated_by ON public.serie_validations USING btree (validated_by);


--
-- TOC entry 3684 (class 1259 OID 93056)
-- Name: user_roles_role_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_role_user_id_idx ON public.user_roles USING btree (role, user_id);


--
-- TOC entry 3688 (class 2620 OID 93027)
-- Name: user_roles on_user_role_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_user_role_change AFTER INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.handle_update_user_role();


--
-- TOC entry 3686 (class 2606 OID 27496)
-- Name: serie_data serie_data_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serie_data
    ADD CONSTRAINT serie_data_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.serie_posts(id) ON DELETE CASCADE;


--
-- TOC entry 3685 (class 2606 OID 27481)
-- Name: serie_validations serie_validations_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serie_validations
    ADD CONSTRAINT serie_validations_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.serie_posts(id) ON DELETE CASCADE;


--
-- TOC entry 3687 (class 2606 OID 93017)
-- Name: user_roles user_roles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 3846 (class 3256 OID 35613)
-- Name: serie_data Enable insert based on user_id post parent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert based on user_id post parent" ON public.serie_data FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IN ( SELECT serie_posts.submitted_by
   FROM public.serie_posts
  WHERE (serie_posts.id = serie_data.post_id))));


--
-- TOC entry 3848 (class 3256 OID 34454)
-- Name: serie_posts Enable insert for users based on user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for users based on user_id" ON public.serie_posts FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = submitted_by));


--
-- TOC entry 3849 (class 3256 OID 35612)
-- Name: serie_data Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.serie_data FOR SELECT USING (true);


--
-- TOC entry 3847 (class 3256 OID 34428)
-- Name: serie_posts Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.serie_posts FOR SELECT USING (true);


--
-- TOC entry 3850 (class 3256 OID 93053)
-- Name: serie_posts Only editors can status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only editors can status" ON public.serie_posts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'editor'::text))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'editor'::text)))) AND ((status)::text IS DISTINCT FROM (status)::text) AND (NOT ((indicator_id)::text IS DISTINCT FROM (indicator_id)::text)) AND (NOT (data_source IS DISTINCT FROM data_source)) AND (NOT ((frequency)::text IS DISTINCT FROM (frequency)::text)) AND (NOT (notes IS DISTINCT FROM notes)) AND (NOT (submitted_by IS DISTINCT FROM submitted_by)) AND (NOT (url IS DISTINCT FROM url))));


--
-- TOC entry 3842 (class 0 OID 27490)
-- Dependencies: 391
-- Name: serie_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.serie_data ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3840 (class 0 OID 27453)
-- Dependencies: 389
-- Name: serie_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.serie_posts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3841 (class 0 OID 27470)
-- Dependencies: 390
-- Name: serie_validations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.serie_validations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3843 (class 3256 OID 27525)
-- Name: serie_validations serie_validations_allow_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY serie_validations_allow_read ON public.serie_validations FOR SELECT TO authenticated USING (true);


--
-- TOC entry 3844 (class 3256 OID 27538)
-- Name: serie_validations serie_validations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY serie_validations_insert ON public.serie_validations FOR INSERT TO authenticated WITH CHECK ((validated_by = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 3845 (class 3256 OID 27539)
-- Name: serie_validations serie_validations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY serie_validations_update ON public.serie_validations FOR UPDATE TO authenticated USING ((validated_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((validated_by = ( SELECT auth.uid() AS uid)));


-- Completed on 2026-03-31 20:50:07

--
-- PostgreSQL database dump complete
--

