# Canvas Shapes Feature

**Status:** Implemented (additive feature) — pure logic modules + tests in `src/features/canvas-shapes/` (and the shape-aware parts of `src/features/node-groups/`).

---

## 1. Purpose

Adds freeform **drawing shapes** to the canvas, separate from the calculation nodes:

1. A **"Shapes" category in the Toolbox node list** with typical shapes
   (Rectangle, Square, Circle, Triangle, Diamond, Hexagon, Text) that you
   **drag and drop** onto the canvas at the drop point (respects zoom/pan).
   Search also matches shapes.
2. **Resize** — drag any corner handle of the selected shape, type exact
   Width/Height in the Properties panel, or use **"Edit dimensions"** from
   the shape right-click menu. **Hold Ctrl while dragging a corner to resize
   in the fixed (original) aspect ratio.**
3. **Freeze** — lock a shape's **size** (right-click → *Freeze size*, or panel
   button). A frozen shape shows a ❄ badge and cannot be resized; moving it
   is still allowed.
4. **Per-item draw order** — every **node and every shape** can be set
   **in front** of (or back to) the default layer:
   - right-click a node/shape → **Bring to front / Send to back**
   - Properties panel → **Draw order** checkbox
   - Layering: *back shapes → wires → default nodes → front items (nodes & shapes)*.
     Front items draw over wires, nodes and other shapes, and catch their clicks.
5. **Fill color + opacity** per shape (Properties panel → Fill).
6. **Mixed groups** — shapes can be grouped **together with nodes**
   (Ctrl+G / right-click → Group): members move together and the group
   bounds include the shapes.
7. **Group outline shown only on hover** — the group's dashed bounding box
   and name appear while the cursor is inside the group, otherwise hidden.
8. **Multi-selection of nodes AND shapes**:
   - **Marquee** (drag on empty canvas) selects every node and shape it
     touches; **all selected items are highlighted** (Shift adds to the selection).
   - **Shift+click** a node toggles it in/out of the selection one by one.
   - **Ctrl+left-drag** a selected node moves the whole node selection
     together (the selection itself is unchanged).
9. **Text annotations** — drag the **Text** item onto the canvas and write
   freely inside its resizable box: **double-click** the box to edit inline
   (Ctrl+Enter or click outside to finish, Esc to cancel), or edit content in
   the Properties panel. Formatting per text box: **font size, color
   (+ Auto theme color), font family, left/center/right alignment, bold,
   italic and underline**. Selected text shows a dashed outline; text
   participates in marquee selection, groups, draw order, undo and save/load
   like any other shape.

Shapes are visual annotations: they do not participate in calculation,
connections, or node port wiring. Everything else (engine, formulas, save/load,
reports) is untouched except the small documented additions below.

---

## 2. How it works

### Toolbox → Canvas

```
"Shapes" category item (draggable, in the same list as node categories)
    │  HTML5 drag  →  dataTransfer 'shapeType'
    ▼
NodeCanvas onDrop (same handler that receives node drops)
    │  screen → canvas coordinates (respects current zoom + pan)
    ▼
useNodeEditor.addShape(type, x, y)   ← selected automatically, undoable
```

### Interaction model

