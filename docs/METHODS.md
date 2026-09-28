# What this experiment measures

Fitts Lab is a browser-based teaching illustration, not an ISO-conformant device evaluation or a controlled study. Its geometry, event convention, filtering, and limitations are explicit so that the exported records can be inspected or reanalyzed.

## Clicks and time

All target activation uses the **primary mouse-button press** (`mousedown`, button 0). This is consistent across strips, circles, buttons, and simulated corners. Mouse release and hover do not acquire targets. Chart tooltips can use hover; they are outside the measured interaction.

`acquisition_ms` is the elapsed monotonic browser time from target activation until that press. It includes reaction to the cue, movement, and any correction before the press. It is not an independently detected movement-onset-to-end duration. Display refresh, event delivery, input devices, and browser timing can affect it. The measurement engine uses `performance.now()`, not server arrival timestamps.

The first starting-marker or starting-button click is unscored. Guided horizontal, circular, and all interface sequences continue directly from each successful target to the next. In custom horizontal sets, each four-selection block starts from a new unscored marker.

A miss is saved with `hit=false`, its actual endpoint, and `attempt=1` or a later attempt number. The target remains active. A retry shares its `movement_id` and original activation timestamp; therefore a later attempt's time is **cumulative from target activation**, not the time since the previous miss. A successful retry's `completion_ms` contains the total completion time. Do not sum successive retries' durations.

Only a completed press creates a trial row. Escape, P, loss of Pointer Lock, backgrounding, focus loss, or resizing interrupts the unfinished movement. Already completed attempts remain in history. The set log records an interruption; resumption uses a new unscored starting click. Partial movement paths at interruption are not exported as successful attempts.

No observation is removed simply for exceeding two seconds. The server accepts a completed trial up to ten minutes as an abuse/validation bound, rather than a scientific outlier cutoff. Long interruptions should use Pause. The browser retains local records even if the server rejects an invalid/out-of-range submission.

## Coordinate systems and target geometry

The internal arena is 960 × 460 logical units. It scales with its displayed width, preserving aspect ratio. On desktop layouts, its size is also capped by window height to leave room for the three live movement plots. Starting a set preserves scroll position when the stage is visible; otherwise it makes the smallest scroll needed, including the plots when the whole workspace fits. Exported geometry is converted to **CSS pixels in the arena**. It is not a physical millimeter calibration. `dpr` records the device-pixel ratio, and `viewport_width` is the displayed arena width. Retina backing pixels do not change D/W by themselves.

`distance` is the straight-line distance from the actual activation/start point to the target center. `nominal_distance` is the planned center-to-center distance from the current source target. A participant's off-center prior click can make the two differ.

The horizontal task projects selection coordinates onto the horizontal centerline; strips are visually tall. In each guided set, width stays fixed while the next target appears at a seeded position and designed distance from the previous target. A successful click starts the next movement at the actual click point. Custom exploration instead keeps one selected distance and width in two four-selection blocks. A new block's first click is unscored, so repositioning the pair is not treated as a measured movement. In captured mode vertical deltas are ignored; in system-cursor mode absolute browser positions are projected onto the line.

The circular protocol displays sixteen evenly spaced targets on one ring. A seeded path visits nine distinct targets (one start and eight measured selections), changing direction and connection length. Distances are actual chords between successive positions, not arc lengths and not silently the ring diameter. Circle width is its diameter for the center-directed model.

For a rectangle with width w, height h and approach vector (dx,dy), the center-directed chord is:

```text
d = sqrt(dx² + dy²)
W_parallel = min(w*d/|dx|, h*d/|dy|)
```

A zero directional component imposes no constraint in that term. Horizontal and vertical approaches give w and h respectively. This geometric chord is an explicit approximation for ordinary 2D targets. It is different from projected bounding-box width and from statistically effective width inferred from endpoint variance. There is no claim that it is a universal 2D Fitts model.

## Default conditions

Horizontal and Circles each have four sets of eight scored selections (32 each). Interfaces has five sets of eight (40): 104 selections in a complete run. Starting clicks and retries are additional. All guided sets continue from the last successful click without homing.

Horizontal: one set at each width of 20, 32, 48, and 64 logical units, in seeded order. Designed distances 120, 240, 360, and 480 occur twice per width, with no adjacent repeated distance. Positions vary across the strip. Custom exploration uses eight selections in two four-selection blocks.

Circles: the same four target diameters, one set each, on a ring of diameter 360. Each set uses sixteen visible sites. Randomized connections span 1, 3, 5, or 7 ring steps in either direction, twice each: travel chords of approximately 70, 200, 299, and 353 logical units. No target is revisited within a set, and no connection is diametrically opposite. Distance and width remain balanced while connection order and direction vary. These are randomized pointing sequences, not a standardized reciprocal tapping test.

Interfaces begins with eight ordinary-button selections: four sizes (64 × 28, 88 × 32, 112 × 36, and 144 × 44 logical units) occur twice each at seeded positions. Four sets follow: menu free, menu edge, window free, and window edges. Each starts with one unscored ordinary button, followed by four control approaches and four selections of ordinary buttons. Sizes and positions vary within each set; these are exploratory UI comparisons rather than four fixed-size conditions.

