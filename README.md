# Fitts Lab

Two static websites for a classroom introduction to human–computer interaction.

- **`index.html` — participant.** Three stages, each with four sets of eight timed selections. Horizontal and Circles use four target sizes and balanced, randomized distances; Interfaces alternates ordinary buttons with menu/window controls in matched free/edge sets. Each guided set has one unscored start, then continues from target to target. Horizontal and Circles use the system cursor by default; the matched free/edge sets use a captured cursor. Live movement traces, descriptive trendlines, browser history, and CSV/JSON exports are included.
- **`classroom.html` — instructor.** A live participant mosaic, incoming-data pulses, Distance, Size, and Difficulty views, linked participant inspection, paired boundary comparisons, freeze/presentation modes, exports and snapshot imports.

Both are complete static applications. The participant page works without a backend. Multi-computer classroom sharing requires the included Supabase schema and Edge Function to be deployed and configured; a hosted project is **not** included or pre-provisioned.

## Run now

With Node 20+ installed, from this directory:

```sh
npm run dev
```

Open `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/classroom.html`.
There is no npm-install step. All chart dependencies are bundled locally.
VS Code's Live Server works too; serve this directory, rather than opening an HTML file through `file://`.

For the quickest preview, choose **Simulated preview** on the classroom page. It is conspicuously labeled and never uploaded. To exercise real measurements locally, choose **Local rehearsal**, open its participant link in another tab of the same browser profile, join, and finish a set. Local rehearsal uses same-origin browser storage and BroadcastChannel; it does not connect separate computers or browser profiles.

## Publish and connect the classroom

Read **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. A formatted copy is **[docs/DEPLOYMENT.html](docs/DEPLOYMENT.html)**.

The frontend deploys to GitHub Pages through the included `.github/workflows/pages.yml`. The backend consists of four tables, row-level security and RPC functions, and one Edge Function. Only the teacher needs a Supabase Auth account. Students receive a room-scoped, random credential automatically after they consent to share.

The only public configuration is `config.js`. Never put a secret key, database password, participant token, or instructor password there.

## Where to look

| File | Purpose |
|---|---|
| `src/engine.js` | Timed click state machine; Pointer Lock, virtual cursor, Canvas arena |
| `src/protocol.js` | Guided sets, target geometry, matched conditions |
| `src/specs.js` | Readable, reusable Vega-Lite specifications |
| `src/charts.js` | Vega embedding, serialized updates, code exports |
| `src/math.js` | Geometry, coordinate transformations, descriptive statistics |
| `src/participant.js` | Participant UI and history |
| `src/classroom.js` | Instructor UI and live visualization |
| `src/network.js` | Durable outbox, Auth REST client, private Realtime protocol |
| `shared/validate.js` | Server-ingress validation |
| `supabase/migrations/…sql` | Schema, policies, room/join/ingest transactions |
| `supabase/functions/` | Backend handler and hosted entry point |
| `examples/` | Minimal standalone Vega-Lite examples |

**[TEACHING](docs/TEACHING.md)** has the classroom run sheet. **[METHODS](docs/METHODS.md)** defines exactly what is measured. **[DATA](docs/DATA.md)** documents the exports. **[NOTEBOOK](docs/NOTEBOOK.md)** shows how to reuse a chart in Observable. **[TESTING](docs/TESTING.md)** distinguishes completed checks from the deployment/Safari checks still required. **[SECURITY](docs/SECURITY.md)** describes the trust boundaries and classroom-scale limits.

## Check and build

```sh
npm run check
npm test
npm run build
```

`dist/` contains only the publishable site. No test data, backend source, `.env` files, or saved user measurements enter that directory. The copy-based build works under a GitHub project subpath; no absolute asset base needs editing.

## Scope

The analytical plots use genuine Vega-Lite. The millisecond interaction engine and cursor confinement use JavaScript and Canvas; Vega-Lite is not presented as a pointer-lock experiment framework. Target activation uses the primary mouse-button press throughout. There is no hover activation.

This is an educational illustration, not a calibrated pointing-device benchmark. Acquisition time includes response to the cue, errors remain visible, screen geometry uses CSS pixels, and boundary conditions are analyzed separately. The app deliberately avoids a throughput score and discards no trial solely because it is slow.

The edge comparison needs Pointer Lock on desktop browsers. Browser and device handling of relative mouse movement can feel different, particularly in Safari. Test the captured cursor on classroom machines before using those sets for timing comparisons.

## Credits and dependencies

Conceptually inspired by Simon Wallner and collaborators' [Fitts demonstration](https://github.com/SimonWallner/uit-fitts-law). Application code is a new implementation. The statistical explanations refer to Fitts, Welford, MacKenzie, and related sources listed in METHODS. Chart syntax follows the supplied Observable notebook's `data` / `mark` / `encoding` / `params` pattern.

Vega 6.2.0 and Vega-Lite 6.4.2 are bundled locally. See `vendor/THIRD_PARTY_NOTICES.md` for provenance, versions, and licenses. The full user-provided notebook and its railway dataset are not redistributed.

Original application code is MIT-licensed; see LICENSE. Third-party components retain their own licenses.

The classroom view provides compact task and device filters, participant paths, and descriptive trendlines. Freeze pauses the display while data collection continues.

In the classroom’s **Session & participant link** controls, **Reset data…** clears classroom measurements after confirmation while keeping participants joined. Export any results you need first. Student-local copies remain, and queued uploads may arrive afterward.

Results combine all stages using square/circle/diamond glyphs. The classroom assigns a color to each student; click a tile or point to highlight them. Session status distinguishes Open, Ended, and Expired; ended sessions retain results and briefly accept queued uploads. **Sync now** reconciles saved measurements immediately.

After all three stages, **Start another run** begins a fresh dataset. Earlier results remain available in the Run selector and exports. In a classroom, repeats stay under the same student and appear as separate run tiles; no rejoining is needed. The instructor does not control student stages. Distance, Size, and Difficulty views are available on both pages.
