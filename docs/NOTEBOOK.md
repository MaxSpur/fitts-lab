# Reuse one chart in Observable

This is optional follow-on material. The short HCI demonstration does not require students to inspect the code. The application deliberately keeps chart definitions in `src/specs.js`, separate from pointer locking, timing, persistence, and networking.

The supplied railway-data notebook introduces `data`, `mark`, `encoding`, quantitative/nominal types, Arquero grouping, and `params` selections. These examples use the same basic pattern, with the class's own measurements. They do not replace or modify the notebook's railway exercises.

## Fastest route: export exactly what you see

Click a chart's `</>` / **Code** button and download its `.vl.json`. The file contains the specification and the data currently plotted. It is a real Vega-Lite specification, including any named datasets, rather than a screenshot. Open it in Vega Editor deliberately, or attach it to an Observable notebook and render it there.

Be aware that uploading to an external editor or notebook shares the included participant data with that service. The Fitts Lab code button itself does not send data anywhere.

## Start from raw session JSON

Export `fitts-session.json` from the participant site or the classroom's JSON export. Attach it to Observable. Use separate cells:

```js
embed = require("vega-embed@7")
```

```js
session = await FileAttachment("fitts-session.json").json()
```

```js
trials = session.trials.filter(d =>
  d.task === "horizontal" &&
  d.attempt === 1 &&
  !d.practice &&
  d.perturbation === "normal"
)
```

```js
embed({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: 640,
  height: 320,
  data: {values: trials},
  mark: {type: "point", filled: true},
  encoding: {
    x: {
      field: "index_difficulty", type: "quantitative",
      title: "Index of difficulty (bits)"
    },
    y: {
      field: "acquisition_ms", type: "quantitative",
      title: "Acquisition time (ms)"
    },
    color: {field: "hit", type: "nominal", title: "Successful first attempt"},
    tooltip: [
      {field: "participant_label"},
      {field: "distance", type: "quantitative", format: ".1f"},
      {field: "target_w", type: "quantitative", format: ".1f"},
      {field: "acquisition_ms", type: "quantitative", format: ".0f"},
      {field: "hit"}
    ]
  }
})
```

The notebook export contains both older embed/schema references and newer v6 examples. Use a compatible modern embed runtime for these examples rather than copying only the v6 schema line into an older runtime. The application itself pins and vendors Vega 6.2.0 and Vega-Lite 6.4.2. `require("vega-embed@7")` resolves through Observable's package mechanism; classroom use of the application does not depend on it.

## Click to highlight one participant

Add to that specification:

```js
params: [{
  name: "picked",
  select: {type: "point", fields: ["participant_id"], on: "click", clear: "dblclick"}
}]
```

and add an opacity encoding:

```js
opacity: {
  condition: {param: "picked", value: 0.9},
  value: 0.12
}
```

The point selection emphasizes one participant while retaining context. This is a chart interaction, separate from target acquisition in the experiment. In a layered chart, define the selection on a single owning layer to avoid duplicate generated selection signals; see the application’s `heroSpec`.

## An optional Arquero cell

This mirrors the notebook's grouping/rollup approach. Use only successful first attempts for this timing summary, and separately calculate the error rate from all first attempts.

```js
import {aq, op} from "@uwdata/arquero"
```

```js
conditionMeans = aq.from(trials)
  .filter(d => d.hit)
  .groupby("participant_id", "condition", "input_mode", "gain")
  .rollup({
    participant_label: d => op.any(d.participant_label),
    index_difficulty: d => op.mean(d.index_difficulty),
    acquisition_ms: d => op.mean(d.acquisition_ms),
    n: d => op.count()
  })
  .filter(d => d.n >= 3)
  .objects()
```

The exact application aggregation is also available in `conditionMeans()` in `src/math.js`. Keeping it as plain JavaScript avoids making Arquero a required website dependency.

## Two small extensions

**Distance versus difficulty:** duplicate the plot and change only the x field from `index_difficulty` to `distance`. Which grouping caused by target width becomes visible? The instructor site animates this change using a Vega signal and the View API; the simpler pair of plots is enough for an exercise.

**Linked views:** use a point selection to highlight a participant in both a scatterplot and a categorical timing summary, using `hconcat` and shared selection logic. This parallels the supplied notebook's map/matrix linked-view exercise. Keep geometric task and input conditions distinguishable.

## Reusing the actual application specifications

From another static page served in the project, the essential API is:

```js
import {embed} from "./vendor/index.js";
import {scatterSpec} from "./src/specs.js";

const spec = scatterSpec();
spec.datasets = {
  trials: rows.map(d => ({...d, outcome: d.hit ? "Hit" : "Miss"}))
};
await embed(document.querySelector("#chart"), spec, {actions: false});
```

For streaming, embed once and update named data through `view.change(name, vega.changeset()...).runAsync()`, serializing pulses. See `src/charts.js`. A specification alone does not capture the mouse or time movements; those imperative tasks intentionally remain in `src/engine.js`.

Minimal JSON examples are in `examples/basic-scatter.vl.json` and `examples/participant-selection.vl.json`. They expect `fitts-trials.csv` alongside them. The code-viewer export is preferable when you want a self-contained snapshot with embedded values.

References: [Vega-Lite selection parameters](https://vega.github.io/vega-lite/docs/selection.html), [Vega View API](https://vega.github.io/vega/docs/api/view/), [Vega Embed](https://vega.github.io/vega-embed/), and [Arquero aggregation](https://uwdata.github.io/arquero/api/op#aggregate-functions).
