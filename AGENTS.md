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

Read [docs/METHODS.md](docs/METHODS.md) before changing trial timing, target geometry, or boundary comparison. Primary-button press acquires a target; starting clicks are unscored. Misses remain in the same movement. Guided Horizontal has four nine-selection sets, two per width; three designed distances occur six times per width over the full run. Circles has two 12-selection sets. Guided Interfaces starts with one 24-selection varied-button set, then two matched free/edge pairs with eight serial selections per side, always free first. Every Interfaces set has one unscored starting button. Edge pairs share target sequence and boundary frame; the paired chart compares only approaches to menu/window controls under equal input modes. `input_mode`, gain, jitter, and sampled paths are part of exported and classroom records. Adding a trial variant requires an update to `shared/validate.js` and a hosted Edge Function redeploy; the current database stores trial variants in JSON. Keep README user-facing; update METHODS and its HTML copy when measurement behavior changes.

Trendlines use `src/analysis.js` in both pages: successful first attempts, sufficient planned/geometric variation, separate input/device/version groups. Boundary summaries use complete paired participants only. Circular nominal source and restart geometry must follow the previous target.
