ALTER TABLE dash_gestao_meta_ads_campaigns_daily
  ADD COLUMN link_clicks    bigint       DEFAULT 0,
  ADD COLUMN outbound_clicks bigint      DEFAULT 0,
  ADD COLUMN link_ctr       numeric(8,4) DEFAULT 0,
  ADD COLUMN outbound_ctr   numeric(8,4) DEFAULT 0,
  ADD COLUMN leads_pixel    integer      DEFAULT 0,
  ADD COLUMN leads_all      integer      DEFAULT 0;
