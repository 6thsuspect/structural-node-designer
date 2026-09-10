# Full Touchscreen & Mobile Support

Structural Node Designer works with **mouse + keyboard** on desktop and
**finger/stylus** on phones, tablets and hybrid devices — the same single
application, the same node engine, the same data model, the same engineering
results (see §7).

---

## 1. Interaction model

The app uses the **Pointer Events API** exclusively for touch and pen input
(`pointerdown / pointermove / pointerup / pointercancel`, `pointerType`,
pointer capture). Mouse input keeps flowing through the original
`onMouseDown/Move/Up` handlers, which are untouched — the desktop experience
is byte-for-byte the same. Both layers call the **same** drag/marquee/connect
code, and both use the **same** `screenToCanvas` world-coordinate conversion,
so mouse, finger and stylus always agree.

### Gesture rules

| Gesture                    | Action                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Tap node                   | Select (group-aware)                                              |
| Drag node                  | Move node / whole group (after 8 px threshold — no accidental drags) |
| Tap empty canvas           | Clear selection — or **place pending node** (see §4)              |
| Drag empty canvas          | Pan canvas (one finger)                                           |
| Touch port + drag          | Create connection — preview wire follows the finger               |
| Tap port                   | Nothing (never an accidental connection)                          |
| Pinch                      | Zoom **around the pinch midpoint** (never the screen center)      |
| Two-finger move            | Pan + zoom combined (midpoint translation + distance ratio)       |
| Long-press node (≈550 ms)  | Node context menu (same as desktop right-click)                   |
| Long-press shape / wire    | Shape / wire options menu                                         |
| Long-press canvas w/ selection | Selection menu (Group / Ungroup / Clear)                      |
| Long-press empty canvas + drag | Marquee (rubber-band) multi-select                            |
| Double-tap Text shape      | Inline text edit (≙ desktop double-click)                         |
| Tap value box / toggle     | Edit number/string value / flip boolean                           |

Long-press is cancelled when the finger moves past the drag threshold, so it
never fires in the middle of a drag. While a connection drag is live every
port is ringed **green (valid target)** or **red (invalid)**, and the port
under the finger gets a stronger ring; releasing on an invalid target (or
anywhere else) cancels instead of creating junk.

### Desktop compatibility

All mouse behavior is preserved: left/right/middle click, drag, double-click,
wheel zoom (at the cursor), Alt/middle-drag pan, node drag, connection drag,
marquee (plain and Shift-additive), Ctrl-drag of the selection, snap guides,
context menus, keyboard shortcuts (Del, Ctrl+C/V/Z/Y/A/G, Esc), trackpad
scroll + pinch. On mouse-only devices the enlarged port hit areas are
disabled via CSS; on hybrid (touchscreen laptop) devices they stay enabled
for every input, which is what a finger needs.

---

## 2. Port touch targets

