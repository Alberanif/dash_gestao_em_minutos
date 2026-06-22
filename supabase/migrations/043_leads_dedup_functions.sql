-- Total unique leads by distinct email
CREATE OR REPLACE FUNCTION public.dash_gestao_leads_unique_total(
  p_start_date text,
  p_end_date text,
  p_eventos text[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT email)
  FROM public.dash_gestao_captacao_leads
  WHERE data_cadastro >= (p_start_date || 'T00:00:00')::timestamptz
    AND data_cadastro <= (p_end_date || 'T23:59:59')::timestamptz
    AND (
      p_eventos IS NULL
      OR array_length(p_eventos, 1) IS NULL
      OR evento = ANY(p_eventos)
    );
$$;

-- Unique leads per event (dedup by email+evento)
CREATE OR REPLACE FUNCTION public.dash_gestao_leads_by_event_unique(
  p_start_date text,
  p_end_date text,
  p_eventos text[] DEFAULT NULL
)
RETURNS TABLE (evento text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    evento,
    COUNT(DISTINCT email) AS count
  FROM public.dash_gestao_captacao_leads
  WHERE data_cadastro >= (p_start_date || 'T00:00:00')::timestamptz
    AND data_cadastro <= (p_end_date || 'T23:59:59')::timestamptz
    AND (
      p_eventos IS NULL
      OR array_length(p_eventos, 1) IS NULL
      OR evento = ANY(p_eventos)
    )
  GROUP BY evento
  ORDER BY COUNT(DISTINCT email) DESC;
$$;

-- Unique leads per source (dedup by email+utm_source)
CREATE OR REPLACE FUNCTION public.dash_gestao_leads_by_source(
  p_start_date text,
  p_end_date text,
  p_eventos text[] DEFAULT NULL
)
RETURNS TABLE (source text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(BTRIM(utm_source), ''), '(sem fonte)') AS source,
    COUNT(DISTINCT email) AS count
  FROM public.dash_gestao_captacao_leads
  WHERE data_cadastro >= (p_start_date || 'T00:00:00')::timestamptz
    AND data_cadastro <= (p_end_date || 'T23:59:59')::timestamptz
    AND (
      p_eventos IS NULL
      OR array_length(p_eventos, 1) IS NULL
      OR evento = ANY(p_eventos)
    )
  GROUP BY 1
  ORDER BY
    CASE WHEN COALESCE(NULLIF(BTRIM(utm_source), ''), '(sem fonte)') = '(sem fonte)' THEN 1 ELSE 0 END,
    COUNT(DISTINCT email) DESC;
$$;

-- Daily counts using first registration date per unique email
CREATE OR REPLACE FUNCTION public.dash_gestao_leads_daily_counts(
  p_start_date text,
  p_end_date text,
  p_eventos text[] DEFAULT NULL
)
RETURNS TABLE (date text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    first_date::text AS date,
    COUNT(*) AS count
  FROM (
    SELECT
      email,
      MIN(data_cadastro)::date AS first_date
    FROM public.dash_gestao_captacao_leads
    WHERE data_cadastro >= (p_start_date || 'T00:00:00')::timestamptz
      AND data_cadastro <= (p_end_date || 'T23:59:59')::timestamptz
      AND (
        p_eventos IS NULL
        OR array_length(p_eventos, 1) IS NULL
        OR evento = ANY(p_eventos)
      )
    GROUP BY email
  ) unique_leads
  GROUP BY first_date
  ORDER BY first_date;
$$;

-- Organic leads unique count for convite module (dedup by email, ORG + unknown source)
CREATE OR REPLACE FUNCTION public.dash_gestao_organic_leads_unique_count(
  p_start_date text,
  p_end_date text,
  p_eventos text[]
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT email)
  FROM public.dash_gestao_captacao_leads
  WHERE data_cadastro >= p_start_date::timestamptz
    AND data_cadastro <= p_end_date::timestamptz
    AND (utm_content = 'ORG' OR utm_content = '')
    AND evento = ANY(p_eventos);
$$;
