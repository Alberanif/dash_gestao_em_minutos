-- RPC que retorna métricas da Hotmart agregadas no banco,
-- evitando o limite de 1000 linhas do PostgREST por query.
create or replace function get_hotmart_metrics(
  p_start_date timestamptz,
  p_end_date   timestamptz
)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'total_sales', (
      select count(*)::int
      from dash_gestao_hotmart_sales
      where status = any(array['COMPLETE','APPROVED'])
        and purchase_date >= p_start_date
        and purchase_date <= p_end_date
    ),
    'total_sales_brl', (
      select count(*)::int
      from dash_gestao_hotmart_sales
      where currency = 'BRL'
        and status = any(array['COMPLETE','APPROVED'])
        and purchase_date >= p_start_date
        and purchase_date <= p_end_date
    ),
    'total_sales_foreign', (
      select count(*)::int
      from dash_gestao_hotmart_sales
      where currency <> 'BRL'
        and status = any(array['COMPLETE','APPROVED'])
        and purchase_date >= p_start_date
        and purchase_date <= p_end_date
    ),
    'total_revenue', (
      select coalesce(sum(price), 0)
      from dash_gestao_hotmart_sales
      where currency = 'BRL'
        and status = any(array['COMPLETE','APPROVED'])
        and purchase_date >= p_start_date
        and purchase_date <= p_end_date
    ),
    'products', (
      select coalesce(
        json_agg(
          json_build_object(
            'product_id',          product_id,
            'product_name',        product_name,
            'sales_count',         sales_count,
            'revenue',             revenue,
            'is_foreign_currency', is_foreign_currency
          )
          order by sales_count desc
        ),
        '[]'::json
      )
      from (
        select
          product_id,
          max(product_name)                                              as product_name,
          count(*)::int                                                  as sales_count,
          coalesce(sum(case when currency = 'BRL' then price else 0 end), 0) as revenue,
          bool_and(currency <> 'BRL')                                   as is_foreign_currency
        from dash_gestao_hotmart_sales
        where status = any(array['COMPLETE','APPROVED'])
          and purchase_date >= p_start_date
          and purchase_date <= p_end_date
        group by product_id
      ) agg
    )
  );
$$;
