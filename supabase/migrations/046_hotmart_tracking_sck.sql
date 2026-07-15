-- Fallback de atribuição via tracking da Hotmart (sck/src do checkout).
--
-- A API sales/history retorna purchase.tracking (source_sck, source,
-- external_code), até então ignorado pelo coletor. Medição em jun-jul/2026:
-- 94% das vendas têm tracking preenchido (source_sck em 1222 de 1331).
--
-- 1. Novas colunas em dash_gestao_hotmart_sales para persistir o tracking.
-- 2. get_conversion_sources ganha cadeia de atribuição:
--    lead com utm_source → lead sem utm ("Direto/Orgânico") →
--    sem lead: source_sck da venda → sem nada: "Desconhecido".
--    SCKs no formato estruturado "s=X|c=Y|m=Z|..." têm o s= extraído como
--    fonte; slugs simples aparecem como estão.
--
-- Rodar APÓS a 045 (esta função já inclui as mudanças da 045).

ALTER TABLE public.dash_gestao_hotmart_sales
  ADD COLUMN IF NOT EXISTS tracking_source_sck text,
  ADD COLUMN IF NOT EXISTS tracking_source text,
  ADD COLUMN IF NOT EXISTS tracking_external_code text;

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
      s.purchase_date,
      s.tracking_source_sck
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
        -- 1º: lead casado por email (utm_source; sem utm → Direto/Orgânico)
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
        -- 2º: sck do checkout Hotmart ("s=X|..." → extrai X; slug simples → bruto)
        CASE
          WHEN fs.tracking_source_sck ~ '^s=' THEN COALESCE(
            NULLIF(BTRIM(split_part(substring(fs.tracking_source_sck FROM 3), '|', 1)), ''),
            NULLIF(BTRIM(fs.tracking_source_sck), '')
          )
          ELSE NULLIF(BTRIM(fs.tracking_source_sck), '')
        END,
        -- 3º: nada
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
