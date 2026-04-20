ALTER TABLE dash_gestao_meta_ads_campaigns_daily
  ADD CONSTRAINT fk_campaigns_daily_account
  FOREIGN KEY (account_id)
  REFERENCES dash_gestao_accounts(id)
  ON DELETE CASCADE;
