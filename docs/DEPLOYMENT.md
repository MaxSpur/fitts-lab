# Deploy Fitts Lab

This guide covers local use, a GitHub Pages website, and a Supabase-backed live classroom. The static participant application is ready to run. You must create and configure your own Supabase project for sharing across computers.

The commands below work in Fish on macOS. Replace uppercase placeholders literally. Run project commands inside the extracted `fitts-lab` directory. Keep that full source directory: the smaller ready-to-host archive contains the frontend only.

## Current hosted instance

- Participant: https://www.maximspur.com/fitts-lab/
- Instructor: https://www.maximspur.com/fitts-lab/classroom.html
- Source and deployment: https://github.com/MaxSpur/fitts-lab

GitHub Actions publishes `main` to Pages under the existing `www.maximspur.com` domain. The backend accepts HTTPS origins `maximspur.com` and `www.maximspur.com`; local rehearsal remains available without Supabase. Local hosted-backend testing requires explicitly adding its origin.

The initial database schema was applied through the Supabase Management API (the SQL Editor equivalent), because the CLI stalled during login-role initialization. Before using `supabase db push` on this instance, reconcile migration `202609250001` as already applied; do not rerun the initial SQL. Public frontend configuration is in `config.js`.

## 1. Check the websites locally first

Open the folder in VS Code. With Node 20 or newer installed:

```sh
cd /path/to/fitts-lab
npm run dev
```

Open:

- Participant: `http://127.0.0.1:4173/`
- Instructor: `http://127.0.0.1:4173/classroom.html`

No package installation is required. Use the same host spelling for both tabs: `localhost` and `127.0.0.1` are different browser origins. VS Code **Go Live** is an alternative. Python is another: `python -m http.server 4173 --bind 127.0.0.1` from this directory. Do not double-click the HTML file; browser ES modules require an HTTP(S) origin.

Start with **Simulated preview** to see the instructor display. Synthetic records stay in that preview and are clearly labeled in exported data. Then choose **Local rehearsal**, open the displayed participant link (it ends in `?local=1`) in another tab of the same browser, press **Join live classroom**, consent to sharing, and complete a set. The instructor should receive the actual attempts. Keep both pages open; switching away pauses a running participant trial.

Local rehearsal is limited to the same browser profile and origin. It is not a LAN server, cross-browser link, or classroom substitute.

## 2. Publish the frontend to GitHub Pages

Create an empty GitHub repository, for example `fitts-lab`. A public repository is the straightforward free Pages route. Do not initialize a second README if pushing this complete folder.

Using Git from this directory:

```sh
git init
git branch -M main
git add .
git commit -m "Add Fitts Lab participant and classroom sites"
git remote add origin https://github.com/YOUR_USERNAME/fitts-lab.git
git push -u origin main
```

Alternatively, GitHub Desktop can add and publish the local repository. Check that `.github/workflows/pages.yml` was included.

In the repository, go to **Settings → Pages → Build and deployment → Source → GitHub Actions**. Under **Actions**, run **Test and publish Fitts Lab** manually if the initial push happened before Pages was enabled. The workflow checks the code, runs tests, creates `dist/`, and publishes it. No GitHub secrets are needed for this frontend workflow.

The usual URLs are:

```text
https://YOUR_USERNAME.github.io/fitts-lab/
https://YOUR_USERNAME.github.io/fitts-lab/classroom.html
```

The deployment job displays the actual URL; use it as authoritative. A repository rename or a custom domain changes it. All site asset paths are relative, so no Vite base-path setting is necessary.

At this point, standalone participation, exports, the mathematical explainer, and simulated preview work online. Cross-computer live sharing will say the backend is unconfigured until the remaining steps are complete.

The build publishes only the static site. **Do not change the workflow to upload the entire repository:** the full source includes backend code and local development may include ignored secrets.

## 3. Create a dedicated Supabase project

Create a Supabase account/project and choose a region appropriate to your institution. Prefer a dedicated project because the schema uses generic table names (`rooms`, `participants`, `trials`, `instructors`) and its security policy is intentionally narrow.

Save the project database password securely. You need it for some CLI database operations; it never goes in the website. Note the project reference in the project settings, and the Project URL and **publishable** API key in the Connect/API Keys view.

The current key naming is:

```text
Project URL:     https://PROJECT_REF.supabase.co
Publishable:     sb_publishable_...    ← permitted in config.js
Secret:          sb_secret_...         ← server only
```

A publishable key identifies the application; it is not a password and does not grant unrestricted database access. The schema's policies and the function's authentication perform authorization.

