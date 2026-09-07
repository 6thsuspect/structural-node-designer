# Alignment Snap (Smart Guides) Feature

**Status:** Implemented — toggle in the toolbar + snap engine in `src/components/NodeCanvas.tsx`.

---

## 1. Purpose

When the **"🧲 Snap"** toggle (right of **"⊞ Fit"** in the toolbar) is **on**, dragging a
node snaps its position to the **nearest other node's box** — left / horizontal-center /
right edges (vertical guides) and top / vertical-middle / bottom edges (horizontal
guides) — so nodes land in **true horizontal and vertical alignment**. Pink dotted
guide lines
appear along each active alignment, spanning the dragged node and every node sharing it.

When the toggle is **off** (default), dragging is free-form with no snapping or guides.

---

## 2. How it works

```
Toolbar "🧲 Snap" toggle (accent-filled when on)
    │
    ▼
App: snapEnabled state ──► NodeCanvas prop
    │
    ▼  (while a node drag is in progress)
computeSnapGuides(target, draggedNode, allNodes, zoom)
    │  finds the smallest same-kind edge/center offset per axis (≤ 6 screen px)
    │  snapped target = raw target + offset; guides span all matching nodes
    ▼
Single drag → onMoveNode(snapped); multi/group drag → whole set follows the
primary node's snapped delta. Guides clear on mouse-up / toggle-off.
```

---

## 3. Behavior notes

- **Nodes only** — shape drags are unaffected.
- **Multi-selection / grouped drags** snap from the grabbed (primary) node; the rest
  of the set keeps its relative offsets.
- Snapping is **view-only assistance**: it only adjusts the drop position, never the
  calculation engine, connections, or saved data.
- Guide color is fixed pink (`#ec4899`) so it reads on all four themes; line width
  scales as `1 / zoom` for a constant on-screen thickness.

---

## 4. Modified files

| File | Change |
|------|--------|
| `src/components/Toolbar.tsx` | `snapEnabled` / `onToggleSnap` props; **🧲 Snap** toggle right of **⊞ Fit** (accent-filled when active) |
| `src/App.tsx` | `snapEnabled` state (default off), wired to toolbar + canvas |
| `src/components/NodeCanvas.tsx` | `snapEnabled` prop; `computeSnapGuides` engine; live guide state + rendering; cleared on mouse-up / toggle-off |
