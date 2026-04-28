# Instagram Daily Metrics — Parallel Collection Period

## Status

**Phase 2 - Parallel collection active (2026-04-27 onwards)**

---

## What's Happening

- **New tables active:** `dash_gestao_instagram_profile_daily` and `dash_gestao_instagram_media_daily` receiving daily updates
- **Old tables active:** `dash_gestao_instagram_profile_snapshots` and `dash_gestao_instagram_media_snapshots` still receiving updates (NOT deprecated)
- **Dashboard:** Still querying old snapshot tables (no change visible to users)
- **Both systems:** Running in parallel for 2-4 weeks to validate data quality before migration

### Data Flow During Parallel Period

Each daily collection run (via `/api/cron/collect`) now:
1. Fetches Instagram profile metrics (followers, reach, impressions)
2. Inserts into BOTH `profile_daily` (new) and `profile_snapshots` (legacy)
3. Fetches last 5 recent media items
4. Inserts into BOTH `media_daily` (new) and `media_snapshots` (legacy)

This ensures zero data loss and allows gradual validation before full migration.

---

## Why Parallel Collection

1. **Zero risk of data loss** — If new system has issues, old tables have unchanged backups
2. **Confidence building** — Time to compare metrics and validate calculations
3. **Engagement rate validation** — New formula `((likes + comments + shares) / reach) * 100` can be verified
4. **Technical metadata** — Confirm `image_url`, `width`, `height`, `duration_ms`, `carousel_children_count` are populated correctly
5. **Gradual cutover** — Dashboard migration can happen in a separate deployment after validation

---

## Validation Checklist

Complete these checks throughout the parallel period (Weeks 1-4):

### Week 1: Daily Data Validation

- [ ] **Profile metrics match:** Query both tables for same date/account, verify `reach` and `impressions` are identical
  ```sql
  -- Compare daily vs snapshot for latest date
  SELECT new.account_id, new.date, new.reach, old.reach as old_reach
  FROM dash_gestao_instagram_profile_daily new
  LEFT JOIN dash_gestao_instagram_profile_snapshots old
    ON new.account_id = old.account_id
  WHERE new.date = CURRENT_DATE - 1
  ORDER BY new.account_id;
  ```

- [ ] **Media engagement calculations:** Spot-check 10 media records, verify formula
  - Expected: `engagement_rate = ((like_count + comments_count + shares) / reach) * 100`
  - Edge case: If reach = 0, engagement_rate should be 0 (not division by zero)

- [ ] **No duplicate rows:** Verify unique constraints are working
  ```sql
  -- Should return 0 rows (no duplicates)
  SELECT account_id, date, COUNT(*)
  FROM dash_gestao_instagram_profile_daily
  GROUP BY account_id, date
  HAVING COUNT(*) > 1;
  ```

- [ ] **Technical metadata populated:** Check that new fields are being filled
  ```sql
  SELECT COUNT(*) as records_with_image_url, 
         COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as non_null
  FROM dash_gestao_instagram_media_daily
  WHERE created_at >= CURRENT_DATE - 7;
  ```

### Week 2: API & Error Monitoring

- [ ] **No API rate limit errors:** Check application logs daily
  - Location: `/api/cron/collect` response logs
  - Look for: HTTP 429 responses or "rate_limit" error messages
  - Expected: Clean responses, no throttling

- [ ] **Engagement rate trends look reasonable:**
  - Query recent media_daily records
  - Verify: engagement_rate between 0-100% (formula includes percent calculation)
  - Look for pattern: Lower-reach posts may have higher engagement rates (normal)

- [ ] **Batch collection works:** Test manual batch collection
  ```bash
  curl -X POST http://localhost:3000/api/instagram/batch-collect \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_CRON_SECRET" \
    -d '{
      "account_id": "YOUR_ACCOUNT_ID",
      "start_date": "2026-04-20",
      "end_date": "2026-04-27"
    }'
  ```
  - Expected: 200 response with `{ profileRecords: 8, mediaRecords: M }`
  - Expected: Date range spans 8 days = 8 profile records minimum

### Week 3: Edge Case Validation

- [ ] **Re-collection is idempotent:** Run batch collection twice for same date range
  ```sql
  -- Should show same created_at timestamp, no new rows
  SELECT date, COUNT(*) as count, MAX(created_at) as latest
  FROM dash_gestao_instagram_profile_daily
  WHERE account_id = 'YOUR_ACCOUNT_ID'
    AND date BETWEEN '2026-04-20' AND '2026-04-27'
  GROUP BY date;
  ```

- [ ] **Media carousel count accurate:** Verify carousel_children_count
  - Check media with `media_type = 'CAROUSEL'`
  - Confirm `carousel_children_count > 0` (not NULL)
  - Expected: Matches actual carousel image count in Instagram

- [ ] **REEL metadata captured:** Check video duration
  - Query REEL media items
  - Verify `duration_ms > 0` and `width`, `height` not NULL
  - Expected: duration_ms in range 0-3600000 (up to 1 hour)

---

## Timeline

| Period | Dates | Actions | Owner |
|--------|-------|---------|-------|
| **Phase 1** | 2026-04-27 | Schema created, code deployed, parallel collection active | Dev Team |
| **Week 1** | 2026-04-27 - 2026-05-04 | Monitor daily data, run validation checks | Ops/QA |
| **Week 2** | 2026-05-05 - 2026-05-11 | Validate engagement calculations, check API errors | Ops/QA |
| **Week 3** | 2026-05-12 - 2026-05-18 | Test edge cases, batch collection, idempotency | Ops/QA |
| **Phase 3** | ~2026-05-18 | Review findings, plan dashboard migration | Dev Team + Product |
| **Phase 4** | ~2026-05-25 | Update dashboard queries to `*_daily` tables | Dev Team |
| **Phase 5** | ~2026-06-01 | Deprecate/delete old snapshot tables | Dev Team |

