CREATE OR REPLACE FUNCTION public.dash_gestao_distinct_lead_events()
RETURNS TABLE (evento text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT btrim(evento) AS evento
  FROM public.dash_gestao_captacao_leads
  WHERE evento IS NOT NULL
    AND btrim(evento) <> ''
  ORDER BY 1;
$$;
