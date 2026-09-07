# Node Groups (Multi-Select + Group / Ungroup)

**Feature:** Marquee selection and node grouping on the canvas
**Status:** Implemented — additive feature, existing application unchanged

---

## 1. Purpose

Select several nodes at once with a **cursor selection box**, then **group**
them so they move as a single unit. Groups are visible on the canvas as a
dashed bounding box with a name, and persist with the project file.

---

## 2. How to select multiple nodes

| Gesture | Result |
|---------|--------|
| **Left-drag on empty canvas** | Draws a marquee (rubber-band) box; on release, every node intersecting the box is selected |
| **Shift + left-drag on empty canvas** | Marquee selection is *additive* (union with the current selection) |
| **Shift + click a node** | Toggles that node (or its whole group) in/out of the selection |
| **Click a grouped node** | Selects the whole group |
| **Plain click on empty canvas** | Clears the selection (unchanged behavior) |
| **Alt / middle-mouse drag** | Pans the canvas (unchanged behavior) |

Selected nodes keep the existing amber selection outline.

## 3. How to group / ungroup

1. Select two or more items — nodes and/or shapes (marquee box or Shift+click
   items one by one).
2. **Right-click** — either on one of the selected nodes/shapes (context menu)
   or on the empty canvas (selection context menu):
   * **📦 Group Selection (Ctrl+G)** — creates `Group 1`, `Group 2`, … around the selection
   * **📂 Ungroup (Ctrl+Shift+G)** — deletes every group the selection belongs to
   * (selection menu) **✕ Clear Selection**
3. Shortcut anywhere: **Ctrl+G** groups the current selection,
   **Ctrl+Shift+G** ungroups it.

> **Mixed groups (shapes feature):** a selection may contain nodes **and**
> shapes — they are grouped together into one `NodeGroup` (its `shapeIds`).

## 4. How grouping behaves

* **Move together:** dragging any member of a group drags *the whole group* by
  the same delta — including the group's shapes. Non-grouped multi-selection
  drags the single item under the cursor (grouping is what enables group movement).
* **Visibility:** a group's dashed bounding box (label = group name) renders
  **only while hovering the group** (previously always visible) and follows its
  members live.
* **Delete:** deleting a node (single or via multi-select **Delete** key)
  removes it from its groups; groups that become empty are dropped.
* **Persistence:** groups are saved with the project file (top-level
  `groups` field, optional — old project files load fine without it).
* **Nesting:** a node may belong to several groups; grouping the selection
  creates a *new* group on top of existing ones.

---

## 5. Implementation notes (integration points)

Pure logic lives in an isolated, removable module:

```text
src/features/node-groups/
├── nodeGroups.ts          (pure helpers: bounds, marquee, pruning, naming)
├── tests/nodeGroups.test.ts
└── index.ts
```

| File | Change | Why |
|------|--------|-----|
| `src/types.ts` | Added `NodeGroup` interface | Core state type |
| `src/hooks/useNodeEditor.ts` | New state (`selectedNodeIds`, `groups`) + `selectNodes`, `groupNodes`, `ungroupNodes`, `moveNodesBy`, `deleteNodes`; `selectNode` now group-aware; `deleteNode`/`clearAll`/`saveProject`/`loadProject` keep groups consistent | Single source of canvas state |
| `src/components/NodeCanvas.tsx` | Optional props for selection/groups, marquee box, group outlines, group drag, context-menu items, selection menu, multi-delete | Canvas interaction layer |
| `src/App.tsx` | Wires the hook into the canvas, Ctrl+G shortcuts, saves groups | App integration |
| `package.json` / `tsconfig.feature-tests.json` | Test script now runs both feature test suites | Tests |

All canvas props for this feature are **optional** — the component behaves
exactly as before when they are not provided. No existing node type, formula,
engine function, or project-format field was changed.

### Intentional UX alignments (documented per the additive-feature rule)

* Right-clicking an *unselected* node now selects it first (group-aware), so
  the context menu's Group/Ungroup actions always have a well-defined target.
* Clicking a grouped node selects the whole group.
* `Delete` with a multi-selection removes all selected nodes in one undo step.

### Known limitations

* Undo/redo snapshots do not include group metadata (groups are treated like
  selection state): restoring a deleted node does not re-join it to its group.
* Dragging one of several *non-grouped* selected nodes moves that node only —
  group it first to move together.
* Group bounds are visual only (no snap, no group-level resize).

---

## 6. Testing

```bash
npm test
```

Runs both feature suites (Calculation Trace + Node Groups) with Node's built-in
test runner: group bounds, marquee intersection semantics, selection expansion,
group pruning/removal, naming, and effective selection targets.