---

## What the Team Should Monitor

### Daily Checklist (Can be automated)

1. **Logs:** Check `/api/cron/collect` endpoint responses
   - Status: Should see successful collections with `{ profileRecords: X, mediaRecords: Y }`
   - Errors: Watch for Instagram API 429 (rate limit) or timeout errors

2. **Database size:** Monitor table growth
   ```sql
   -- Daily profile records (expected: 1 per account per day)
   SELECT COUNT(*) FROM dash_gestao_instagram_profile_daily;
   
   -- Daily media records (expected: 5 per account per day = 5 * # accounts)
   SELECT COUNT(*) FROM dash_gestao_instagram_media_daily;
   ```

3. **Data freshness:** Verify latest records are from today
   ```sql
   SELECT MAX(date) as latest_profile_date
   FROM dash_gestao_instagram_profile_daily;
   ```

### Weekly Reviews

1. **Engagement rate sanity check:** Any negative rates or rates > 100%?
   ```sql
   SELECT COUNT(*) as invalid_rates
   FROM dash_gestao_instagram_media_daily
   WHERE engagement_rate < 0 OR engagement_rate > 100;
   ```

2. **Missing technical metadata:** Are images/dimensions being captured?
   ```sql
   SELECT 
     COUNT(*) as total,
     COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_url,
     COUNT(CASE WHEN width IS NOT NULL THEN 1 END) as with_dimensions
   FROM dash_gestao_instagram_media_daily
   WHERE created_at >= CURRENT_DATE - 7;
   ```

3. **Data consistency:** Compare old vs new tables
   ```sql
   -- Random sample: verify reach matches
   SELECT COUNT(*) as mismatches
   FROM dash_gestao_instagram_profile_daily pd
   JOIN dash_gestao_instagram_profile_snapshots ps 
     ON pd.account_id = ps.account_id
   WHERE pd.reach != ps.reach
     AND ps.collected_at::date = pd.date;
   ```

---

## Next Steps (After Validation, Week 4+)

### Step 1: Dashboard Migration (1-2 days)
- Update queries in `/app/dashboard/instagram/page.tsx`
- Change from: `profile_snapshots`, `media_snapshots`
- Change to: `profile_daily`, `media_daily`
- Add new columns: `image_url` (for preview thumbnails), `carousel_children_count`, `duration_ms`

### Step 2: API Endpoint Updates (1 day)
- Update `/api/instagram/profile` to query `profile_daily`
- Update `/api/instagram/media` to query `media_daily`
- Return new fields: `image_url`, `width`, `height`, `duration_ms`, `carousel_children_count`

### Step 3: UI Enhancements (2-3 days)
- Add media preview thumbnails using `image_url`
- Add media type badges (CAROUSEL with count, REEL with duration)
- Add engagement growth sparkline (show engagement_rate trend across days)

### Step 4: Stop Legacy Population (1 day)
- Update `src/lib/services/instagram.ts`
- Remove code that populates `profile_snapshots` and `media_snapshots`
- Comment out old table inserts (keep for 2 weeks in case rollback needed)

### Step 5: Archive & Cleanup (1 week later)
- Backup old tables (export to CSV or create archive table)
- Confirm no code references old tables
- Drop old tables: `dash_gestao_instagram_profile_snapshots`, `dash_gestao_instagram_media_snapshots`

---

## Rollback Plan (If Issues Detected)

**Problem:** New tables are not receiving data, calculations are wrong, or API errors increase

**Steps:**
1. **Immediate:** Pause all new deployments, keep parallel collection running
2. **Investigate:** Check logs for the specific error
3. **Fix:** Update collection function in `src/lib/services/instagram.ts`
4. **Redeploy:** Push fix to production
5. **Validate:** Re-run validation checklist on new data
6. **Continue:** Resume dashboard migration planning

**No user impact** because dashboard still queries old tables until cutover is complete.

---

## References

- **Spec:** [`docs/superpowers/specs/2026-04-27-instagram-metrics-restructuring-design.md`](./superpowers/specs/2026-04-27-instagram-metrics-restructuring-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-04-27-instagram-daily-restructuring.md`](./superpowers/plans/2026-04-27-instagram-daily-restructuring.md)
- **Service Code:** `src/lib/services/instagram.ts`
- **Type Definitions:** `src/types/accounts.ts`
- **Migration:** `supabase/migrations/026_instagram_daily_tables.sql` (might be `003_` or `026_` depending on migration number)

### Key Commits

- `6eda265` — feat(instagram): create daily tables for metrics restructuring
- `de64269` — fix(migrations): align instagram daily tables with RLS
- `7210382` — feat(instagram): add daily collection functions for profile and media
- `423912f` — fix(instagram): add missing media_duration and carousel_media API fields

---

## Questions & Support

| Topic | Owner/Contact |
|-------|---------------|
| Data validation questions | [Dev Team Contact] |
| Dashboard migration planning | [Product Manager] |
| API endpoint concerns | [Backend Lead] |
| Performance/scalability | [DevOps/Infrastructure] |

---

## Success Criteria (Post-Migration)

- ✅ Dashboard loads without errors using new daily tables
- ✅ Engagement rate display shows realistic values (0-100%)
- ✅ Media previews display correctly using `image_url`
- ✅ Date range queries return daily granularity (not multiple snapshots per day)
- ✅ Old tables removed without data loss or code references
- ✅ Batch historical collection works for any date range
- ✅ No increase in API rate limit errors vs parallel period
