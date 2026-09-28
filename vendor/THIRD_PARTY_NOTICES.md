# Locally bundled chart runtime

The static application uses genuine Vega and Vega-Lite, without a CDN or runtime npm install.

- Vega: **6.2.0**, University of Washington Interactive Data Lab; BSD-3-Clause.
- Vega-Lite: **6.4.2**, University of Washington Interactive Data Lab; BSD-3-Clause.
- Vega Embed and related Vega packages (including tooltip/themes): University of Washington Interactive Data Lab; BSD-3-Clause. The embedded wrapper does not expose a standalone version property; no unverified wrapper version is claimed.
- D3 modules: Mike Bostock and contributors; ISC (older component releases may use BSD-3-Clause).

## Provenance

The 14 dependency chunks were copied unchanged from the installed Gradio distribution's `templates/frontend/assets/embed-B7-ttPZ9.js` dependency graph, which already contained the Vega compiler, runtime, embed wrapper, and D3 components. `index.js` is the application's small re-export shim. The Gradio distribution license is included as `GRADIO-APACHE-2.0.txt`. SHA-256 checksums of the copied JavaScript files are in `SHA256SUMS`.

No font files, user notebook contents, or railway data are included. These chunks are opaque upstream build output; edit the readable application specs in `src/specs.js` rather than the minified dependencies. A future maintainer can replace this directory with official compatible browser bundles, retaining upstream dependency licenses and updating the shim and version tests.

Sources and canonical licenses:

- https://github.com/vega/vega/blob/main/LICENSE
- https://github.com/vega/vega-lite/blob/main/LICENSE
- https://github.com/vega/vega-embed/blob/main/LICENSE
- https://github.com/d3/d3/blob/main/LICENSE
- https://github.com/gradio-app/gradio/blob/main/LICENSE

See `LICENSES.txt` for the applicable primary license texts and component notices. Upstream packages retain their original copyrights. This notice describes the included build's provenance; it is not a claim of authorship of third-party code or an independently audited dependency inventory.
