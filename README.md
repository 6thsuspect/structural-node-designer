Changelog
All notable changes to the Structural Node Designer project will be documented in this file.
---
[1.1] - 2026
Added
🔗 Connection Click Menu
Click on any connection wire to open context menu with:
🗑️ Delete Connection
✕ Cancel
Connection highlights (thicker/brighter) when selected in menu
Wide invisible hit-area (16px) ensures easy clicking on wires
🔄 Circular Reference / Infinite Loop Prevention
Connections that would create infinite loops are automatically blocked
BFS cycle detection runs before every new connection
If `toNodeId` is already reachable from `fromNodeId`, the connection is silently rejected
Prevents circular dependency chains that would break calculations
📊 Excel-like Nodes (7 new nodes)
📌 Cell Reference — Value with cell address label
Σ SUM — Sum of A + B + C + D
COUNT — Count of non-zero inputs
x̄ AVERAGE — Average of values
IFn IF (Excel) — Conditional value selection
📊 Lookup Table — Approximate VLOOKUP (3-column table)
Σf SUMIFS — Conditional sum with fallback
⚙️ Settings Panel
⚙️ button in top toolbar
Three tabs: General, Theme, About
Keyboard shortcuts reference
Tips section (connection click, circular prevention, etc.)
Theme switching with visual descriptions
About page with version and feature grid
🎨 Hover Blinking Fix
Root cause: `transition-all` on SVG elements causes color/opacity animations on hover → visual "blinking"
Fix: Changed to `transition: transform 0.15s ease` only — only scale animates, not colors
Node hover: subtle `strokeOpacity` shift (0.6→1), no transform/scale on entire node
Port circles: scale via `[&:hover]:scale-[1.25]` with `transition-[transform]`
No re-render triggers on hover (uses CSS only)
📐 Output Text Overlap Fix
Root cause: port name AND value both rendered near the output circle with same anchor → overlapping text
Fix: Complete layout redesign:
Output ports: Value at x=14 (LEFT, green bold), Name at x=width-10 (RIGHT, small gray)
Input ports: Name at x=14 (near circle), Value in box at x=78+
Input values get dedicated rect backgrounds for clarity
Boolean inputs show clickable ✓ TRUE / ✗ FALSE toggle
Smart `fmt()` formatter: exponential for large/small numbers, locale formatting for thousands
🗑️ Excel Preview Panel Removed
Bottom Excel Preview panel removed entirely
Canvas takes full center area
Cleaner, more focused editing experience
---
[1.0.0] - 2024
🎉 Initial Release
Visual node editor with SVG canvas, pan/zoom
60+ built-in nodes across 12 categories
Live calculation engine with topological sort
Quick Formula and Advanced custom node editors
Formula parser (recursive descent, no eval)
4 themes (Dark, Light, Grasshopper, AutoCAD)
Collapsible/resizable panels with hamburger toggle
Project save/load (.snd.json)
Markdown report generation
Demo workflow (steel beam design)
---
Known Issues
Issue	Workaround	Status
No multi-select drag	Move nodes individually	Planned
No clipboard support	Use duplicate function	Planned
---
For feature requests or bug reports, open an issue in the repository.
