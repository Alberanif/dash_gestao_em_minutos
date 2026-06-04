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
    data_cadastro::date::text AS date,
    COUNT(*) AS count
  FROM public.dash_gestao_captacao_leads
  WHERE data_cadastro >= (p_start_date || 'T00:00:00')::timestamptz
    AND data_cadastro <= (p_end_date || 'T23:59:59')::timestamptz
    AND (
      p_eventos IS NULL
      OR array_length(p_eventos, 1) IS NULL
      OR evento = ANY(p_eventos)
    )
  GROUP BY 1
  ORDER BY 1;
$$;
