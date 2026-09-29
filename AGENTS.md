# Fitts Lab orientation

Static participant and classroom pages. `index.html` runs the pointing tasks; `classroom.html` aggregates live results. The participant page works offline. Multi-computer sharing needs the Supabase setup in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Code map

- `src/protocol.js`: guided plans, seeded serial target sequences, matched boundary geometry, starting and target positions.
- `src/engine.js`: press-based trial state machine and Canvas interaction. System cursor for ordinary targets; Pointer Lock for simulated hard edges. Live traces use a transparent low-resolution layer; captured movement must not repaint the main Canvas on each mouse event.
- `src/participant.js`: settings, set persistence, charts, classroom joining.
- `src/math.js`, `src/analysis.js`, `src/specs.js`: geometry and descriptive analysis.
- `shared/validate.js`: server ingress checks; `supabase/`: classroom backend.

## Run and check

`npm run dev` serves at `http://127.0.0.1:4173/`. `npm test`, `npm run check`, and `npm run build` need Node 20+. Dependencies are vendored; there is no install step. Use a small browser run with actual clicks for interaction changes. A build or unit test does not verify Safari pointer behavior.

## Measurement rules

Read [docs/METHODS.md](docs/METHODS.md) before changing trial timing, target geometry, or boundary comparison. Primary-button press acquires a target; starting clicks are unscored. Misses remain in the same movement. Horizontal and Circles each have four eight-selection sets (32 per stage); Interfaces has five (40). Horizontal and Circles: widths 20/32/48/64, four designed distances twice per width. Circles uses 16 sites and seeded random connections of 1/3/5/7 steps in either direction, with no repeated target. Interfaces: eight random buttons first (four sizes twice each), then menu free/edge and window free/edge, each alternating four controls with four ordinary buttons. Every Interfaces set has one unscored starting button. Edge pairs share target sequence and boundary frame; the paired chart compares only approaches to menu/window controls under equal input modes. `input_mode`, gain, jitter, and sampled paths are part of exported and classroom records. Adding a trial variant requires an update to `shared/validate.js` and a hosted Edge Function redeploy; the current database stores trial variants in JSON. Keep README user-facing; update METHODS and its HTML copy when measurement behavior changes.

Trendlines use `src/analysis.js` in both pages: successful first attempts, sufficient planned/geometric variation, separate input/device/version groups. Boundary summaries use complete paired participants only. Circular nominal source and restart geometry must follow the previous target.

Classroom data reset uses `reset_fitts_room_data` and `rooms.data_revision`; update both the RPC migration and instructor synchronization when changing reset behavior. Reset preserves memberships; new/in-flight uploads are allowed after it.

`src/session.js` owns admission labels (Open/Ended/Expired). Classroom source changes must clear `renderTimer` as well as its timeout; connection-run guards discard stale snapshots. Combined charts encode stage by shape and participant by color, with stage-specific fits. Keep point-shape and trendline-dash legends independent. Free interface trials enter the combined view; hard-edge trials use the paired chart.

Production builds put the application module graph and stylesheet under a content-hashed asset path to prevent mixed cached releases. Root copies remain available for notebook reuse. Publish `dist/`, not the source tree.

Students choose their own stage; the legacy backend `phase` field is ignored. Plot axes share `plotAxis()` labels and bounds. Size uses approach width, with means grouped by protocol and input settings.

`src/runs.js` owns repeat-run identity and completion. Trials optionally carry `run_id`/`run_number`; older records form an Earlier results dataset. Namespace datasets by participant and run, preserve membership/outbox/history on repeat, and keep condition means and boundary pair keys separated by run. Changing accepted run fields requires an Edge Function redeploy, not a SQL migration.

`src/activity.js` summarizes received selections per run for the classroom sidebar. Count each successful movement once (including retries), exclude practice, preserve arrival order, and never infer online presence or guided completion from these counts. Freeze includes activity and membership snapshots. Device controls are removed; new sets and joins use `unspecified`, while older device values remain compatible.

`src/geometry-lab.js` owns the unrecorded 2D Method editor. It shares the experiment's center-chord formula, keeps the start outside the rectangle, and demonstrates top/right window edges with a clamped preview dot. Edge toggles leave finite geometric indices unchanged; these describe the free target, not bounded pointing. Verify move, edge/corner resize, independent edge toggles, keyboard, cancellation, and reset after changes. Method content stays expanded and uses American English.

The participant workspace caps arena size by window height while preserving aspect ratio and CSS-pixel measurements. Starting a set scrolls only if the stage is clipped; keep current-set charts immediately below it and preserve scroll position across sets.

Participant Reset round deletes only the current run locally and remotely using the saved room-scoped participant credential. `reset_fitts_participant_run` locks room then participant, records `participant_reset_runs` tombstones, adjusts counts, and increments room `data_revision`. Ingestion discards tombstoned runs under the same room lock; preserve this ordering. Local rehearsal uses an atomic meta/localClass tombstone check. Pending reset survives reload, blocks uploads/new trials, and keeps local data until all shared copies are removed. Clear `currentSet` before preparing a replacement run. Start another round preserves all prior data.