The paired free/edge runs share target sequence and boundary frame. Menu pairs compare a free target with a hard top edge; window pairs add hard top and left edges. The free run always comes first, so practice or fatigue can influence the apparent difference. Automatic cursor mode uses captured input on both sides. A selected system cursor on a free side makes those observations exploratory rather than directly matched. Wide/tall buttons remain available in Explore.

Width/height/distance exploration creates separately named conditions. In the interface explorer, width and height are editable; distance follows the seeded target sequence. Jitter and gain settings are recorded and kept distinguishable. Mixing settings remains exploratory.

## Pointer confinement

Pointer Lock hides the system cursor and supplies relative motion; the application draws a virtual cursor. Each movement delta is applied, immediately clamped, and excess motion discarded. Reversing direction moves the cursor away from an edge immediately; there is no invisible overshoot debt.

In guided boundary sets the simulated top edge lies between logical y=64 and y=88. The window-control pair also places its left edge between x=88 and x=120. This frame stays fixed during each set, so activating a new target never shifts the cursor constraint. Ordinary conditions allow the pointer to cross the displayed edge lines. All conditions remain within the overall canvas. Edge and corner target hit tests include the boundary itself. Custom Explore boundary settings retain the chosen control width and height.

Pointer Lock is requested synchronously from a Start/Resume click. Both promise and event-based behavior are handled. Escape/P releases or pauses. The application does not request raw `unadjustedMovement`, so it uses the browser's default relative input behavior, with operating-system acceleration normally retained. Relative units and acceleration should still be checked on the actual browsers/devices.

Guided horizontal, circular, and ordinary-button sets default to the system cursor. The cursor selector can start a new set in captured mode; earlier attempts remain in history. Automatic mode uses captured input on both sides of guided menu/window pairs so the free and bounded cases share an input path. Hard-boundary conditions require captured input. During captured movement, the virtual cursor is positioned directly from mouse events. A separate low-resolution transparent Canvas draws the live path at up to about 30 frames per second without repainting the main arena. The last completed path remains visible after a successful click. This reduces application-side work but cannot remove latency introduced by a browser's Pointer Lock implementation. Test the actual classroom browser and pointing devices before interpreting captured timing. Smooth bounded jitter is an optional sinusoidal two-frequency offset, defined as a function of time, not event count; its displayed cursor position is also the hit-test point. It is an illustration of an unsteady pointer, not a clinical impairment model. Gain is a scalar on relative input, not a replacement OS acceleration curve. The first relative movement event after lock is ignored only if it is an implausibly large cursor-warp delta.

## Equations and the boundary limit

The Method editor is an unrecorded 2D rectangle. Dragging moves it horizontally and vertically; four edge handles and a corner handle resize it. Dimensions appear inside the rectangle. Difficulty uses the same center-directed chord as the experiment. Arrow keys adjust the focused target or handle by 2 illustration units (Shift: 20); Escape cancels an active drag. The extension option fixes the near intersection on the approach line and lets the far intersection tend to infinity. It preserves the finite rectangle for restoration. All three formulations and their live values remain visible.

The logarithm can be motivated by a halving analogy: reducing a region from L to W in k binary steps gives L/2^k = W, hence k = log2(L/W). This is an intuition, not a derived motor mechanism. The index and its approximately linear relationship with observed time are model choices evaluated against data.

Ordinary-target charts use Shannon difficulty:

```text
ID = log2(1 + D/W)
T = a + b*ID
```

The coefficients are fitted descriptions of these observations. Their numerical values are not human constants. For an interval extending from d_near to d_far:

```text
D = (d_near + d_far)/2
W = d_far - d_near
Original Fitts: log2(2D/W) = log2((d_far+d_near)/(d_far-d_near))
Welford:       log2(D/W+1/2) = log2(d_far/(d_far-d_near))
```

Holding the near edge fixed while the far edge tends to infinity gives zero for the original and Welford difficulty terms. Under that same interval construction, Shannon difficulty tends to log2(1.5). These are distinct formulations; the page displays both limits. A zero index term does not mean zero movement time or physical effort.

This limit illustrates the disappearance of the far-end stopping-precision constraint. It is not a complete travel-time law for an unbounded target. A real pointer still travels, a menu needs precision along the edge, and a corner changes the control geometry. Hard-edge/corner records therefore have `index_difficulty=null` and are excluded from the ordinary Fitts plot.

## Charts and summaries

Miniatures show paths (the latest 12 attempts), speed (the latest six), and every click endpoint in the selected set. Path coordinates are rotated into the start-to-target frame; longitudinal position is normalized so that target center is at 1, while lateral deviation stays in CSS pixels. Endpoint coordinates are normalized independently by target half-width and half-height. Misses remain visible; the endpoint extent expands for distant misses.

