# Testing and release status

## Checks completed while producing this package

- JavaScript syntax checks across application modules, shared validation, scripts, and the backend JavaScript handler.
- Automated Node tests for geometry, Fitts-limit algebra, the click state machine, misses/retries, pauses, boundary handling, record validation, aggregation helpers, and mocked backend authorization paths.
- Compilation of all six plot specifications using the actual bundled Vega-Lite 6.4.2 compiler, followed by the actual Vega 6.2.0 parser. This caught and corrected a duplicated layered-selection signal.
- Chromium DOM/render checks using the real application modules and bundled Vega: initial participant layout, eight recorded native-mode selections, the completed-set review, mini charts, result rendering, code-viewer export, infinite-edge toggle, actual Pointer Lock entry, and Escape release.
- Instructor simulated-preview rendering, the distance↔difficulty transition, pause/resume of displayed data, and no JavaScript/page errors during those checks.

**Important testing boundary:** the packaged offline Chromium suite injects local assets into an in-memory page and replaces persistence with a test-only memory adapter. That adapter exists only in `e2e/render_offline.py`; it is not shipped as production storage. A separate served-origin browser check verified the serial free window-control interaction and visible traces, but neither check establishes hosted CORS, cloud connectivity, or captured-cursor feel on classroom hardware.

No Supabase project was provisioned, no migration was executed against hosted PostgreSQL, and no Edge Function or private Realtime channel was tested live during package production. Real Safari and classroom-network/load testing also remain to be done. The implementation includes the infrastructure and tests needed to perform those checks after configuration; it is not represented as an already verified hosted service.

## Run the dependency-free tests

```sh
npm run check
npm test
npm run build
```

Node 20+ is sufficient. The runtime tests do not download packages. `tests/charts.test.mjs` uses the genuine vendored compiler/parser, not a mock renderer. `tests/backend.test.mjs` explicitly mocks upstream Auth/PostgREST responses; those tests validate the handler's behavior, not deployed database policies.

## Run the hosted smoke test

After following DEPLOYMENT, create **`.env.smoke`** in the project root. It is ignored by Git:

```text
FITTS_EMAIL=YOUR_EMAIL@example.org
FITTS_PASSWORD="YOUR_INSTRUCTOR_PASSWORD"
FITTS_ORIGIN=https://YOUR_USERNAME.github.io
```

Use an editor/password manager; do not paste the password into a public terminal log. `FITTS_ORIGIN` is optional, but supplying it checks the response's allowed-origin header. Ensure `config.js` points to the intended dedicated project.

```sh
node --env-file=.env.smoke scripts/cloud-smoke.mjs
```

The script signs in, opens a uniquely named test room, joins idempotently, produces one valid trial using the real measurement engine, submits it twice, verifies one stored row, rejects bad credentials and an unauthenticated snapshot, checks direct anonymous access, closes admission, and deletes its own test room in `finally`. It logs a room UUID if cleanup fails. It does not alter an existing `hci` room.

This is a write test against your own cloud project. Run it deliberately, inspect its output, and delete `.env.smoke` after use. It is not executed by the frontend deployment workflow.

The smoke test does not verify WebSocket delivery, browser CORS enforcement, login UI, browser storage, or classroom capacity. Use the manual checks below for those.

## Real-browser and classroom checklist

### Measurement and UX

1. Test current desktop Safari and Chrome on the actual teaching computers, with a mouse and trackpad.
2. Request Pointer Lock through Start. Confirm the cursor is confined, Escape releases it, a denied request gives a usable message, and Resume begins with an unscored starting click.
3. Hit a menu edge/corner rapidly, then reverse direction slightly. Reversal must respond immediately; accumulated overshoot must not trap the cursor.
4. Click outside a target. Confirm a miss appears and a successful retry has the same movement ID and an incremented attempt number.
5. Complete a set. The screen should remain in Review, retaining traces. A separate click starts the next set. The final target click must not activate the next-set button.
6. Resize or switch tabs during a movement. The attempt pauses rather than becoming an enormous successful time.
7. Test display scaling/zoom and laptop viewport width. The arena preserves geometry within a set and pauses if resized.

### Storage and sharing

1. In a real served origin, complete a set and reload. Counts/history must remain. Resume an unfinished set and check completed-count recovery.
2. Create Local rehearsal and join from its `?local=1` link in another tab of the **same** browser profile and exact origin. The counts should agree. Do not confuse this with cross-computer cloud sharing.
3. In a real cloud room, use two browser profiles or two computers. Check labels and per-attempt live updates, then refresh the instructor and compare the stored snapshot count.
4. Disconnect networking on the participant; keep collecting. Reconnect before room expiry, and verify the queued attempts drain once, with no duplicates.
5. Keep the private Realtime status visible. Force a WebSocket interruption and check that database polling recovers missing records and reconnection does not double-count them.
6. Stop sharing. New standalone attempts must stay out of the class. Earlier queued, consented attempts may finish uploading.
7. End a room. It should refuse new joins while accepting delayed existing submissions for the bounded grace period. Start a new room and confirm old records do not migrate into it.

### Authorization

1. Signed-out requests must not obtain a class snapshot or create/delete rooms.
2. An Auth account missing the instructor allowlist must not get instructor access.
3. A second allowlisted instructor must not access a first instructor's room or private Realtime topic.
4. Participant credentials from one participant/room must not submit as another participant.
5. Unauthenticated requests to the table REST API and write RPCs must not expose/modify measurements.
6. Private Realtime must work with the narrowly scoped SELECT policy; do not add public table policies or public channel access to make a test pass.

### Load and presentation

Rehearse with several real devices on the classroom network. Inspect Edge Function error/latency logs, Realtime limits, and database response time. A burst of 40 real clients is not the same as simulated preview on one browser. The preview never exercises the network. Do not infer auditorium capacity from smooth local animation.

Test projection resolution, Freeze/Resume, full-screen fallback, slow trials outside the initial axis range, and device/condition filters. Verify that synthetic preview/import banners remain visible. Export JSON and confirm it contains real records only when the source is the real room.

## Optional browser automation

`e2e/render_offline.py` reproduces the limited in-memory Chromium checks described above. It requires Python Playwright and a Chromium executable at `/usr/bin/chromium`; adapt that path on your own machine. This is a development test utility, not part of the deployed website. Browser-based smoke checks can instead use the served pages directly in your normal browsers and the checklist above.
