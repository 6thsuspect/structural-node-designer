# Calculation Trace

**Feature:** Engineering Calculation Trace (`CalculationTrace`)
**Status:** Implemented — additive feature, existing application unchanged

---

## 1. Purpose

The **Calculation Trace** makes any calculation result transparent and
auditable. Select an output/result node and the application shows the complete
calculation path that produced its value:

```text
INPUT → INTERMEDIATE CALCULATION → FORMULA → DESIGN CHECK → FINAL RESULT
```

The trace is **read-only**: it describes the calculation the existing engine
already performs. It never re-evaluates engineering formulas, never converts
units, never invents code references, and never modifies the graph.

---

## 2. How to open Calculation Trace

Two existing interaction points expose it (both optional integrations):

1. **Node context menu** — right-click any node → `🔎 View Calculation Trace`
2. **Properties panel** — select a node → click the `🔎 Trace` action button

Either opens the Calculation Trace modal for that node.

---

## 3. How to navigate the trace

| Control | Behavior |
|---------|----------|
| **Step header (click / ▶▼)** | Expands or collapses the step (inputs, formula, result, references). The final result and design-check nodes start expanded; intermediate nodes start collapsed. |
| **📍 Locate** | Closes the panel, pans/zooms the canvas to that node and highlights it briefly (2.5 s). The node's data and the graph are not changed. |
| **Search calculation…** | Filters steps by node name, node type, formula, input/output names and code reference. Selecting a result expands and scrolls to the step. Non-matching steps are dimmed. |
| **Basic / Detailed / Audit** | Trace levels. *Basic* = name + result. *Detailed* (default) = inputs, formula, evaluated formula, result, reference. *Audit* = Detailed + node ID, node type, depth, upstream/downstream dependency list. |
| **⬇ Export Trace** | Downloads a print-friendly Markdown document (`calculation-trace.md`) using the same Markdown + Blob pattern as the existing Report feature. |
| **ESC / ✕** | Closes the panel. |

### What each step shows

* **Node information** — name, category, type (audit: node ID)
* **Inputs** — name, value, unit, and source node (`← from …`) or `(input)`
* **Formula** — the node's documented formula (from its existing description),
  plus the evaluated formula with the current values substituted in
* **Result** — every output with value and unit
* **Status** — existing `PASS ✓ / FAIL ✗ / SAFE / OK / …` status strings
* **Reference** — code references already present in the node description
  (e.g. `IS 800`, `IS 456`, `IS 875-3`) — never invented

---

## 4. Supported node types

All existing node categories are supported: Inputs, Math, Logic (including the
Design Check node), Section, Steel, RCC, Loads, Bridge, Materials, Excel and
Outputs.

* **Built-in nodes** — formulas come from the existing description-based
  extraction (`extractOutputFormulas`).
* **Custom nodes** (Quick Formula, Advanced, Code) — formulas come from the
  custom-node definitions via a read-only formula provider. When a custom node
  does not expose a formula, the trace shows `Formula: Not available — Source:
  Custom Node` instead of guessing.
* **Non-calculation nodes** (Display, Pass/Fail) — shown without a formula or
  result where they produce none.

---

## 5. Ordering and traversal

* Upstream dependencies are found by traversing the **existing** connection
  list backwards from the selected node.
* Ordering reuses the engine's existing **topological sort**
  (`topologicalSort` in `src/engine.ts`) — upstream nodes always appear before
  downstream calculations.
* Reused nodes (diamond branches) appear exactly once, with their dependency
  relationships preserved.
* **Circular dependencies** (only possible via imported project files — the
  editor blocks them at connection time) are flagged with the engine's
  existing detection and the trace shows where it can no longer continue.

---

## 6. Implementation notes (integration points)

The feature lives in an isolated, removable module:

```text
src/features/calculation-trace/
├── components/   (panel, step, header, search)
├── hooks/        (useCalculationTrace — on-demand, memoized)
├── services/     (calculationTraceService — pure, testable)
├── types/        (read-only trace model)
├── tests/        (node:test suite)
└── index.ts
```

Existing files changed (all additive, all documented):

| File | Change | Why |
|------|--------|-----|
| `src/App.tsx` | Trace state + handlers + panel render + 2 props passed down | Wires the feature into the app |
| `src/components/NodeCanvas.tsx` | Optional `onViewTrace` / `focusTarget` props, one context-menu item, pan + temporary highlight | Entry point + "Locate" behavior |
| `src/components/PropertiesPanel.tsx` | Optional `onViewTrace` prop + one action button | Second entry point |
| `src/engine.ts` | Bug fix in `detectCircularReferences` (see below) | The trace reuses the engine's cycle detection; the old implementation could never report a cycle |
| `package.json` | Added `test` script | Runs the new tests with Node's built-in runner (no new dependencies) |

**`engine.ts` bug fix (required, minimal):** `detectCircularReferences`
compared `topologicalSort(...).length !== nodes.length`, but
`topologicalSort` returns *all* node ids (sorted prefix + remainder), so the
check was always `false`. The fix reuses the same `topologicalSort` output and
reports a cycle when the returned order violates any connection edge. The
function was previously unused by the application; no other behavior changed.

No new npm dependencies were added.

---

## 7. Known limitations

* The trace lists steps in a flat, dependency-ordered timeline (a graphical
  tree view is out of scope for a large graph — see the PRD's
  "tree/list representation" allowance).
* Code references are only shown when already present in a node's description.
* Formulas are shown when the node definition documents them or the custom-node
  definition exposes them; otherwise "Not available".
* Extremely large traces (>60 steps) are still rendered, but step bodies are
  lazy (only expanded steps render their body) — no virtualization yet.
* Export is Markdown (the existing report infrastructure's format). PDF/HTML
  export can reuse this Markdown output in a future task.

---

## 8. Testing

```bash
npm test
```

Compiles the feature + its existing dependencies with the project's
`typescript` devDependency and runs Node's built-in test runner. Covers:
single node, linear chain, branching, multiple branches, formula node, unit
values, missing formula, circular dependency, custom nodes, and regression
(existing calculation results byte-identical after tracing).
