# EQA Eventos Leads Metric Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the leads metric in the EQA Eventos Comercial card to use Meta Ads data instead of the captação_leads table, showing correct lead counts (5 instead of 897 for PERPÉTUO).

**Architecture:** Modify the `/api/eqa-eventos/[id]/metrics` endpoint to query `dash_gestao_meta_ads_campaigns_daily`, filter by `campaign_ids`, and sum the `leads_all` column instead of counting rows from `dash_gestao_captacao_leads`.

**Tech Stack:** TypeScript, Next.js API Routes, Supabase

---

## File Structure

**Modified files:**
- `src/app/api/eqa-eventos/[id]/metrics/route.ts` — Replace leads query logic

**No new files needed.**

---

### Task 1: Update Leads Query in Metrics API

**Files:**
- Modify: `src/app/api/eqa-eventos/[id]/metrics/route.ts:36-61`

- [ ] **Step 1: Read the current metrics route to understand the full context**

Run: 
```bash
cat src/app/api/eqa-eventos/\[id\]/metrics/route.ts
```

Expected: See the full route file with both `leadsQuery` and `spendQuery` logic.

- [ ] **Step 2: Replace the leadsQuery logic**

Replace lines 36-45 (the entire `leadsQuery` definition and the `if` block for `lead_events`):

**Old code:**
```typescript
  // Total leads from captacao_leads
  let leadsQuery = supabase
    .from("dash_gestao_captacao_leads")
    .select("id", { count: "exact", head: true })
    .gte("data_cadastro", `${start_date}T00:00:00`)
    .lte("data_cadastro", `${end_date}T23:59:59`);

  if ((lead_events ?? []).length > 0) {
    leadsQuery = leadsQuery.in("evento", lead_events);
  }
```

**New code:**
```typescript
  // Total leads from meta_ads_campaigns_daily
  let leadsQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("leads_all")
    .gte("date", start_date)
    .lte("date", end_date);

  if ((campaign_ids ?? []).length > 0) {
    leadsQuery = leadsQuery.in("campaign_id", campaign_ids);
  }
```

Use the Edit tool with exact line numbers to make this change.

- [ ] **Step 3: Update the total_leads calculation**

Currently (around line 70), the code does:
```typescript
const total_leads = leadsResult.count ?? 0;
```

Since we're now selecting `leads_all` values instead of counting rows, replace this line with:

```typescript
const total_leads = (leadsResult.data as { leads_all: number }[] | null)?.reduce((sum, r) => sum + (r.leads_all ?? 0), 0) ?? 0;
```

This sums all `leads_all` values from the result set.

**Context:** The spendRows variable is already defined below, so you may need to reorder slightly. Look at the current code structure around line 70-72 to see the exact placement.

- [ ] **Step 4: Verify the modified route syntax is correct**

Run:
```bash
npx tsc --noEmit src/app/api/eqa-eventos/\[id\]/metrics/route.ts
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit the changes**

```bash
git add src/app/api/eqa-eventos/\[id\]/metrics/route.ts
git commit -m "fix(eqa-eventos): use Meta Ads leads_all instead of captacao_leads for metrics

- Query dash_gestao_meta_ads_campaigns_daily instead of dash_gestao_captacao_leads
- Filter by campaign_ids instead of lead_events
- Sum leads_all column for accurate lead count
- Fixes PERPÉTUO card showing 897 leads instead of 5"
```

---

### Task 2: Manual Testing in Dashboard

**Files:**
- No files modified (testing only)

- [ ] **Step 1: Start the development server**

Run:
```bash
npm run dev
```

Expected: Server starts at http://localhost:3000

- [ ] **Step 2: Navigate to the EQA dashboard**

1. Open browser to `http://localhost:3000/dashboard/eqa`
2. Scroll to the "EQA Eventos Comercial" section
3. Find the PERPÉTUO project card

- [ ] **Step 3: Verify the PERPÉTUO metrics with test date**

1. Click "↓ Expandir seletor de datas" on the PERPÉTUO card
2. Set the date range to include the test day (the day you know should have 5 leads)
3. Click "Buscar"
4. Wait for metrics to load

Expected output:
- Total Leads: **5** (not 897)
- CPL: Recalculated based on new lead count
- Total Gasto: Unchanged (still from Meta Ads spend)

- [ ] **Step 4: Test with a wider date range**

1. Change the date range to a full week/month
2. Click "Buscar" again
3. Verify that leads are summed correctly across multiple days

Expected: Total Leads should be a reasonable number that matches your Meta Ads dashboard.

- [ ] **Step 5: Verify no regressions on other projects**

1. Check other projects in the "EQA Eventos Comercial" section
2. Expand their date selectors and load metrics
3. Verify they still display correctly (or were also wrong and now show correct values)

Expected: All projects load without errors, metrics appear reasonable.

---

## Plan Review Checklist

**Spec coverage:**
- ✅ Problem identified: query was using wrong table
- ✅ Solution implemented: switched to Meta Ads table, filtered by campaign_ids, summed leads_all
- ✅ Expected outcome verified: manual testing confirms correct lead counts
- ✅ No data loss: just correcting the source of truth

**Placeholder scan:**
- ✅ No TBD, TODO, or unspecified error handling
- ✅ All code shown in full
- ✅ All commands have expected output

**Type consistency:**
- ✅ `leadsResult.data` properly typed as `{ leads_all: number }[]`
- ✅ `campaign_ids` filter matches the data structure
- ✅ `total_leads` calculation is correct (sum instead of count)
