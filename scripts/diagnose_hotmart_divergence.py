#!/usr/bin/env python3
"""
Diagnóstico de divergência Hotmart vs Banco.
Compara os transaction codes do CSV oficial com os registros do banco
para identificar os 15 registros extras.
"""

import csv
import json
import os
import sys
import urllib.request
import urllib.parse

# ── Lê .env.local ────────────────────────────────────────────────────────────
env = {}
env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY  = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados em .env.local")
    sys.exit(1)

# ── Parâmetros do funil ───────────────────────────────────────────────────────
PRODUCT_IDS  = ["7242140", "7242519"]
START_DATE   = "2026-02-21"
END_DATE     = "2026-05-29T23:59:59"
STATUSES     = ["COMPLETE", "APPROVED"]

CSV_PATH = os.path.join(
    os.path.dirname(__file__), "..",
    "hormart_data",
    "sales_history_20260419062922_4082475013003488555986030982.csv",
)

# ── Lê transaction codes do CSV ───────────────────────────────────────────────
csv_transactions = set()
with open(CSV_PATH, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        tx = row.get("Transação", "").strip()
        if tx:
            csv_transactions.add(tx)

print(f"CSV: {len(csv_transactions)} transaction codes")

# ── Consulta o banco via Supabase REST API ────────────────────────────────────
headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

product_filter = ",".join(f'"{p}"' for p in PRODUCT_IDS)
status_filter  = ",".join(f'"{s}"' for s in STATUSES)

query = (
    f"select=transaction_code,product_id,status,purchase_date,buyer_email,offer_code,currency,price"
    f"&product_id=in.({product_filter})"
    f"&status=in.({status_filter})"
    f"&purchase_date=gte.{START_DATE}"
    f"&purchase_date=lte.{END_DATE}"
    f"&limit=2000"
)

url = f"{SUPABASE_URL}/rest/v1/dash_gestao_hotmart_sales?{query}"

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    db_rows = json.loads(resp.read())

db_transactions = {r["transaction_code"]: r for r in db_rows}
print(f"DB:  {len(db_transactions)} registros COMPLETE/APPROVED no período do funil")
print()

# ── Calcula divergência ───────────────────────────────────────────────────────
only_in_db  = {k: v for k, v in db_transactions.items() if k not in csv_transactions}

print(f"Registros EXTRAS no banco (não aparecem no CSV): {len(only_in_db)}")
print()

if only_in_db:
    currencies = {}
    for r in only_in_db.values():
        c = r.get("currency", "?")
        currencies[c] = currencies.get(c, 0) + 1
    print("Moedas dos registros extras:", currencies)
    print()
    print("=== Detalhes dos registros extras no banco ===")
    for tx, row in sorted(only_in_db.items()):
        print(f"  tx={tx}  product={row['product_id']}  status={row['status']}  "
              f"date={row['purchase_date'][:10]}  currency={row.get('currency')}  "
              f"price={row.get('price')}  offer={row.get('offer_code')}  "
              f"email={row.get('buyer_email')}")

# ── Moedas de TODOS os registros no banco (visão geral) ──────────────────────
print()
all_currencies = {}
for r in db_rows:
    c = r.get("currency", "?")
    all_currencies[c] = all_currencies.get(c, 0) + 1
print("Moedas de TODOS os 306 registros no banco:", all_currencies)
