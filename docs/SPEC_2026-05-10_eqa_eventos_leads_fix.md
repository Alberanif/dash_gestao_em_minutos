# EQA Eventos Comercial — Leads Metric Fix

**Date:** 2026-05-10  
**Status:** Design Approved  
**Owner:** Alberani

## Problem

The "EQA Eventos Comercial" card displays incorrect lead counts. For example, a one-day campaign with "PERPÉTUO" in the name should show 5 leads (official Meta Ads numbers), but displays 897 leads instead.

**Root cause:** The metrics API queries `dash_gestao_captacao_leads` table instead of the Meta Ads source of truth (`dash_gestao_meta_ads_campaigns_daily`).

## Solution

Change the leads metric query in `/src/app/api/eqa-eventos/[id]/metrics/route.ts` to:
1. Query `dash_gestao_meta_ads_campaigns_daily` instead of `dash_gestao_captacao_leads`
2. Filter by `campaign_id` (using the project's `campaign_ids` array)
3. Filter by `date` between `start_date` and `end_date`
4. Sum the `leads_all` column

## Implementation Details

**File:** `src/app/api/eqa-eventos/[id]/metrics/route.ts`

**Current logic (lines 37-45):**
```typescript
let leadsQuery = supabase
    .from("dash_gestao_captacao_leads")
    .select("id", { count: "exact", head: true })
    .gte("data_cadastro", `${start_date}T00:00:00`)
    .lte("data_cadastro", `${end_date}T23:59:59`);

if ((lead_events ?? []).length > 0) {
    leadsQuery = leadsQuery.in("evento", lead_events);
}
```

**New logic:**
```typescript
let leadsQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("leads_all")
    .gte("date", start_date)
    .lte("date", end_date);

if ((campaign_ids ?? []).length > 0) {
    leadsQuery = leadsQuery.in("campaign_id", campaign_ids);
}
```

The `total_leads` will be calculated by summing all `leads_all` values from the result set.

## Expected Outcome

- PERPÉTUO campaign: 5 leads (correct, matches Meta Ads official numbers)
- CPL automatically recalculated: `total_spend / total_leads`
- All metrics now sourced from Meta Ads as the single source of truth

## Database Schema Reference

Table: `dash_gestao_meta_ads_campaigns_daily`
- `campaign_id` (text): Campaign identifier
- `date` (date): Campaign date
- `leads_all` (integer): Total leads for that campaign on that date
- Other columns: spend, impressions, conversions, etc.

## Testing Plan

1. Open the EQA Eventos Comercial section
2. Find the PERPÉTUO project
3. Check the date range includes the test day
4. Verify total leads shows 5 (not 897)
5. Verify CPL is correctly calculated

## Notes

- `lead_events` field is no longer used in lead metric calculation (kept in schema for backward compatibility)
- `campaign_ids` is the sole filter for the leads query
- This aligns the UI with Meta Ads as the authoritative source for campaign performance