| Action | Effect |
|--------|--------|
| Click a shape | Selects it (group-aware: a grouped shape selects its whole group). Node selection is cleared |
| Drag a shape | Moves it; a grouped shape moves its **whole group** (nodes + shapes) |
| Drag a corner handle | Resizes (min 20×20). **Ctrl held → fixed aspect ratio** |
| Right-click a shape | Menu: **Freeze/Unfreeze size**, **Edit dimensions** (popover with Width/Height), **Bring to front / Send to back**, **Group/Ungroup Selection**, **Delete Shape** |
| Double-click a Text box | Edits the text inline (Ctrl+Enter / click outside to finish, Esc to cancel) |
| Marquee box | Selects all nodes **and shapes** inside; every selected item is highlighted (Shift = additive) |
| **Shift+click** a node | Toggles it (group-aware) in/out of the multi-selection |
| **Ctrl+left-drag** a selected node | Moves the whole node selection together (selection unchanged) |
| Delete key | Deletes the selected shape(s'/node(s)) |
| Properties panel | X/Y/Width/Height, **Fill color + opacity** (geometric shapes) or **Text content + Format** (size, color, font, align, B/I/U), **Freeze** button, **Draw order** checkbox |
| Right-click empty canvas | Selection menu for the current combined selection (Group ≥2 / Ungroup / Clear) |

### Selection model

- `selectedNodeIds` (nodes) and `selectedShapeIds` (shapes) coexist — a selection
  may contain both (marquee / whole-group selection).
- Selecting a **group member** (node or shape) selects the whole group.
- `selectedShapeId` = the **primary** shape (resize handles + panel); all shapes
  in `selectedShapeIds` get the selection highlight.
- Node click/marquee clears shape selection only when the action is a plain
  single selection; building a combined selection (marquee)
  keeps both parts.

### Draw order (per item)

| Layer (bottom → top) | Contents |
|---|---|
| 1 | Shapes with `front` off (default) |
| 2 | Connection wires |
| 3 | Nodes with `front` off (default — nodes are always above wires, as before) |
| 4 | **Front items**: nodes and shapes with `front` on (in array order) |

### Group behavior (shapes feature additions)

- `NodeGroup.shapeIds?: string[]` — a group may contain nodes, shapes, or both.
- Group bounds = padded union of member nodes **and shapes**.
- Dragging any member moves all members (via the existing `moveNodesBy`,
  extended with shape ids).
- **The dashed outline + group name render only while the cursor hovers the
  group's bounds** (previously always visible).
- Deleting members prunes the group; a group survives if any member remains.

### Zoom to Fit integration

Shapes are canvas items — **⊞ Fit** fits nodes **and** shapes.

---

## 3. Files changed

### New files

| File | Purpose |
|------|---------|
| `src/features/canvas-shapes/shapes.ts` | Pure logic: `SHAPE_CATALOG` (seven typical shapes incl. Text + defaults), `createShape`, `shapeResizeBox` (corner-resize math + min-size clamp), `shapeRatioResizeBox` (Ctrl fixed-ratio resize), `shapePolygonPoints` (triangle/diamond/hexagon), `sanitizeShapes` (save-file validation incl. color/opacity/front/text fields), `MIN_SHAPE_SIZE`, `DEFAULT_SHAPE_COLOR`, `DEFAULT_SHAPE_FILL_OPACITY`, text defaults/limits/font families |
| `src/features/canvas-shapes/index.ts` | Barrel export |
| `src/features/canvas-shapes/tests/shapes.test.ts` | 11 node:test cases (catalog, creation defaults, text defaults, all four resize handles, min-size clamping, **fixed-ratio resize**, degenerate ratio, polygon geometry, save-file sanitization incl. color/opacity/text fields) |

### Modified files (minimal, additive)

| File | Change | Reason | Risk |
|------|--------|--------|------|
| `src/types.ts` | `CanvasShape` + `color?`, `fillOpacity?`, `front?`, text annotation fields (`text`/`fontSize`/`fontColor`/`fontFamily`/`fontWeight`/`fontStyle`/`underline`/`textAlign`); `CanvasNode.front?`; `NodeGroup.shapeIds?`; `UndoAction.shapes?` | Shared feature types | Additive/optional fields only |
| `src/hooks/useNodeEditor.ts` | Shape state incl. `selectedShapeIds`; ops `selectShape` (group-aware), `setShapeSelection`, `addShape`, `moveShape`, `updateShape`, `toggleShapeFrozen`, `deleteShape` (prunes groups), `setNodeFront`; **`groupSelection`/`ungroupSelection`** (mixed); `moveNodesBy` + shape ids; `selectNode` brings in group shapes; shapes in undo/redo, `clearAll`, save/load (old `shapesOnTop: true` files migrate to per-shape `front`) | State home | Old files load unchanged (no shapes → none) |
| `src/components/NodeCanvas.tsx` | Shape layers by per-item `front`; select/move/resize (Ctrl ratio)/edit-dimensions/freeze/context-menu/text-annotations (inline double-click editing) interactions; **marquee multi-selection of nodes and shapes with full highlight; Ctrl+left-drag moves the node selection**; **hover-only group outlines**; grouped-shape drags move the group; per-node draw-order menu item; Zoom-to-Fit includes shapes | Canvas owns rendering + interaction | All props optional — canvas identical without them |
| `src/components/Toolbox.tsx` | **"Shapes" category** inside the node category list (draggable items); search matches shapes | The requested toolbox location | Node categories/list unchanged |
| `src/components/PropertiesPanel.tsx` | Shape inspector: position/size, **Fill color + opacity** (or **Text content + Format** for Text), Freeze, **per-item Draw order**; node view gained the **Draw order** checkbox | Editing surface | Optional props — panel identical without them |
| `src/App.tsx` | Wires the new state; Ctrl+G/Ctrl+Shift+G use the combined selection; shapes + per-item `front` persist in the project file | Connection layer | Additive props/callbacks |
| `tsconfig.feature-tests.json` / `package.json` | Test suites registered | Test execution | Test-only |

No calculation code, node definitions, engine, or formula parser was changed.

---

## 4. Known limitations (documented)

- **Freeze locks size only** — a frozen shape can still be moved, deleted,
  and re-colored; its dimension inputs stay disabled.
- **Ctrl+ratio** uses the aspect ratio captured when the drag started; the
  min-size clamp may break the ratio by a pixel or two at tiny sizes.
- With a shape **in front** covering a node, the shape catches the click on
  that node (standard layering behavior — use *Send to back* to work underneath).
- Resize handles appear on the **primary** selected shape only (marquee
  selection highlights all, handles follow the first shape).
- **Undo/redo** covers add/delete of shapes and of nodes (same granularity as
  before); live dragging/resizing is not an individual undo step.
