# User Guide

## Structural Node Designer — Version 1.1

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Interface Overview](#2-interface-overview)
3. [Working with Nodes](#3-working-with-nodes)
4. [Creating & Editing Connections](#4-creating--editing-connections)
5. [Custom Formulas](#5-custom-formulas)
6. [Projects & Files](#6-projects--files)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Node Reference](#8-node-reference)
9. [Tips & Best Practices](#9-tips--best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### Welcome Screen Options

| Option | Description |
|--------|-------------|
| 🚀 **Demo** | Load a bundled demo project, listed by file name: Circular RC Section, I-Setion_LTB |
| ⚡ **Quick Formula** | Create custom node from equations |
| ✨ **Empty Canvas** | Start fresh |
| 📂 **Open Project** | Load saved project |

### Themes
- 🌙 Dark, ☀️ Light, 🦗 Grasshopper, 📐 AutoCAD

---

## 2. Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Toolbar (⚙️ Settings)                │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│ Toolbox  │           Canvas                 │  Properties   │
│ (☰ toggle)│  (Node Editor + Connections)    │   (☰ toggle)  │
│          │                                  │               │
└──────────┴──────────────────────────────────┴───────────────┘
```

**No bottom Excel panel** — Canvas takes full center area.

### Panel Controls
- **☰ Hamburger** — Collapse/expand panel
- **Resize grip** — Drag to resize width
- **Collapsed tab** — Click vertical tab to reopen

---

## 3. Working with Nodes

### Adding a Node
1. Find node in Toolbox (or search)
2. Drag to canvas → release to place

### Selecting & Moving
- Click to select
- Drag header to move
- Delete key to remove

### Editing Values
- Click value on canvas → type new value → Enter
- Or edit in Properties panel

---

## 4. Creating & Editing Connections

### Making a Connection
1. Click **output port** (blue circle, right side)
2. Drag to **input port** (orange circle, left side)
3. Release when port highlights

### ⭐ Selecting a Connection Wire
1. **Left-click** any wire (bezier curve) between nodes — only the wire is selected (nodes are deselected)
2. The selected wire turns **red** (thicker/brighter) while selected
3. Press **Delete** to remove the selected wire; click empty canvas or press **Esc** to deselect

### 🖱️ Wire Options Menu (right-click)
With a wire selected, **right-click** (on the wire itself, or anywhere on the canvas) to open the wire menu:
- 🎨 **Wire color** — preset swatches, a custom color picker (previews live), or reset to the theme default
- 🗑️ **Delete Connection** — Remove the wire
- ✕ **Cancel**

Wire colors are saved with the project (`.snd.json`)

### 🔄 Circular Reference Prevention (NEW!)
- If connecting two nodes would create an **infinite loop**, the connection is **automatically blocked**
- Example: A→B→C→A would be blocked
- The system uses BFS cycle detection before adding any connection

---

## 5. Custom Formulas

### Quick Formula
1. Click ⚡ Quick Formula
2. Type equations: `Stress = M / Z`
3. Variables auto-detected as inputs
4. Set defaults/units → Create Node

### Syntax
| Element | Examples |
|---------|----------|
| Operators | `+ - * / ^ ()` |
| Functions | `sqrt, sin, cos, abs, min, max, round, pow` |
| Constants | `pi, e` |

### Chained equations:
```
Area = b * h
I = b * h^3 / 12
Z = I / (h / 2)
Stress = M / Z
```

---

## 6. Projects & Files
- 💾 Save → `.snd.json` (includes custom nodes)
- 📂 Open → Load from file
- 📄 Report → Markdown download
- ⚙️ Settings → Themes, shortcuts, tips, about

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Delete | Delete node |
| Alt+Drag | Pan |
| Scroll | Zoom |
| Escape | Close menus |

---

## 8. Node Reference

### Input Nodes (13)
Number, Width, Depth, Thickness, Length, Fy, Fu, Load, Moment, Shear, E, fck, Bolt Dia

### Math Nodes (16)
Add, Subtract, Multiply, Divide, Power, Sqrt, Abs, Max, Min, Average, Round, Sin, Cos, Tan, Log, Pi

### Logic Nodes (8)
IF, AND, OR, NOT, Greater, Less, Equal, Design Check

### Section Nodes (5)
Rectangle Area, Rectangle Ix, Circle Area, I-Section, Radius of Gyration

### Steel Nodes (6) — IS 800
Plastic Moment, Shear Capacity, Tension, Bolt, Slenderness, Section Class

### RCC Nodes (3) — IS 456
Flexure, Shear Check, Development Length

### Load Nodes (4)
Load Combination, Self Weight, Wind (IS 875-3), Seismic (IS 1893)

### Bridge Nodes (1) — IRC
Impact Factor

### Material Nodes (2)
Steel Properties, Concrete Properties

### ⭐ Excel Nodes (7) — NEW
| Node | Description |
|------|-------------|
| Cell Reference | Value with cell label |
| SUM | A + B + C + D |
| COUNT | Count non-zero values |
| AVERAGE | Average of values |
| IF (Excel) | Conditional selection |
| Lookup Table | Approximate VLOOKUP (3 columns) |
| SUMIFS | Conditional sum |

### Output Nodes (2)
Display, Pass/Fail

---

## 9. Tips

- ✅ Left-click a wire to select it (red); right-click for color + delete options
- ✅ Circular connections are auto-blocked
- ✅ Use ⚡ Quick Formula for fastest custom nodes
- ✅ Output values appear **green on LEFT**, names **gray on RIGHT**
- ✅ Input names near circle, values in center box
- ✅ Boolean inputs: click to toggle TRUE/FALSE
- ✅ ⚙️ Settings has shortcuts & theme switching

---

## 10. Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't connect nodes | Check direction (output→input) or circular ref |
| Connection blocked | Would create infinite loop — restructure workflow |
| Node values show 0 | Ensure all inputs connected or have defaults |
| Text overlapping | Fixed in v1.1 — values LEFT, names RIGHT on outputs |
| Hover makes node blink | Fixed — only transform animates, not colors |
| Can't click connection | Click directly on the blue bezier curve |
