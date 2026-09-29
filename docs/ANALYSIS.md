# Classroom analysis and public overview

## Shared dashboard

`classroom.html` and `overview.html` use the same `src/dashboard.js`, statistical module, chart specifications, report generator, and code views. The combined acquisition-time plot remains the default. **Layout → Separate stages** is optional and uses common x/y bounds. Display controls never change stored measurements.

The main plot shows faint raw first attempts, stage/input-specific fitted lines, and shaded uncertainty in the fitted mean. Selecting a run highlights its observations, overlays its descriptive fit, rescales to its retained observations, and shows its latest 12 raw paths. Height changes physical plot height. A worker calculates numerical summaries while selection and layout changes reuse the result. Live snapshots are coalesced and stale jobs cannot overwrite a different source.

Menu and Window have separate paired-estimation cards. On the left are free/edge run means. On the right each row is one participant's average difference across usable run pairs. Small diamonds preserve individual run differences; a large class diamond and interval show the equal-participant estimate. Positive values mean **free minus bounded**, hence a benefit from the boundary. The accuracy section has the same layout in percentage points. Clicking a participant summary inspects that participant's latest received run. No density or violin shape is inferred from the small sample.

## Independent units and estimands

All durations remain `acquisition_ms`: target activation to primary-button press, including cue response, movement, and correction. This is not independently detected movement-onset time. Practice records are excluded. Retries retain cumulative time and remain in raw exports/path inspection; they are neither summed nor counted as independent first attempts.

For Fitts fits, use successful first attempts with finite recorded ID, excluding hard-edge variants. Fit each task × protocol version × input mode × device category × gain × perturbation × jitter amplitude separately. A participant's total regression weight is one within each group, divided equally among that participant's retained observations. This estimates an equal-participant-weighted descriptive least-squares relationship; it is not a mixed-effects model and does not assume identical coefficients across stages. Repeat runs can change a participant's observed relationship, but cannot create additional independent people.

The fitted-mean and coefficient intervals use a **participant-cluster percentile bootstrap**: sample participant identities with replacement, retain all their observations/runs together, refit the weighted regression, and take the 2.5th/97.5th percentiles. There are 2,000 deterministic resamples. Sufficient statistics make the resampling efficient. Bands are evaluated at 41 locations within the observed x range and are pointwise 95% intervals for the fitted mean, not prediction intervals for individual clicks or simultaneous 95% bands.

At least eight successful attempts and sufficient geometric variation are required for a line. Intervals are withheld below four participant identities; this is a display safeguard, not a claim that four people establish reliable inference. Four to seven are flagged as a small sample. At least 90% of requested resamples must yield a valid regression. Single-run and per-participant slopes remain descriptive, without population confidence bands.

For boundary timing, form free/edge summaries within the same participant/run, Menu-or-Window type, and every recorded input/protocol setting. Include only approaches to controls (`*-control`), excluding intervening button trips. A usable timing pair requires at least one retained successful first attempt on each side. Available trial exports do not establish complete guided-set execution for every custom/legacy record, so these are called usable pairs rather than completed protocols. Average paired run differences within participant, then average participants equally. Percentage benefit is the average participant-specific `(free − bounded) / free × 100`.

For accuracy, use all first attempts, including long trials and misses. Pair run error rates when both sides have observations, average repeat pairs within participant, and bootstrap participant differences. Timing and accuracy can have different usable samples. Boundary difference intervals also use 2,000 participant resamples; no interval is fabricated for a single person.

## Reference analysis and sensitivity

The report always presents an untrimmed reference and the current-cutoff result side by side under the selected pointer condition. Stage, selection, and layout do not silently change the session-level reference table. Neither result is described as preregistered. Cutoffs are exploratory controls rather than automatic labels of invalid trials.

The report includes record/identity/run counts, slopes/intercepts and weighted R² by input group, slope intervals, paired time and relative differences, first-attempt accuracy, individual descriptive slopes, log-time sensitivity, and design limitations. Log sensitivity regresses `ln(acquisition_ms)` against ID on positive untrimmed successful first attempts. Its R² uses a different response scale and cannot directly rank the millisecond model. Raw CSV/JSON and an analysis JSON export remain available.

## Interpretation limits

This remains a browser-based classroom convenience sample, not an ISO-conformant device evaluation. Saved identities are browser credentials, not a verified roster of distinct people. Free always precedes bounded, confounding practice/order with the boundary contrast. Hardware, browser latency, physical scale, strategies, missing data and sample selection are uncontrolled. Normal pointer does not imply native/system input; recorded input paths are kept separate.

