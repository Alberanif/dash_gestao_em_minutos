-- Hardening do cruzamento leads x vendas do card "Origens de Conversão".
--
-- Contexto: no filtro "PC Ao Vivo - 2026" todas as vendas apareciam como
-- "Desconhecido" porque os leads importados tinham data_cadastro NULL e a
-- condição `l.data_cadastro <= fs.purchase_date` nunca era verdadeira.
--
-- Mudanças:
-- 1. COALESCE(data_cadastro, created_at) na condição temporal — lead sem
--    data_cadastro não desaparece mais do matching.
-- 2. Match de email com LOWER(BTRIM()) dos dois lados — leads gravados com
--    maiúsculas/espaços passam a casar com o buyer_email da Hotmart.
-- 3. Lead encontrado mas sem utm_source vira "Direto/Orgânico" — separa
--    "lead sem tracking" (problema de UTM na LP) de "venda sem lead"
--    ("Desconhecido", problema de captação).

CREATE OR REPLACE FUNCTION public.get_conversion_sources(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_product_ids text[] DEFAULT NULL,
  p_eventos text[] DEFAULT NULL
)
RETURNS TABLE (source text, count bigint)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_sales AS (
    SELECT
      s.buyer_email,
      s.purchase_date
    FROM public.dash_gestao_hotmart_sales s
    WHERE s.status = ANY(ARRAY['COMPLETE', 'APPROVED'])
      AND s.purchase_date >= p_start_date
      AND s.purchase_date <= p_end_date
      AND (
        p_product_ids IS NULL
        OR array_length(p_product_ids, 1) IS NULL
        OR s.product_id = ANY(p_product_ids)
      )
  ),
  attributed AS (
    SELECT
      COALESCE(
        (
          SELECT COALESCE(NULLIF(BTRIM(l.utm_source), ''), 'Direto/Orgânico')
          FROM public.dash_gestao_captacao_leads l
          WHERE LOWER(BTRIM(l.email)) = LOWER(BTRIM(fs.buyer_email))
            AND COALESCE(l.data_cadastro, l.created_at) <= fs.purchase_date
            AND (
              p_eventos IS NULL
              OR array_length(p_eventos, 1) IS NULL
              OR l.evento = ANY(p_eventos)
            )
          ORDER BY COALESCE(l.data_cadastro, l.created_at) DESC
          LIMIT 1
        ),
        'Desconhecido'
      ) AS source
    FROM filtered_sales fs
  )
  SELECT
    a.source,
    COUNT(*)::bigint AS count
  FROM attributed a
  GROUP BY a.source
  ORDER BY
    CASE WHEN a.source = 'Desconhecido' THEN 1 ELSE 0 END,
    COUNT(*) DESC;
END;
$$;