Speed is a descriptive estimate from successive retained path samples. Paths are downsampled for storage/export and upload. It is not a calibrated instantaneous velocity signal or a clinical motor-control measurement. Uploaded paths contain at most 40 samples; local records at most 120.

The main statistical views use first attempts and exclude practice-tagged records. Misses remain visible as separate outcomes. Means and regressions use successful first attempts, with errors shown alongside; a fast condition with a high miss rate should not be judged by its successful timings alone.

The time-versus-difficulty plots for Horizontal, Circles, and free interface targets show descriptive ordinary least squares trendlines through successful first attempts. Each line requires at least eight successful first attempts and an observed difficulty span of at least 0.5 bits (or 40 CSS pixels on Distance, 8 CSS pixels on Size). Horizontal and Circular fits also require at least two planned conditions with two successful observations each. Interface targets vary in both size and distance. Lines stop at the observed range; no trials are removed just for being slow. Equations, sample sizes, and R² describe the successful observations, with misses displayed separately.

Input mode, device, gain, perturbation, jitter amplitude, task, and application version define separate fit groups. Classroom lines pool successful first attempts within each group, so participants contributing more trials have more weight. Larger student–run–condition mean markers still require at least three successful observations. These lines are descriptive; they do not estimate a causal effect or account for repeated measurements with a mixed-effects model.

Horizontal and Circular each have sixteen planned distance–width combinations, with two observations per combination before misses. The combined view uses square, circle, and diamond glyphs for Horizontal, Circles, and Interfaces. Classroom color identifies the participant and matches the student-run rows; selecting one dims others. Hollow glyphs indicate misses. Fits remain separate by stage and input settings (solid Horizontal, dashed Circles, dotted Interfaces). Free interface selections appear in the combined view. Hard-edge sets remain in the adjacent paired chart because hard edges have no scalar index of difficulty. The Stage legend shows point glyphs; the separate Trendline legend shows the line styles.

A fixed nominal distance gets no distance-axis trend from off-center click variation alone. Trajectory, speed, and landing plots retain their measured traces and target references.

Classroom raw marks are deterministically sampled to 5,000 if needed for display speed; all records remain stored/exportable, and means/fits use the full selected dataset. The time axis only expands as larger values arrive; data is not silently discarded to fit a fixed range. Distance, Size, and Difficulty show the same observations on three axes. Size uses `approach_width`: diameter for circles, width along the approach for rectangles. Distance and Size fits are descriptive single-variable summaries; the other geometric variable is not held fixed. Axis limits follow the data. Fits are recomputed for the selected variable, including while the view is frozen.

The boundary chart connects each student run within a matched pair, protocol version, and consistent input settings. Only approaches to menu or window controls enter this comparison; the intervening button selections remain in the exported data, and those from free sets also appear in the combined plot. A bold summary line averages the run means from complete free/edge pairs, with equal weight per complete run and separate protocol/input groups. Its timing statistic is the mean of successful first attempts; point tooltips report the corresponding first-attempt error rate and sample size. It is a paired visualization, not an inferential effect estimate. No throughput is calculated from clamped endpoint variance.

## Interpretation across people

Different people, devices, scaling settings, posture, practice, and strategies produce different intercepts and slopes. Device selection has been removed. New sets use the existing `unspecified` category; earlier self-reports remain descriptive and keep their separate fit groups. Touch and pen trajectories are not supported. CSS pixels and an invariant D/W ratio do not equalize physical motor demands. Browser animation/event load can also affect responsiveness. A short live class can illustrate a relationship, its variability, and the edge effect without claiming to establish a hardware ranking or precise universal constants.

## Primary and implementation references

- Fitts, P. M. (1954). *The information capacity of the human motor system in controlling the amplitude of movement.* Journal of Experimental Psychology, 47, 381–391. DOI: [10.1037/h0055392](https://doi.org/10.1037/h0055392).
- MacKenzie, I. S. (2013). [Fitts' law / formulations and historical development](https://www.yorku.ca/mack/ojas2013.html).
- MacKenzie, I. S., & Buxton, W. (1992). [Extending Fitts' law to two-dimensional tasks](https://www.yorku.ca/mack/CHI92.html).
- Soukoreff, R. W., & MacKenzie, I. S. (2004). [Towards a standard for pointing device evaluation](https://www.yorku.ca/mack/ijhcs2004.pdf).
- [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), [requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock), and [performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now).
- [Vega View API](https://vega.github.io/vega/docs/api/view/) and [Vega-Lite selections](https://vega.github.io/vega-lite/docs/selection.html).

## Repeating the exercise

Completing each guided set in all three stages enables **Start another run**. Progress starts over with a new run ID and layout seed; existing trials, exports, pending uploads, and classroom membership remain intact. Classroom colors still identify students, while activity rows and selection distinguish runs. The participant Run selector can display a single run or all saved runs.

Condition means and boundary pairs are computed within a run. Classroom regressions still pool observations within protocol/input groups: students who repeat contribute more observations. Repeats are not additional independent students. Records made before run IDs were added appear as Earlier results.
