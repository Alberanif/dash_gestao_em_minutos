-- UP
-- Intentional truncate — table will be repopulated via batch collect after migration
truncate table dash_gestao_hotmart_sales;

alter table dash_gestao_hotmart_sales
  add constraint fk_hotmart_sales_product_id
    foreign key (product_id) references dash_gestao_hotmart_products(product_id);

alter table dash_gestao_hotmart_sales
  add constraint fk_hotmart_sales_offer_code
    foreign key (offer_code) references dash_gestao_hotmart_offers(offer_code);

-- DOWN
-- alter table dash_gestao_hotmart_sales drop constraint if exists fk_hotmart_sales_offer_code;
-- alter table dash_gestao_hotmart_sales drop constraint if exists fk_hotmart_sales_product_id;
