# Data and export format

## What one row means

One trial row is one timed primary-button press, successful or missed. A movement can have multiple attempts; their durations are cumulative from activation of the same target. Unscored starting clicks and incomplete paused movements are not trial rows. Set JSON records contain interruption logs.

CSV is the compact analysis table. JSON contains the same records, sampled paths, and session/set metadata. Credentials and passwords are excluded from both exports. The participant stores local records in IndexedDB and exports them even when an upload is pending or unavailable.

## Principal fields

| Fields | Meaning |
|---|---|
| `schema_version`, `app_version` | Record and application versions; currently 1 and 1.1.1. |
| `source` | Origin label: participant-side records, server-accepted classroom records, or explicitly synthetic simulation. Instructor top-level exports also record source mode. |
| `id` | Unique attempt UUID. Server retries are deduplicated within participant. |
| `participant_id`, `participant_label` | Random identity and display label. Server replaces client identity fields with its authenticated participant identity. |
| `room_id` | Classroom UUID when shared; null for standalone records. |
| `set_id`, `movement_id`, `target_index`, `attempt` | Set, target-activation sequence, zero-based completed-target index, and one-based press attempt. |
| `task`, `variant`, `condition` | Task family (`horizontal`, `circles`, `interfaces`), target type, and condition key. Guided horizontal keys identify each designed distance and width. Guided menu/window keys distinguish approaches to a control (`-control`) from travel back to an ordinary button (`-between`). |
| `hit`, `practice` | Boolean outcome and optional protocol flag. Current guided timed rows are not practice. |
| `acquisition_ms` | Target activation to this press, in milliseconds. Includes reaction/correction. |
| `completion_ms` | Same elapsed duration for a successful press; null for a miss. |
| `distance` | Actual starting point to target center, in CSS pixels. |
| `nominal_distance` | Designed source-center to target center, in CSS pixels. |
| `target_w`, `target_h` | Target dimensions in CSS pixels. For a circle both equal its diameter. |
| `approach_width` | Circle diameter or rectangular center-directed chord. |
| `index_difficulty` | Shannon `log2(1 + distance/approach_width)`; null for edge/corner constrained variants. Recomputed on upload. |
| `start_x/y`, `target_x/y`, `click_x/y` | Arena-relative CSS-pixel coordinates, y downward. |
| `path` | JSON array `{x,y,t}`; CSS coordinates, elapsed milliseconds from activation. Up to 120 local samples and 40 uploaded samples. Not included in CSV. |
| `perturbation`, `jitter_css_px`, `gain`, `seed` | Normal/jitter setting, amplitude parameter, scalar gain, reproducibility seed. |
| `input_mode`, `device` | Virtual/native implementation; self-reported coarse device category. |
| `viewport_width`, `dpr` | Displayed arena width in CSS pixels; device-pixel ratio. |
| `created_at` | Client UTC timestamp for chronology, not the duration clock. |
| `seq` | Server-assigned sequence included in instructor records for reconciliation. Not a timing measurement. |

## Recommended analysis choices

Use JSON when you need trajectories, reliable boolean types, or complete metadata. For speed–difficulty analysis, filter to the chosen task and input condition, `attempt==1`, and `practice==false`. Keep first-attempt errors available for an accuracy summary. Fit successful attempts or condition means only with a clearly stated error treatment; do not silently call a corrected-success duration a first-attempt movement.

Do not add the cumulative durations of successive retries. Total movement completion time is the `completion_ms` of its successful final attempt. A movement interrupted after a miss may have no success; its attempts remain observable and the set log records interruption.

Device and person identifiers are grouping variables, not performance rankings. Boundary conditions belong in their matched comparison. Missing scalar difficulty is intentional.

## Storage, retries, and cloud copies

Local browser stores: `trials`, `sets`, `meta`, `outbox`, and `localClass`. Ordinary preferences and participant credentials use localStorage; instructor Auth tokens use sessionStorage. JSON exports omit these secrets.

Uploads are buffered and retried. The server acknowledges individual IDs; only acknowledged outbox entries are removed. Local records are retained after acknowledgement. PostgreSQL stores each accepted attempt, including its bounded path, inside `trials.data`; indexed columns carry room/participant/attempt identifiers and a monotonic insertion sequence.

The server serializes insertion transactions per room so its snapshot cursor does not skip a lower-sequence transaction that commits late. Broadcast notifications do not advance the authoritative snapshot cursor. On reconnect the instructor retrieves records after that cursor and deduplicates any already seen live events.

A room is open for up to 24 hours. Closing stops new joins and leaves a ten-minute upload grace period, bounded by expiry. Deletion removes room, participants, and measurements through cascading foreign keys. It does not remove files someone already downloaded or participant-local browser history. Realtime's own temporary message retention is controlled by Supabase; see SECURITY.

## Reproducibility limits

A perturbation seed and geometry are preserved, but the entire OS input trajectory, driver acceleration, and display timing are not recreated from the export. Sampled paths are sufficient for the teaching views; they are not an exact replay of every input event. The application records neither screen contents nor general keystrokes.
