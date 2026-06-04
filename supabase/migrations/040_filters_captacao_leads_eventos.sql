alter table dash_gestao_filters
  add column captacao_leads_eventos text[] not null default '{}';

alter table dash_gestao_filters
  drop constraint chk_filter_not_empty;

alter table dash_gestao_filters
  add constraint chk_filter_not_empty
    check (
      hotmart_products != '[]'::jsonb
      or meta_ads_terms != '{}'
      or captacao_leads_eventos != '{}'
    );
