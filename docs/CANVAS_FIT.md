# Canvas "Zoom to Fit" Feature

**Status:** Implemented (additive feature) — pure math module + tests in `src/features/canvas-fit/`.

---

## 1. Purpose

When the user clicks the **"⊞ Fit"** button in the toolbar, the canvas automatically
zooms and pans so that **all nodes on the canvas are visible within the available
window** and appear **centered** — regardless of how far apart the nodes are or how
far any individual node sits from the others (including far into negative
coordinates).

**Before this change** the button reset the view to `zoom = 1, pan = (0, 0)` — a
"reset to origin", not a fit. If nodes were scattered far from the origin, the reset
could leave most of them off-screen.

> No formulas, calculation logic, node behavior, or UI beyond the button's action
> were changed.

---

## 2. How it works

```
Toolbar "⊞ Fit" click
    │
    ▼
App: setFitSignal(t => t + 1)                      ← request token (same pattern
    │                                                as trace "focus on canvas")
    ▼
NodeCanvas useEffect on fitSignal
    │  bounds = computeContentBounds(nodes)        ← padded union of all node rects
    │  view   = computeFitView(bounds, vw, vh)     ← zoom + pan that centers it
    │  onZoomChange(view.zoom)                      (existing props — no new view state)
    │  onPanChange(view.panX, view.panY)
    ▼
Canvas zooms/pans so the whole content is visible and centered
```

**Math (pure, DOM-free, in `src/features/canvas-fit/canvasFit.ts`):**

1. **Content bounds** — the union of every node's rectangle
   `(x, y, x+width, y+height)`, padded by 32 canvas units on each side
   (the same margin used for node highlight boxes).
2. **Zoom** — `zoom = min(viewportWidth / bounds.width, viewportHeight / bounds.height)`,
   clamped to the app's existing zoom limits (0.1 – 5, the same range scroll-zoom
   uses).
3. **Pan** — places the padded content box's center at the viewport's center:
   `panX = (vw − bounds.width·zoom)/2 − bounds.x·zoom` (same for Y).

---

## 3. Behavior & edge cases

| Situation | Behavior |
|-----------|----------|
| Nodes scattered across a huge area (e.g. 10,000 px apart) | Zooms out (to the 0.1 minimum if needed) and centers the group — everything as visible as the limits allow |
| Single small node | Zooms in up to 5× and centers it |
| Nodes far into negative coordinates | Fits correctly (bounds handle negative coordinates) |
| Empty canvas | No-op — the current view is kept (nothing to fit) |
| Content larger than min-zoom can show | The content's **center** is placed in the viewport center at zoom 0.1 (closest allowed zoom). A 0.1 view shows ~8000 canvas px across an 800 px window — realistic engineering canvases fit entirely |
| Repeated clicks | Each click re-fits (idempotent — the second click is a no-op if already fitted) |

The fit is a one-shot view change: it does not create a persistent "fit mode",
does not touch node positions, and the user can immediately zoom/pan away as
usual (scroll wheel, Alt+drag).

---

## 4. Files changed

### New files

| File | Purpose |
|------|---------|
| `src/features/canvas-fit/canvasFit.ts` | Pure math: `computeContentBounds(nodes, padding)` and `computeFitView(bounds, vw, vh, options)` — no DOM, no React |
| `src/features/canvas-fit/index.ts` | Barrel export |
| `src/features/canvas-fit/tests/canvasFit.test.ts` | 8 node:test cases (bounds math, zoom/pan math, clamping both directions, centering incl. negative quadrant, empty/zero-size guards, custom min/max options) |

### Modified files (minimal, additive)

| File | Change | Reason | Risk |
|------|--------|--------|------|
| `src/components/NodeCanvas.tsx` | New optional prop `fitSignal?: number` + effect applying the fit via the existing `onZoomChange`/`onPanChange` props (mirrors the existing `focusTarget` token pattern) | Applies the fit where the viewport size is measurable (the SVG element) | Zero when prop absent (effect skips falsy tokens) |
| `src/App.tsx` | `fitSignal` state; Toolbar `onZoomFit` now sends the token instead of `setZoom(1); setPan(0,0)`; passes the prop to `NodeCanvas` | Connects the existing toolbar button to the new behavior | Only the button's handler changed; all other handlers untouched |
| `tsconfig.feature-tests.json` | Added the canvas-fit test directory | Test build coverage | Test-only |
| `package.json` | `test` script also runs the compiled `canvasFit.test.js` | Test execution | Test-only |

No calculation code, node definitions, engine, formula parser, save/load, reports,
themes, or units were touched.

---

## 5. Known limitation (documented)

The fit respects the app's **existing zoom limits (0.1–5)** — the same limits the
scroll wheel uses — so the feature introduces no competing zoom system. Content
wider than ~8000 canvas px (viewport width ÷ 0.1) cannot be shown fully; in that
case the view centers the content at the closest allowed zoom (0.1). This matches
the app's zoom model and all realistic engineering canvases.
