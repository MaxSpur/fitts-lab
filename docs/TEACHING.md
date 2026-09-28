# Classroom run sheet

The exercise is an aside in the introduction to HCI. Keep the measurement mechanics in the background. The central experience is to feel how distance, target geometry, and a hard edge change a click, then see the class's actions become data.

## Before students arrive

Open a new session on `classroom.html`, check a real participant connection, and have the permanent participant URL ready in the slides/chat. Present the instructor window. Guided horizontal, circular, and abstract-button sets default to the system cursor. The matched boundary sets use a captured cursor in Automatic mode; try them on the classroom machines before comparing times. Ask students to use one device throughout. They can select mouse or trackpad; choosing a category is optional and descriptive.

The guided protocol contains 96 selections in each stage (288 total): six sets of 16 for Horizontal and Circles, two sets of 24 ordinary buttons, and four sets of 12 free/edge selections. Each stage therefore has equal selection count, though task difficulty affects duration. Horizontal and Circular each have six conditions with 16 observations per condition. For a short lesson, use only part of the protocol and allow students to finish their current set. Budget additional practice time for a complete run.

## Run sheet

| Time | Action | Prompt |
|---|---|---|
| 0:00–1:00 | Join through the common participant page. Start a set. | “Your label is on the projection. Every measured attempt adds to our dataset.” |
| 1:00–3:00 | Short horizontal sets. Show tiles pulsing. | “What changed when the strip became narrow? Can a farther target still be easy?” |
| 3:00–4:30 | Sample circular sets at different distances and sizes. | “The direction changes. A circle still offers the same diameter along a center-directed approach.” |
| 4:30–7:30 | Follow the varied-button sequence; then try the free menu before its edge-limited match. | “Which button sizes feel easier to acquire, and why?” |
| 7:30–10:30 | Ask students to finish/review. Freeze the projection. Toggle distance → difficulty. | “These are the same clicks. We changed the horizontal variable by including target size.” |
| 10:30–12:00 | Compare completed boundary pairs and connect to dataviz. | “What happens when someone must select a small map feature, a legend entry, or a slider handle?” |

Reserve up to three extra minutes for joining or questions. Do not wait for every student to complete every set before moving the discussion on. Announce transitions at review boundaries. The teacher's phase buttons only recommend the next stage; they never forcibly capture pointers or erase a student's work.

## The explanation to say aloud

**Basic relation:** farther usually takes longer, and a wider target gives more acceptable endpoints. The plotted index combines distance and width. The intercept and slope vary with people, devices, and circumstances.

**At the edge:** the painted button remains small. The cursor constraint absorbs movement beyond an outward boundary. There is still travel time and, for a menu item, horizontal precision. The near/far illustration shows an idealized limit; the class plot treats boundary trials separately.

**For visualizations:** mark design and interaction geometry need to work together. Tiny displayed marks can be hard to select; hit regions, spacing, selection widgets, brushing, and control placement are relevant design decisions. This is a segue, not a requirement to implement the experiment in the course exercises.

## What to keep out of the short demonstration

Keep smooth jitter and gain under Explore. Do not spend class time explaining authentication, curve-fitting procedures, or statistically effective throughput. Do not present a high R² as a target the class must achieve. Avoid ranking students or declaring a mouse/trackpad winner from self-selected groups.

The complete explainer, mathematical qualification, data exports, and optional chart code remain on the participant page for later use.

## Instructor display tips

The participant mosaic has stable positions. A tile pulses when new attempts arrive, and clicking it reveals the latest recorded path. The main chart distinguishes raw first attempts from participant–condition means. Switch between distance and difficulty after collecting several different conditions. In presentation mode, distracting setup elements are hidden.

Freeze stops visual updates while acquisition and synchronization continue. Resume incorporates the newly received records. The first-attempt error indicator is a reminder to interpret speed together with accuracy. The paired boundary chart compares each participant within the matched settings; because the free run always comes first, practice can also influence the difference.

If connectivity fails, let students finish locally and export JSON. The instructor can later import an export as an explicitly disconnected snapshot. Do not present a simulated preview as the class's data; its banner and exports identify it as synthetic.