Do not enable anonymous Auth sign-ups. Students use the application’s own room-scoped credentials, so this implementation does not require a wave of Supabase Auth registrations from the classroom’s shared IP address.

## 4. Install the database migration

### Recommended: CLI-managed migration

Install the official Supabase CLI. On macOS with Homebrew:

```sh
brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Run `link` and `db push` from this source folder. It already contains `supabase/config.toml`; do not overwrite it with a fresh initialization. Check the project reference carefully before pushing. The migration creates four tables, indexes, RLS policies, restricted SQL functions, and the private-broadcast receive policy.

The hosted setup uses your cloud database. Running an entire local Supabase stack with `supabase start` is a separate optional workflow that requires a container runtime; it is not necessary for these two static pages.

### Dashboard alternative

In Supabase **SQL Editor**, paste and run the complete file:

```text
supabase/migrations/202609250001_fitts_lab.sql
```

Use **one** migration method. The file is a one-time migration and does not blindly drop existing tables. Rerunning it against an already-installed schema will fail rather than erase data. If you applied it manually and later adopt `db push`, reconcile migration history deliberately using the CLI migration tools; do not apply the same migration twice.

## 5. Create the instructor account and allowlist it

In Supabase **Authentication → Users**, create your instructor user with an email and a strong password. Confirm the user through the dashboard's auto-confirm option where available. The website uses email/password sign-in; it has no signup form or emailed magic-link dependency.

Disable public user sign-ups in the project's Auth settings unless another application genuinely requires them. This project does not. Students do not need Auth accounts.

In **SQL Editor**, add your account to the instructor allowlist:

```sql
insert into public.instructors (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_EMAIL@example.org')
on conflict (user_id) do nothing
returning user_id;
```

Expect one returned row for a new instructor. To verify an existing entry:

```sql
select i.user_id, u.email
from public.instructors i
join auth.users u on u.id = i.user_id;
```

A valid Auth login alone is insufficient: an account also needs the allowlist entry, and it can only operate on rooms it owns. Another instructor can be added later. Separate simultaneous classes should use separate `classroomSlug` values and frontend configurations.

## 6. Configure and deploy the Edge Function

One function, **`classroom-api`**, handles room discovery, joining, batch submission, and instructor operations. It uses different authorization for participants and teachers.

Set its permitted browser origins:

```sh
supabase secrets set 'ALLOWED_ORIGINS=https://YOUR_USERNAME.github.io,http://127.0.0.1:4173,http://localhost:4173'
supabase functions deploy classroom-api --no-verify-jwt
```

When updating an existing classroom to protocol 1.0.5, deploy this Edge Function revision before publishing the updated participant page. The unified `buttons-varied` trial variant must be accepted by `shared/validate.js`; an older function rejects its uploads. The existing `trials.data` JSON column has no variant constraint, so this update needs **no database migration**. Previously saved trials and queued uploads using the older button variants remain accepted. Use one frontend version for a live class so differing trial schedules are not mixed in the same lesson.

An origin is **scheme + host + optional port**. It has no repository path or trailing slash. For `https://YOUR_USERNAME.github.io/fitts-lab/`, the origin is `https://YOUR_USERNAME.github.io`. Add your Live Server port separately if it differs from 4173. A custom domain must be added too. After local testing, remove unnecessary development origins.

`verify_jwt = false` is intentional and also recorded in `supabase/config.toml`: students do not send a Supabase user JWT. Authorization is implemented **inside the handler**. Instructor requests are verified through Auth and the allowlist; participant submissions need a valid random credential; restricted RPCs are service-role only. Do not replace the handler with an unauthenticated insert endpoint.

The function first uses an optional `SERVER_SECRET_KEY`, then the current hosted runtime's injected `SUPABASE_SECRET_KEYS.default`, then the legacy injected service-role key as a compatibility fallback. Normally you do not need to copy a server secret anywhere.

If the function reports that its environment is incomplete and your runtime does not inject a usable key, configure a dedicated secret in the **Edge Functions secrets** dashboard:

```text
Name:  SERVER_SECRET_KEY
Value: your sb_secret_... key
```

Keep this server secret out of Git, `config.js`, screenshots, exported JSON, and student instructions. Use the secrets dashboard rather than placing the key in shell history. The public website build checks for obvious accidental secret/service-role keys, but that check is not a substitute for handling credentials correctly.

## 7. Fill in the public frontend configuration

Edit **`config.js`**:

```js
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_REPLACE_WITH_YOURS',
  classroomSlug: 'hci',
  apiFunction: 'classroom-api',
  uploadIntervalMs: 1000,
  batchSize: 16,
  instructorPollMs: 5000,
  participantPollMs: 6000,
  maxLocalTrials: 50000
});
```

The slug is a stable classroom name, not a password. The instructor opens a dated session behind that name; everyone continues to use the same public participant address. Existing credentials are scoped to a particular session, so reopening the site for a later class does not mix that class's records with an older room.

Commit and deploy:

```sh
npm run check
npm test
npm run build
git add config.js
git commit -m "Configure classroom backend"
git push
```

The website never needs the Supabase database password, Auth password, or server secret. Public configuration can safely be versioned **only when it contains the publishable key**.

## 8. Verify private Realtime

The migration already installs a receive policy on `realtime.messages`. Only an allowlisted instructor who owns the room may subscribe to `classroom:ROOM_UUID`. Students have no subscription and cannot read other participants' measurements.

In Supabase's Realtime settings, disable public-channel access if the option is available and the project is dedicated to this app. Keep the connection private; opening a public channel to fix a connection error defeats the intended privacy boundary.

This application uses **database Broadcast**, not one Postgres Changes subscription per inserted row. Do not add the trials table to a Postgres Changes publication as a setup step. Each accepted batch is stored as individual trials and emits one custom `realtime.send(...)` notification. If the live connection fails, the instructor page reconciles stored records every five seconds and after reconnection.

The status should eventually read **Live · private broadcast**. If it remains on polling, the data can still arrive, but diagnose the broadcast policy before teaching. Section 12 includes the likely causes.

## 9. Perform the first real rehearsal

On the deployed instructor page, choose **Connect classroom**, sign in, and open a new session. Choose a recognizable title and a capacity slightly above the expected class size. Keep this page on the projection.

Open the participant URL on a **second computer or a different browser profile**. Choose **Join live classroom**, review the sharing notice, confirm, then start a set. Verify all of the following:

1. A participant tile appears and its label matches the student page.
2. Completed attempts appear during the set, and misses are retained.
3. On completion, the student sees the review state and their local charts remain visible.
4. The instructor's Freeze button stops display updates while collection continues; Resume reveals the accumulated data.
5. The same data survives a participant refresh and an instructor refresh. A resumed unfinished set has a fresh unscored starting click.
6. Disconnect the participant briefly, finish a few clicks, reconnect, and confirm the queue drains without duplicate attempts.
7. Another unsigned browser cannot read the class's records or open instructor operations.
8. Escape and pointer-lock permission failure behave correctly in real Safari and Chrome.

The automated **cloud smoke test** complements this rehearsal. Create a local ignored `.env.smoke` file with your instructor credentials, run `node --env-file=.env.smoke scripts/cloud-smoke.mjs`, then remove the file. Instructions and the exact tested actions are in TESTING. It creates and deletes only its own uniquely named test room. It does not replace the two-browser/private-Realtime test.

## Resetting classroom measurements

Use **Session & participant link → Reset data…** to clear the selected session’s classroom trials after confirmation. Export first if you need a copy. The session, participants, and join credentials remain; student-local results and exports are unchanged. New or queued uploads can appear after the reset. Other instructor views clear on the reset notification or the next poll, including frozen views. Local rehearsal supports the same operation.

Existing installations must apply `supabase/migrations/202609280001_reset_classroom.sql` once and redeploy `classroom-api` before publishing this control. This migration adds a room data revision and an owner-checked reset function; applying it does not reset any session.

## 10. Running the class

Before class, check that the hosted project is awake, the site deploy succeeded, and the school's network permits the Edge Function and WebSocket connections. Rehearse in the actual room when possible. Free projects can be paused after inactivity; check the dashboard rather than discovering this during the introduction.

Open a new session, project the instructor page, and give everyone the permanent participant URL. Students need a laptop, desktop browser, and a mouse or trackpad. They do not create accounts, enter codes, or receive individual links.

Students move through stages independently. Measurements from every stage arrive in the same classroom view. Its stage filter only changes the display; it never sends instructions to students. Follow TEACHING for a classroom run sheet.

At the end, export JSON and close the session. New joins stop immediately. Already joined participants have up to ten more minutes to upload buffered data, bounded by the session's 24-hour expiry. Closing is not deleting: data remains available to its owner until explicitly deleted.

Delete old sessions on your chosen retention schedule. Browser-local records and previously downloaded exports are separate copies. See SECURITY for retention and privacy details.

## 11. Capacity and costs

The published Supabase Free Realtime limits checked for this package include 200 concurrent connections, 100 messages/second, and 2 million messages/month. Check the linked current documentation before class; limits and plans can change.

Only the instructor uses a Realtime socket. A student sends compact batches through HTTPS at most once per configured interval while data is queued. The teacher also performs periodic reconciliation; students check whether their session is still open. Those HTTP requests count toward function/database usage even though they are not Realtime messages.

For 40 actively contributing students at one batch/second, plan for roughly 40 batch submissions per second before retries and other traffic. Message accounting may include deliveries to each subscriber. Multiple projected instructor tabs multiply recipients. This architecture is intended for a modest classroom, not a guaranteed free auditorium service.

There is a 24-hour room lifetime, configured room capacity, 4,000-attempt participant limit, 150,000-attempt room limit, bounded request sizes, and a per-participant submission rate check. For larger groups, increase the frontend batch interval first, test with representative traffic, inspect the project's actual usage, and choose a suitable plan. Keeping a Free project does not waive abuse/usage limits.

## 12. Troubleshooting

| Symptom | Check |
|---|---|
| Blank page / module import errors | Serve through HTTP(S), include all of `vendor/`, inspect the console, hard-refresh after deployment. |
| GitHub page returns 404 | Pages source must be GitHub Actions; use the deployment's URL; verify branch `main`, workflow permissions, and a successful deployment. |
| “No backend is configured” | Edit the source `config.js`, commit, deploy, and reload. Editing only `dist/config.js` is overwritten on the next build. |
| CORS / Origin not allowed | `ALLOWED_ORIGINS` needs the exact scheme, host, and port; no repository path or trailing slash. |
| 401 before the handler runs | Ensure `classroom-api` is deployed with `verify_jwt=false`; the app performs custom participant authorization internally. |
| “Backend environment is not configured” | Verify project URL/runtime secrets and nonempty `ALLOWED_ORIGINS`; optionally set `SERVER_SECRET_KEY` in the server secrets dashboard. |
| SQL reports `relation "public.instructors" does not exist` | Step 4 has not completed in the selected project. Apply the **entire** migration file before running the step 5 allowlist statement. |
| Instructor login succeeds but access fails | Confirm the correct Auth UUID is in `public.instructors`; check that the selected room belongs to that account. |
| Database operation failed | Confirm the whole migration was applied once to this project; inspect Edge Function and Postgres logs. Do not loosen RLS as a workaround. |
| Participant tile appears but no measurements | Look at the participant queue status and function logs; verify validation errors, room expiry, and its credential. |
| Data arrives only every five seconds | The snapshot fallback is working. Check private-channel RLS, teacher JWT, Realtime configuration, and classroom firewall. |
| Older data missing after refresh | Confirm same browser profile/origin, private browsing/storage policies, and a fully drained upload queue; instructor snapshots use the stored database. |
| Local rehearsal does not cross tabs | Both pages must have exactly the same origin and browser profile; use the provided `?local=1` link. |
| Pointer Lock fails | Use a foreground desktop tab and a direct Start click. Release Escape and click again. The system cursor works for ordinary targets; simulated hard boundaries require Pointer Lock. |
| Pointer moves differently on machines | OS acceleration, device gain, browser scaling, and hardware vary. Keep comparisons within a participant; label device groups descriptively. |
| An ended room will not accept a queued batch | After the ten-minute grace/24-hour expiry, the queue is retained locally. Export it; it is not silently moved into a new room. |

## References checked for setup

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [API keys and injected server keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Edge Function configuration](https://supabase.com/docs/guides/functions/function-configuration)
- [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)
- [Realtime limits](https://supabase.com/docs/guides/realtime/limits) and [pricing](https://supabase.com/docs/guides/realtime/pricing)

Package documentation checked September 25, 2026. Dashboard labels and service limits may change. Check your project configuration against the steps above when deploying to a new Supabase project.

The session list updates status when a session ends; Ended/Expired sessions remain selectable for reviewing saved results. The status line distinguishes classroom admission from the live connection. A last-checked timestamp and **Sync now** show whether database reconciliation is working. Returning online or to the tab triggers recovery; Freeze affects rendering only.

The production build versions application asset paths by content hash. Publish the complete `dist/` output so HTML, scripts, and styles use the same release even when browsers cache older files.

For repeat runs (1.1.1), redeploy `classroom-api` before the frontend so ingress preserves optional `run_id` and `run_number`. They are stored in the existing trial JSON; no database migration is needed. Older clients and queued records without those fields remain accepted. The legacy room phase field can remain in the database; current clients ignore it.