The visible port circle is unchanged (7 px). Each port has an **invisible
hit circle** (≈36 px diameter at 100% zoom, clamped so tiny zoom levels
don't swallow the node). It is enabled only for coarse pointers — plus,
for every input type, **while a wire is being dragged** (a larger release
target helps mouse users too and changes no semantics).

---

## 3. Responsive layout

Viewport-width based (never device sniffing), so rotation, split-screen,
window resize and the collapsing mobile address bar are all handled:

| Width      | Layout                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| ≥ 1024 px  | Desktop: Toolbar / Toolbox / Canvas / Properties (unchanged)              |
| < 1024 px  | Compact: slim header, full-bleed canvas, bottom **MobileToolbar**, drawer sheets |

Compact extra chrome:

- **MobileToolbar** (bottom, safe-area aware): ＋ Add, ⚡ Formula, zoom −/+,
  ⊞ Fit, ↶ Undo, ↷ Redo, 📋 Properties, ⋯ More (Save, Open, Report, Quick
  Formula, Advanced Node, Snap toggle, theme picker, demo projects,
  Settings, About, Clear). Every command is the *same* callback the desktop
  toolbar uses — there is no second implementation.
- **Node library drawer**: the regular Toolbox in a bottom sheet with search
  and categories. Items can still be dragged (tablets/trackpads) and can be
  **tapped** to arm placement (§4).
- **Properties drawer**: the regular PropertiesPanel in a bottom sheet. It
  opens automatically when a node/shape is selected and closes on clear.
  Undo/redo, node actions (duplicate/delete/trace/draw order) all work from
  the sheet; deleting is also available via long-press menus on canvas.

The page uses `100dvh` (with a `100vh` fallback) and `env(safe-area-inset-*)`
so notches/home indicators never cover controls. `touch-action: none` is
scoped to the canvas SVG only — property panels, drawers, dialogs, reports,
text areas and forms keep native scrolling, text selection and keyboards.

---

## 4. Tap-to-place (adding nodes without drag-and-drop)

1. Tap **＋ Add** → the node library sheet opens.
2. Tap a node or shape → the sheet closes and a hint banner appears:
   “Tap canvas to place …”.
3. Tap the canvas → the node is created at that **world position** (canvas
   pan/zoom/viewport offsets are converted through the single canonical
   `screenToCanvas` transform, so it lands exactly where the finger tapped).
4. Cancel with the banner's ✕. Drag-and-drop from the sheet still works
   where the platform supports it.

---

## 5. Forms & keyboards

All numeric inputs declare `inputMode="decimal"`, so phones/tablets show the
numeric keyboard. `type="number"` is kept, so `25`, `25.5`, `-12.5`, `1.25E6`,
`0.0025` all keep working exactly as before. Formula editors are regular
textareas inside scrollable dialogs — no `touch-action` restrictions apply,
and the browser scrolls the focused field above the keyboard.

---

## 6. Architecture

```
            Mouse            Touch / Pen
              │                   │
   onMouseDown/Move/Up   onPointerDown/Move/Up/Cancel
   (unchanged paths)     (pointerType ≠ 'mouse', capture, id map)
              │                   │
              └───────┬───────────┘
                      ▼
   shared apply* helpers + finishMarquee  (NodeCanvas)
                      ▼
   screenToCanvas → one canonical world coordinate system
                      ▼
   existing node engine / undo / calculations (untouched)
```

Pure gesture math (pinch anchoring, tap slop, double-tap window, target
validation) lives in `src/features/touch-interactions/` and is unit-tested
with `node:test` (`npm test`). Key constants: `TAP_SLOP_PX = 8`,
`LONG_PRESS_MS = 550`, zoom limits 0.1–5 (identical to wheel zoom).

---

## 7. Engineering calculation integrity

Touch support is an **input-layer enhancement only**. The calculation engine,
formula parser, dependency resolution, node execution, units, validation and
report generation are untouched — the same project produces exactly the same
results on desktop, tablet and phone.

---

## 8. Regression checklist

### Canvas (touch)
- [ ] One-finger pan on empty canvas
- [ ] Pinch zoom, anchored at the pinch midpoint
- [ ] Two-finger pan + zoom combined
- [ ] Page never scrolls / pull-to-refresh on the canvas
- [ ] ⊞ Fit works (mobile toolbar)

### Nodes (touch)
- [ ] Tap selects a node (and its group)
- [ ] Drag moves the node; no jump at grab (offset preserved)
- [ ] Node keeps correct world coordinates after zoom/pan
- [ ] Long-press → node menu (edit code, formula, draw order, group, trace, delete)
- [ ] Tap empty canvas clears selection

### Connections (touch)
- [ ] Drag from a port shows the dashed preview following the finger
- [ ] Valid ports ring green, invalid red while dragging
- [ ] Release on a valid port creates the wire; release elsewhere cancels
- [ ] Tap a port without dragging creates nothing
- [ ] Long-press a wire → wire menu (color / delete)

### Library & properties (touch)
- [ ] ＋ Add opens the library sheet; search + categories work
- [ ] Tap node in library → tap canvas places it at the right spot
- [ ] Desktop drag-and-drop from the Toolbox still works
- [ ] Selecting a node opens the properties sheet; number/text/formula/dropdown
      edits work; sheet scrolls
- [ ] ⋯ More: save / open / report / theme / demos / settings all work

### Dialogs
- [ ] Every modal opens, drags, resizes and closes with touch (pointer events)
- [ ] Numeric keyboard appears for numeric fields (`25.5`, `-12.5`, `1.25E6`)

### Desktop regression (mouse + keyboard)
- [ ] Left-click select, drag, double-click, marquee (Shift-additive)
- [ ] Right-click menus (node/wire/shape/selection), middle/Alt-drag pan
- [ ] Wheel zoom at cursor; trackpad scroll/pinch
- [ ] Del / Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+G / Esc shortcuts
- [ ] Undo/redo, copy workflows, report, save/load — unchanged
