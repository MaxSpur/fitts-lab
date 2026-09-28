# Security, privacy, and operating boundaries

## Threat model

This is a teaching application for a known, modest-size classroom. It is not a high-stakes assessment, medical test, public crowdsourcing service, or anti-cheating system. Participants can inspect and modify their own client code and submit fabricated measurements; validation bounds the data but cannot establish that a physical movement occurred.

Use a dedicated Supabase project and close admission when the exercise ends. The stable classroom slug is public and is not a secret invitation. Anyone who knows the open participant URL can request a seat. For an open-internet event, add an admission token/roster check or a bot-protection layer and additional rate limiting before deployment.

## Authorization boundaries

Student joining generates a 256-bit random credential and a stable client UUID in the browser. The credential is saved before the request so retries remain idempotent. PostgreSQL stores its SHA-256 hash, not the raw credential. The returned participant identity belongs to one room. Every submission must prove possession of that credential, and the server supplies the authoritative room, identity, display label, and source fields.

Teacher login uses Supabase Auth. Every privileged API call verifies its bearer token with Auth, checks the separate `instructors` allowlist, and verifies room ownership. Hiding `classroom.html` is not a security mechanism; authorization is enforced server-side. Disable public Auth sign-ups for this dedicated application.

All application tables have RLS enabled. Anonymous clients have no direct table access or permission to call the write RPCs. Authenticated users only read their own room metadata through a narrow policy, supporting private-Realtime authorization. The Edge Function alone invokes the service-only RPCs. Receive access to `realtime.messages` requires the instructor to own the room. Browsers are not granted permission to publish classroom broadcasts.

The Edge Function's platform-level JWT check is disabled because it accepts custom participant credentials. This does **not** make privileged operations public: the handler performs the checks described above. Do not remove those checks.

## Keys and local credential handling

Only the project URL, public classroom slug, and publishable key go in `config.js`. Server keys stay in Supabase's injected environment or Edge Function secrets. Never commit a database password, Auth password, raw participant token, or a `.env` secret file.

Teacher tokens live in sessionStorage, so sign out when using a shared computer and close the tab. Participant credentials and local results stay in that browser profile until cleared. A cross-site scripting compromise on the hosting origin could access browser credentials: serve trusted application code and avoid co-hosting untrusted applications on the same origin. CORS allowlisting is a browser-origin control, not proof of identity and not protection against direct scripted API calls.

Application text from session titles, labels, and imports is inserted with textContent. Uploaded chart data cannot supply executable chart expressions. The code viewer exports only application-generated specifications plus the selected measurement data. Opening data in an external editor is a separate deliberate user action; the app does not automatically send it there.

## Validation and abuse limits

The backend accepts a bounded JSON body, 1–24 observations per batch, known task/variant values, finite bounded measurements, validated UUIDs, monotonic bounded paths, and compatible input settings. It recomputes scalar difficulty from validated geometry, excludes boundary IDs, and overrides identity fields. Upload paths contain at most 40 samples. SQL write helpers are not executable by anonymous/authenticated browser roles.

Room capacity is configured (1–400), with 4,000 accepted attempts per participant and 150,000 per room. A participant can submit a new batch no more often than every 250 ms. These are operational bounds, not guarantees of supported class size. Expiry and the close/grace window constrain when data can be accepted. Unique participant/attempt IDs prevent duplicate insertion on retries.

These checks do not provide global denial-of-service protection: an attacker can still send invalid requests, consume Edge Function invocations, or repeatedly request new seats while admission is open. Monitor usage, use a closed classroom context, and add stronger admission protection for public events. A free plan's quota is not a security control.

## What is collected

Shared records include random participant labels, self-reported device category, experiment geometry, timing, outcomes, gain/jitter settings, arena width, device-pixel ratio, and sampled pointer trajectories inside the task. No student name, email, full screen image, IP address field, or general keystroke record is stored by the application. Hosting/backend services may retain connection metadata and IP addresses in their own logs.

Random identifiers do not by themselves guarantee anonymization. Explain the collection and retention to students under your institution's rules. The sharing checkbox is an application-level notice/choice, not a claim that every legal requirement has been met. Students can continue privately and export locally. Previously completed standalone measurements are not uploaded retroactively when they join.

Stopping sharing affects future measurements. Attempts already explicitly queued while sharing can finish uploading. Closing a classroom stops new joining immediately; already joined students have the bounded grace period for delayed uploads. A later classroom never silently adopts old queued measurements.

## Retention and deletion

Room closure preserves its data for instructor export/review. There is no automatic deletion schedule in this version: choose a retention period and delete old rooms from the instructor page. Deleting a room cascades through its participants and trial rows. It does not erase browser-local history, exported files, provider backups, or provider logs.

Supabase documents temporary database-Broadcast messages in `realtime.messages` with approximately three-day retention. Deleting the application room removes access to its private channel through the ownership policy, but does not immediately purge that service-managed message store. For strict retention requirements, review the provider's documented retention and your institutional agreement before use.

The local Clear command erases the participant's measurements, sets, and pending uploads. It does not delete the instructor's cloud copy. Clearing site storage through the browser also removes saved participant credentials and can create a new identity on rejoining.

## Sources

[Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), and [Broadcast retention](https://supabase.com/docs/guides/realtime/broadcast).
