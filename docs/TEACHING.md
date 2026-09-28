# Classroom run sheet

The exercise is an aside in the introduction to HCI. Keep the measurement mechanics in the background. The central experience is to feel how distance, target geometry, and a hard edge change a click, then see the class's actions become data.

## Before students arrive

Open a new session on `classroom.html`, check a real participant connection, and have the permanent participant URL ready in the slides/chat. Present the instructor window. Guided horizontal and circular sets default to the system cursor. The matched boundary sets use a captured cursor in Automatic mode; try them on the classroom machines before comparing times. Ask students to use one device throughout. Device selection is omitted. Use a mouse or trackpad; touch and pen trajectories are not supported.

The guided protocol contains four sets of eight in Horizontal and Circles (32 each), and five sets of eight in Interfaces (40): 104 selections total. Horizontal and Circles each use four sizes with four travel distances occurring twice per size. Interfaces starts with eight random ordinary buttons, then mixes buttons with controls in two matched free/edge pairs. All sets use eight selections; duration varies with difficulty. These short runs are teaching samples; use class aggregates or repeat runs for more observations, and allow practice before comparing timings.

## Run sheet

| Time | Action | Prompt |
|---|---|---|
| 0:00–1:00 | Join through the common participant page. Start a set. | “Your label is on the projection. Every measured attempt adds to our dataset.” |
| 1:00–3:00 | Short horizontal sets. Show incoming results in the activity list. | “What changed when the strip became narrow? Can a farther target still be easy?” |
| 3:00–4:30 | Sample circular sets at different distances and sizes. | “The direction changes. A circle still offers the same diameter along a center-directed approach.” |
| 4:30–7:30 | Follow the varied-button sequence; then try the free menu before its edge-limited match. | “Which button sizes feel easier to acquire, and why?” |
| 7:30–10:30 | Ask students to finish/review. Freeze the projection. Compare distance → size → difficulty. | “These are the same clicks. We changed the horizontal variable by including target size.” |
| 10:30–12:00 | Compare completed boundary pairs and connect to dataviz. | “What happens when someone must select a small map feature, a legend entry, or a slider handle?” |

Reserve up to three extra minutes for joining or questions. Do not wait for every student to complete every set before moving the discussion on. Announce transitions at review boundaries. Students move through the stages independently. All stages feed the same classroom view; instructor filters only change what is displayed.

## The explanation to say aloud

**Basic relation:** farther usually takes longer, and a wider target gives more acceptable endpoints. The plotted index combines distance and width. The intercept and slope vary with people, devices, and circumstances.

**At the edge:** the painted button remains small. The cursor constraint absorbs movement beyond an outward boundary. There is still travel time and, for a menu item, horizontal precision. The near/far illustration shows an idealized limit; the class plot treats boundary trials separately.

**For visualizations:** mark design and interaction geometry need to work together. Tiny displayed marks can be hard to select; hit regions, spacing, selection widgets, brushing, and control placement are relevant design decisions. This is a segue, not a requirement to implement the experiment in the course exercises.

## What to keep out of the short demonstration

Keep smooth jitter and gain under Explore. Do not spend class time explaining authentication, curve-fitting procedures, or statistically effective throughput. Do not present a high R² as a target the class must achieve. Avoid ranking students or declaring a mouse/trackpad winner from self-selected groups.

The complete explainer, mathematical qualification, data exports, and optional chart code remain on the participant page for later use.

## Instructor display tips

The Class activity sidebar shows runs with successful selections in each stage, each run’s selection counts, and its latest received attempt. Rows remain in arrival order and pulse when data arrives. Select a run for its median successful first-attempt time, miss rate, and latest path; Show all clears the highlight. Joined students without results appear below. Counts describe received data, not online presence or completed guided runs. Sidebar counts include all stages and pointer conditions even when the main plot is filtered. The main chart distinguishes raw first attempts from participant–condition means. Switch between distance, size, and difficulty after collecting several different conditions. In presentation mode, distracting setup elements are hidden.

Freeze stops visual updates while acquisition and synchronization continue. Resume incorporates the newly received records. The first-attempt error indicator is a reminder to interpret speed together with accuracy. The paired boundary chart compares each participant within the matched settings; because the free run always comes first, practice can also influence the difference.

If connectivity fails, let students finish locally and export JSON. The instructor can later import an export as an explicitly disconnected snapshot. Do not present a simulated preview as the class's data; its banner and exports identify it as synthetic.

Students who finish all stages can choose **Start another run**. The classroom shows another run row under the same student label and color. Use the participant Run selector to review earlier work; repeats never erase it.
