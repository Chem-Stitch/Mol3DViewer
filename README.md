# Mol3DViewer

**Interactive 3D molecular visualization and figure preparation from XYZ coordinates.**

Mol3DViewer is a browser-based tool for inspecting molecular geometries and
preparing ball-and-stick figures. Paste coordinates, adjust the appearance,
edit bonds, measure molecular geometry, and export a high-resolution PNG.
Dashed bonds make it convenient to illustrate forming and breaking bonds in
transition-state structures and reaction mechanisms.

Rendering is powered by [3Dmol.js](https://github.com/3dmol/3Dmol.js).
Coordinates and session files are processed locally in your browser; no
account, Python environment, or server-side calculation is required.

## Features

- **Live coordinate input:** paste a standard XYZ file or coordinate rows;
  the structure updates automatically. Ångström and Bohr input are supported.
- **Interactive viewing:** rotate, zoom, pan, switch between orthographic and
  perspective projection, and use preset viewing directions.
- **Customizable appearance:** adjust atom size, element colors, bond color
  and thickness, background color, and ambient occlusion (AO).
- **Explicit bond editing:** add, change, or remove single, double, triple,
  and dashed bonds. Customize dash thickness, length, spacing, and color;
  edit pairs individually or in batches and undo recent bond edits.
- **Geometry measurements:** select two atoms for a distance, three for a
  bond angle, or four for a signed dihedral angle.
- **Atom indices:** toggle labels and choose 0-based or 1-based numbering.
  Labels are drawn at the display or export resolution.
- **Figure export:** save transparent or opaque PNGs with a long edge of
  1200, 2400, or 3600 pixels while retaining the current view and aspect ratio.
- **Trajectories and sessions:** inspect multi-frame XYZ files and save
  coordinates, bonds, style settings, and camera view in a JSON session.

## Quick start

1. Open the viewer and paste coordinates into **Structure → Coordinates**,
   or use **Open file** to load an XYZ file.
2. Select the input units if necessary. File-based XYZ input is read in
   ångström; pasted coordinates can be interpreted as ångström or Bohr.
3. Rotate the structure and adjust its appearance in **Style**.
4. Use **Bonds** to edit connectivity or mark selected pairs as **Dashed / TS**.
5. Choose **Export PNG** to save the figure, or **Save session** to continue
   editing later.

The viewer starts empty. Clearing the coordinate field also clears the
structure. During an incomplete or invalid edit, the last valid structure
remains visible and saving/exporting is disabled until the input is valid.
Edits that retain the same atom count and element order preserve the current
bonds and camera view. Use **Auto-detect** to infer bonds again when needed.

### Example input

```text
3
Water, coordinates in angstrom
O  0.000000  0.000000  0.000000
H  0.957200  0.000000  0.000000
H -0.239987  0.927297  0.000000
```

The atom-count and comment lines may be omitted when pasting coordinate rows.
Fortran-style `D` exponents are accepted. Multi-frame XYZ files must retain
the same atom count and element order in every frame. Bonds stay fixed as
you move between frames.

### Mouse and keyboard controls

| Action | Control |
| --- | --- |
| Rotate | Left-button drag |
| Zoom | Mouse wheel / scroll |
| Pan | Right-button drag |
| Select an atom | Left click |
| Clear atom selection and measurements | Right click without dragging |
| Fit the structure to the view | **F** or **Fit to view** |
| Create/remove a bond between two selected atoms | **B** |
| Set a dashed bond between two selected atoms | **D** |

Shortcuts are inactive while typing or while the export dialog is open. **B**
removes an existing bond of any type, or creates a single bond if absent.
**D** creates or replaces the selected pair with a dashed bond. Both support
**Undo edit**. Selection details appear as text at the lower-left of the viewer.

Atoms are measured in selection order: **A–B** for a distance, **A–B–C** for
an angle at B, and **A–B–C–D** for a signed dihedral in the range −180° to
+180°. Click a selected atom to deselect it; clicking a fifth atom starts a
new selection. Indices can also be entered under **Bonds → Geometry
measurements**. Degenerate geometries are reported as undefined.

### Bond definitions

Under **Bonds → Batch edit**, enter pairs using the current numbering scheme:

```text
0-1:2, 1-2:d, 2-3
```

This sets a double bond between atoms 0 and 1, a dashed bond between 1 and 2,
and a single bond between 2 and 3. Use `:3` for a triple bond. Unlisted pairs
are preserved; repeated definitions replace the existing type for that pair.

## Preparing figures

- Start with **orthographic projection** for consistent apparent atom sizes.
- Use **Soft depth** for subtle AO or **Strong depth** for deeper shading;
  **Shadow strength** and **Shadow range** provide further control. **Basic**
  uses standard lighting without the additional AO pass.
- Enable **Atom indices** before export if labels should appear in the PNG.
  Selection-order badges used during editing are excluded from exported images.
- Choose a **transparent background** to place the molecule into a figure
  panel in Illustrator, Inkscape, PowerPoint, or a similar editor.

PNG output is raster, not vector. Choose enough pixels for the final figure
size: for example, a 2400-pixel image placed at 8 inches corresponds to 300 ppi.
Shading settings are included in both session files and PNG export.

## Running locally and hosting

### Portable HTML

Open the root **`index.html`** or the built **`dist/Mol3DViewer.html`** in a
WebGL-enabled browser. Both contain all styles, scripts, and the rendering
library and can run offline. Users only need this one HTML file.

### Development

Use Node.js 22 or later. No npm dependency installation is needed.

```bash
npm run check
npm test
npm run build
```

Edit files in `src/`, then open `src/index.html` directly in a browser and
reload after changes. Keep `vendor/` next to `src/`; the development page
loads its rendering library from there.

| File | Responsibility |
| --- | --- |
| `src/index.html` | UI markup and bundled third-party license notices |
| `src/styles.css` | Layout and appearance |
| `src/core.js` | XYZ parsing, bonds, geometry calculations, session validation |
| `src/scene.js` | WebGL rendering, camera, PNG export |
| `src/labels.js` | Canvas atom labels |
| `src/interaction.js` | Mouse gestures |
| `src/app.js` | Application state, UI events, imports and downloads |
| `vendor/3Dmol.min.js` | Bundled rendering library; version 2.5.5 |
| `scripts/build.mjs` | Assemble the portable HTML without external build dependencies |
| `tests/` | Automated regression tests |

Scripts use classic browser globals and load in the order declared in
`src/index.html`. Core, labels, and interaction also expose CommonJS exports
for tests. Add new scripts to that template in dependency order; the build
inlines its stylesheet and script references automatically.

**Do not edit the root `index.html` or `dist/` directly.** They are generated.
The build updates the tracked root `index.html` and writes identical copies
to `dist/index.html` and `dist/Mol3DViewer.html`. Commit source changes and the
rebuilt root HTML together. `dist/` is ignored by Git.

For GitHub Pages, use **Deploy from a branch**, select your branch and
**`/ (root)`**. The root HTML retains the existing standalone deployment.
Alternatively, publish the contents of `dist/` with your hosting service.
There is no GitHub Actions deployment workflow in this repository.

Before release, run the checks above and open the generated HTML in a
WebGL-enabled browser. Verify coordinate input, bond edits, rotation,
measurements, session save/restore, and transparent PNG export. Automated
core tests do not verify GPU rendering or browser download behavior.

## Scope and data handling

Mol3DViewer is intended for visualization and figure preparation, particularly
for small molecules, coordination complexes, and reaction structures.
It displays supplied coordinates; it does not optimize geometries, locate
transition states, or validate chemical valence. Automatic connectivity uses
distance cutoffs based on approximate covalent radii, then estimates multiple
bonds for supported organic elements using conservative length cutoffs and
neutral valence limits. Multiple-bond candidates cover C–C, C–N, C–O, C–S,
N–N, N–O, and O–O. Competing candidates are assigned together with a bounded
search; simple aromatic rings can receive alternating single/double bonds.
The distance tolerance slider changes connectivity, not multiple-bond cutoffs.

This is a drawing heuristic, not a full aromaticity or charge solver. Explicit
hydrogens improve valence constraints. Charged species, radicals, cumulenes,
hypervalent atoms, fused aromatic systems, and TS structures need manual review.
Unsupported elements (including metals) or connectivity exceeding neutral
valence limits cause the entire structure to retain inferred single bonds,
with a warning. Large/complex candidate regions use a bounded estimate and
report a warning. Existing manual bonds remain until Auto-detect or a new
structure replaces them; trajectory frames keep the initially assigned bonds. Review metal coordination, multiple bonds, and forming/breaking bonds
manually. TS and Pd examples are illustrative rather than optimized structures.

A browser with working WebGL is required for 3D viewing and PNG export.
Performance depends on the device, molecule size, labels, and shading settings.
Input limits are 5000 atoms, 500 frames, 20000 bonds, and 20 MB per file.
See the development section above for the verification scope.

Molecular data are processed in browser memory without being uploaded.
There are no analytics, external fonts, or runtime CDN dependencies. When
using a hosted site, the browser downloads the static application files from
the host. Save a JSON session before closing the page to retain your work.

## References and acknowledgments

**Rendering engine.** Mol3DViewer uses the bundled **3Dmol.js 2.5.5** library.
When using its molecular graphics in scientific work, please acknowledge
3Dmol.js and cite the paper recommended by its authors:

1. Rego, N.; Koes, D. **3Dmol.js: molecular visualization with WebGL.**
   *Bioinformatics* **2015**, *31* (8), 1322–1324.
   [https://doi.org/10.1093/bioinformatics/btu829](https://doi.org/10.1093/bioinformatics/btu829).
2. **3Dmol.js source code and documentation:**
   [GitHub repository](https://github.com/3dmol/3Dmol.js) ·
   [Documentation](https://3dmol.csb.pitt.edu/doc/).

**Inspiration.** The coordinate-paste viewing workflow was inspired by
Weitang Li's [*Online Molecular Viewer based on XYZ Coordinates*](https://liwt31.github.io/2022/01/02/online_viewer/)
(2022). Mol3DViewer's application code was implemented independently;
the blog viewer is acknowledged as a design reference.

## License

Mol3DViewer application code is released under the [MIT License](LICENSE).
The bundled 3Dmol.js library retains its BSD-3-Clause license and accompanying
notices. Third-party license notices are embedded in `src/index.html` and retained
in every generated HTML file.