Bootstrap uncertainty cannot correct those design limitations. Repeated live inspection, multiple conditions and interactive exclusions support exploratory interpretation. Weighted R² describes fit, not uncertainty. No p-values, causal boundary claims, mixed-effects estimates or standardized throughput score are generated. Exact-condition repetitions are sparse for endpoint-based throughput, and clamped boundary dispersion cannot be treated as an ordinary effective-width estimate.

## Public overview

The instructor selects a current or historical session and chooses **Publish this session**. One session per slug can be published. Publishing another replaces the previous target. A compare-and-swap revision prevents a stale instructor tab from revoking a newer publication. Publishing does not change admission, expiry, collection, membership, or trials. Ended sessions remain viewable while published.

The participant page quietly discovers the published session and displays **View class results**. Viewing creates no Auth account, participant identity, join request or sharing consent. The public shell has no instructor controller or session controls. Its raw exports contain the same publicly visible measurement snapshot. An optional `overview.html?room=UUID` link works only while that exact room is published; it cannot reveal unpublished history.

The separate `results-api` function exposes metadata and incremental snapshots after a SQL permission check. The snapshot retains participant/run UUIDs, measurement records, and raw trajectories. Credential tokens/hashes and Auth ownership information are not returned. Existing table RLS and private instructor Realtime policies are unchanged. Publication writes verify instructor Auth, allowlist membership, ownership and expected revision. There is no public write alias or anonymous table grant.

Public polling is every ten seconds after a cycle, with pagination and publication/data revision handling. Hidden tabs stop polling. Unpublishing clears the displayed snapshot on the next check. A failed public read clears the view instead of indefinitely retaining possibly revoked content. Responses use `Cache-Control: no-store`; snapshots are not persisted in browser storage. Revocation cannot erase a viewer's previously downloaded copy. Public means anyone may retrieve the published records, not only enrolled students. CORS is not authentication and public reads consume backend resources.

## Deployment

The frontend can deploy independently and fails closed while the results service is unavailable. The existing `classroom-api` and measurement protocol need no changes.

1. Apply **only** `supabase/migrations/202609290002_public_results.sql` in the existing project's SQL Editor or reconciled migration tooling. Do not rerun the original schema. This creates an empty publication table and service-only functions; existing sessions stay unpublished and unchanged.
2. Deploy the new Edge Function from the repository:

```sh
supabase functions deploy results-api --project-ref qzlzetebjbytxamzhliq --no-verify-jwt
```

The function uses existing `ALLOWED_ORIGINS`, `SUPABASE_URL`, and injected `SUPABASE_SERVICE_ROLE_KEY` (or existing `SERVER_SECRET_KEY`). Never put server keys/passwords into frontend configuration. Platform JWT verification is disabled for deliberately public reads; publication writes still perform full instructor authorization.

3. Publish the complete static `dist/` output, including `overview.html` and content-hashed assets. Reload the instructor view, select the desired session, and explicitly publish it. The participant link appears at the next discovery check, up to twenty seconds later.
4. Test in a signed-out browser: view without joining, reject an unpublished room ID, switch the published session, and unpublish. Existing student collection should continue throughout.

A successful GitHub Pages deployment does not apply database migrations or deploy Edge Functions. Backend activation is a separate step.

## Testing and reproducibility

Node tests cover equal-participant weighting, repeat-run identity, deterministic bootstrap bands, sparse samples, pairing and input boundaries, accuracy denominators, cutoff sensitivity, real populated Vega rendering, public-read restrictions, revision resets, revocation, stopped-reader races and bounded requests. The validation workflow applies all migrations and authorization checks to an isolated PostgreSQL service. `tests/sql/results-bootstrap.sql` mocks Supabase schemas for CI only and must never run in production.

The measurement engine, participant protocol version, ingestion, and existing participant charts remain unchanged. New classroom modules are `study.js`, `study-specs.js`, `study-report.js`, `study-worker.js`, and `dashboard.js`.

## Primary references

- Ho et al. (2019), *Moving beyond P values: data analysis with estimation graphics*, Nature Methods 16, 565–566. https://doi.org/10.1038/s41592-019-0470-3
- Saravanan, Berman, and Sober (2020), *Application of the hierarchical bootstrap to multi-level data in neuroscience*. https://arxiv.org/abs/2007.07797. This application resamples whole participant clusters; it does not implement every hierarchical variant in that paper.
- Existing measurement definitions: [METHODS](METHODS.html).
- Vega-Lite ranged areas: https://vega.github.io/vega-lite/docs/area.html
- Supabase authorization: https://supabase.com/docs/guides/functions/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
