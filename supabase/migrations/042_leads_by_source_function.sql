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
  ORDER BY
    CASE WHEN COALESCE(NULLIF(BTRIM(utm_source), ''), '(sem fonte)') = '(sem fonte)' THEN 1 ELSE 0 END,
    COUNT(*) DESC;
$$;
