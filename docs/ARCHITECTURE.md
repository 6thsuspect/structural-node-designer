# Architecture Document

## Structural Node Designer

**Version:** 1.0  
**Last Updated:** 2024

---

## 1. System Overview

### 1.1 Purpose

The Structural Node Designer is a browser-based visual programming environment for structural engineering calculations. It enables engineers to create calculation workflows by connecting graphical nodes instead of writing complex formulas.

### 1.2 Key Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Type** | Single-Page Application (SPA) |
| **Runtime** | Browser (Chrome, Firefox, Edge, Safari) |
| **State** | Client-side only (no backend) |
| **Storage** | Local files (.snd.json) |
| **Offline** | Fully functional offline |

---

## 2. Architecture Diagrams

### 2.1 High-Level Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    React Application                            │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                    App Component                          │  │ │
│  │  │                   (Layout Manager)                        │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │         │              │              │              │          │ │
│  │         ▼              ▼              ▼              ▼          │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐   │ │
│  │  │ Toolbar  │  │  NodeCanvas  │  │ Properties │  │ Modals  │   │ │
│  │  │ +Settings│  │  +ConnMenu   │  │            │  │ +Settings│   │ │
│  │  └──────────┘  └──────────────┘  └────────────┘  └─────────┘   │ │
│  │                       │                                         │ │
│  │                       ▼                                         │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                  useNodeEditor Hook                       │  │ │
│  │  │         + Circular Reference Prevention                   │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │         │              │              │              │          │ │
│  │         ▼              ▼              ▼              ▼          │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐   │ │
│  │  │  Engine  │  │   Node Defs  │  │   Parser   │  │  Types  │   │ │
│  │  │  +Cycle  │  │  +Excel     │  │            │  │          │   │ │
│  │  └──────────┘  └──────────────┘  └────────────┘  └─────────┘   │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    Browser APIs                                      │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────────┐   │
│  │   DOM    │  │   File API   │  │   Blob     │  │  Download   │   │
│  └──────────┘  └──────────────┘  └────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Architecture

```
                    User Interaction
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Handlers                            │
│  (onClick, onDrag, onDrop, onKeyDown, onChange)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    useNodeEditor Hook                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Actions   │  │    State    │  │   Undo/Redo Stack   │  │
│  │ (callbacks) │  │  (useState) │  │      (useRef)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Calculation Engine                         │
│  1. Topological Sort (dependency order)                      │
│  2. Value Propagation (through connections)                  │
│  3. Compute Functions (per node)                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      React Re-render                         │
│  (Components receive new state via props)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        DOM/SVG Update                        │
│  (Virtual DOM diff → Actual DOM updates)                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Module Dependency Graph

```
                        App.tsx
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    Toolbar           NodeCanvas         Modals
        │                  │                │
        │                  ▼                │
        │           useNodeEditor ◄─────────┤
        │                  │                │
        │      ┌───────────┼───────────┐    │
        │      │           │           │    │
        │      ▼           ▼           ▼    │
        │   engine.ts  nodeDefinitions formulaParser
        │      │           │           │    │
        │      └───────────┼───────────┘    │
        │                  │                │
        │                  ▼                │
        └────────────► types.ts ◄───────────┘
```

---

## 3. Component Architecture

### 3.1 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **App** | Layout management, panel visibility, resize handling, modals (no Excel panel) |
| **Toolbar** | Top ribbon with file, edit, view, custom node, **⚙️ Settings** |
| **Toolbox** | Node library browser, search, category expansion, Quick Formula button |
| **NodeCanvas** | SVG rendering, **connection click menu**, **circular ref prevention feedback** |
| **PropertiesPanel** | Selected node details, value editing |
| **QuickFormulaModal** | Simple equation-based node creation |
| **CustomFormulaModal** | Advanced node editor with manual port definition |
| **SettingsModal** | General/Theme/About tabs, shortcuts, tips |

### 3.2 Component Communication

```
┌─────────────────────────────────────────────────────────────┐
│                          App                                 │
│                                                              │
│   State:                    Callbacks:                       │
│   - toolboxOpen             - setToolboxOpen                 │
│   - propertiesOpen          - setShowCustomFormulaModal      │
│   - customNodes             - handleSaveProject              │
│                                                              │
│   Shared via useNodeEditor:                                  │
│   - nodes, connections      - addNode, deleteNode            │
│   - zoom, panX, panY        - moveNode, updateNodeInput      │
│   - theme                   - addConnection                  │
│   - selectedNodeId          - undo, redo                     │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌───────────┐     ┌────────────┐
   │ Toolbox  │     │NodeCanvas │     │ Properties │
   │          │     │           │     │            │
   │ Props:   │     │ Props:    │     │ Props:     │
   │ -theme   │     │ -nodes    │     │ -node      │
   │ -search  │     │ -conns    │     │ -conns     │
   │ -onChange│     │ -zoom     │     │ -onUpdate  │
   │          │     │ -onMove   │     │ -onDelete  │
   └──────────┘     └───────────┘     └────────────┘
```

---

## 4. State Architecture

### 4.1 State Categories

| Category | Location | Persistence |
|----------|----------|-------------|
| **Canvas State** | useNodeEditor hook | Saved to file |
| **UI State** | App component | Session only |
| **Custom Nodes** | App component | Saved to file |
| **Undo/Redo** | useNodeEditor (useRef) | Session only |

### 4.2 Canvas State (useNodeEditor)

```typescript
{
  // Persisted state (saved to project file)
  nodes: CanvasNode[];        // All nodes on canvas
  connections: Connection[];  // All connections
  zoom: number;               // 0.1 to 5.0
  panX: number;               // Horizontal offset
  panY: number;               // Vertical offset
  theme: Theme;               // Visual theme

  // Session state (not saved)
  connecting: ConnectingState;  // Active connection drag
  selectedNodeId: string;       // Currently selected node
  searchQuery: string;          // Toolbox search
}
```

### 4.3 UI State (App component)

```typescript
{
  // Panel visibility
  toolboxOpen: boolean;
  propertiesOpen: boolean;
  showExcel: boolean;
  showSplash: boolean;

  // Panel sizes
  toolboxWidth: number;       // 180-500px
  propertiesWidth: number;    // 200-500px
  excelHeight: number;        // 80-600px

  // Resize tracking
  resizing: 'toolbox' | 'properties' | 'excel' | null;

  // Modals
  showCustomFormulaModal: boolean;
  showQuickFormulaModal: boolean;

  // Custom nodes (saved to file)
  customNodes: CustomNodeData[];
}
```

### 4.4 Undo/Redo Stack

```typescript
// Stored in useRef (doesn't trigger re-renders)
undoStack: UndoAction[];  // Max 100 items
redoStack: UndoAction[];

interface UndoAction {
  nodes: CanvasNode[];      // Deep clone of nodes
  connections: Connection[]; // Deep clone of connections
}
```

---

## 5. Rendering Architecture

### 5.1 SVG Structure

```svg
<svg class="canvas" width="100%" height="100%">
  <!-- Definitions -->
  <defs>
    <pattern id="grid">...</pattern>
    <pattern id="gridLarge">...</pattern>
  </defs>

  <!-- Background -->
  <rect class="canvas-bg" fill="url(#gridLarge)" />

  <!-- Transform group (handles pan & zoom) -->
  <g transform="translate(panX, panY) scale(zoom)">
    
    <!-- Layer 1: Connections (behind nodes) -->
    <g class="connections">
      <path d="M...C..." />  <!-- Bezier curves -->
    </g>

    <!-- Layer 2: Active connection being drawn -->
    <path class="connecting" d="M...C..." stroke-dasharray="6 3" />

    <!-- Layer 3: Nodes -->
    <g class="nodes">
      <g transform="translate(x, y)" class="node">
        <rect class="shadow" />
        <rect class="body" />
        <rect class="header" />
        <text class="title" />
        <g class="ports">
          <circle class="port input" />
          <circle class="port output" />
          <foreignObject><input /></foreignObject>
        </g>
      </g>
    </g>

  </g>
</svg>
```

### 5.2 Rendering Pipeline

```
State Change
    │
    ▼
React Re-render (Virtual DOM)
    │
    ├── NodeCanvas receives new props
    │
    ├── Generate SVG elements for each node
    │       - Calculate port positions
    │       - Format output values
    │       - Apply selection styles
    │
    ├── Generate path elements for connections
    │       - Calculate bezier control points
    │       - Apply connection styles
    │
    └── React DOM Diff
          │
          ▼
    Minimal DOM Updates (actual SVG changes)
```

### 5.3 Coordinate Transformation

```
Screen Space (pixels from browser origin)
       │
       │  screenToCanvas(screenX, screenY)
       │  x = (screenX - rect.left - panX) / zoom
       │  y = (screenY - rect.top - panY) / zoom
       ▼
Canvas Space (logical coordinates)
       │
       │  Add node position
       │  x = canvasX - node.x
       │  y = canvasY - node.y
       ▼
Node Space (relative to node origin)
```

---

## 6. Calculation Architecture

### 6.1 Dependency Graph

Nodes and connections form a Directed Acyclic Graph (DAG):

```
   Input A          Input B
      │                │
      ▼                ▼
  ┌───────┐        ┌───────┐
  │ Load  │        │ Width │
  │  P    │        │   b   │
  └───┬───┘        └───┬───┘
      │                │
      └────────┬───────┘
               │
               ▼
          ┌─────────┐
          │ Multiply│
          │  P × b  │
          └────┬────┘
               │
               ▼
          ┌─────────┐
          │ Display │
          │ Result  │
          └─────────┘
```

### 6.2 Execution Order

The engine uses Kahn's algorithm for topological sorting:

```
1. Calculate in-degree for each node
2. Start with nodes having in-degree = 0 (no inputs connected)
3. Process each node:
   a. Collect input values from connected outputs
   b. Execute compute function
   c. Store output values
   d. Decrement in-degree of downstream nodes
   e. Add to queue if in-degree becomes 0
4. Repeat until all nodes processed
```

### 6.3 Circular Reference Detection

```
If topological sort completes with fewer nodes than total:
    → Circular reference exists
    → Remaining nodes are part of a cycle
    → Return partial sort + remaining nodes
```

---

## 7. Formula Parser Architecture

### 7.1 Parser Pipeline

```
Input String: "sqrt(b * d^3 / 12)"
         │
         ▼
┌─────────────────────────────────────────┐
│              Tokenizer                   │
│                                          │
│  Regex-based lexical analysis            │
│  Output: Token[]                         │
│  [FUNC:sqrt, PAREN:(, VAR:b, OP:*, ...]│
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           Recursive Descent Parser       │
│                                          │
│  parseExpression() → parseAddSub()      │
│  → parseMulDiv() → parsePower()         │
│  → parseUnary() → parsePrimary()        │
│                                          │
│  Output: AST (Abstract Syntax Tree)      │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│              AST Structure               │
│                                          │
│  {                                       │
│    type: 'function',                     │
│    name: 'sqrt',                         │
│    args: [{                              │
│      type: 'binary',                     │
│      operator: '/',                      │
│      left: { ... },                      │
│      right: { type: 'number', value: 12}│
│    }]                                    │
│  }                                       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│             Evaluator                    │
│                                          │
│  function evaluate(ast, variables)       │
│  Recursively evaluates AST               │
│  Returns: number                         │
└─────────────────────────────────────────┘
         │
         ▼
Output: Evaluation Function
(variables) => number
```

### 7.2 Operator Precedence

| Level | Operators | Associativity | Parser Method |
|-------|-----------|---------------|---------------|
| 1 (lowest) | `+`, `-` | Left | parseAddSub() |
| 2 | `*`, `/` | Left | parseMulDiv() |
| 3 (highest) | `^` | Right | parsePower() |

---

## 8. File Format Architecture

### 8.1 Project File Structure

```json
{
  "name": "string",
  "version": "string",
  "created": "ISO8601 date",
  "modified": "ISO8601 date",
  "canvas": {
    "nodes": [ /* CanvasNode[] */ ],
    "connections": [ /* Connection[] */ ],
    "zoom": 1.0,
    "panX": 0,
    "panY": 0
  },
  "theme": "dark|light|grasshopper|autocad",
  "customNodes": [ /* CustomNodeData[] */ ]
}
```

### 8.2 Save/Load Flow

```
Save:
  App State
      │
      ├── Serialize nodes, connections
      ├── Include custom nodes
      ├── Add metadata (timestamps)
      │
      ▼
  JSON.stringify()
      │
      ▼
  new Blob([json], {type: 'application/json'})
      │
      ▼
  URL.createObjectURL(blob)
      │
      ▼
  <a download="project.snd.json">
      │
      ▼
  Browser Download Dialog


Load:
  <input type="file">
      │
      ▼
  FileReader.readAsText()
      │
      ▼
  JSON.parse()
      │
      ▼
  Validate structure
      │
      ├── Extract customNodes → register
      │
      ▼
  Set state (nodes, connections, zoom, pan, theme)
      │
      ▼
  Trigger recompute
```

---

## 9. Performance Architecture

### 9.1 Optimization Strategies

| Strategy | Implementation |
|----------|----------------|
| **Memoization** | useCallback for event handlers |
| **Ref Storage** | Undo/redo stacks in useRef |
| **Lazy Eval** | Only recompute on changes |
| **SVG over Canvas** | Better for interactivity |
| **Minimal Re-renders** | Selective state updates |

### 9.2 Memory Management

```
Node Creation:
  - UUID generation (uuid library)
  - Deep copy of port definitions
  - Minimal object allocation

Connection Creation:
  - UUID generation
  - Simple object with references

Undo/Redo:
  - Deep clone via JSON.parse(JSON.stringify())
  - Stack limit of 100 actions
  - FIFO eviction when limit reached
```

### 9.3 Render Optimization

```
Virtual DOM Reconciliation:
  - Key prop on nodes (node.id)
  - Key prop on connections (conn.id)
  - Stable callback references (useCallback)

SVG Optimization:
  - Transform group for pan/zoom (single transform)
  - Pattern-based grid (not individual lines)
  - Minimal stroke/fill changes
```

---

## 10. Security Architecture

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Code Injection | Custom parser (no eval) |
| XSS | React's automatic escaping |
| File Tampering | JSON validation on load |
| Data Exfiltration | No network requests |

### 10.2 Formula Execution Safety

```typescript
// SAFE: Custom evaluator with whitelist
function evaluate(ast, variables) {
  switch (ast.type) {
    case 'number': return ast.value;
    case 'variable': return variables[ast.value];
    case 'function': return SAFE_FUNCTIONS[ast.name](args);
    // Only whitelisted operations
  }
}

// UNSAFE (never used)
eval(userInput);
new Function(userInput);
```

---

## 11. Extensibility Architecture

### 11.1 Adding New Built-in Nodes

```typescript
// 1. Add definition to nodeDefinitions.ts
const newNode: NodeDefinition = {
  type: 'my_node',
  category: 'MyCategory',
  label: 'My Node',
  inputs: [...],
  outputs: [...],
  compute: (inputs) => ({ ... }),
};

// 2. Push to nodeDefinitions array
nodeDefinitions.push(newNode);

// 3. Add category color if new
CATEGORY_COLORS['MyCategory'] = '#hexcolor';
```

### 11.2 Custom Node Registration Flow

```
Quick Formula Modal
        │
        ├── User types equations
        ├── Extract variables
        ├── Create CustomNodeData
        │
        ▼
handleSaveCustomNode()
        │
        ├── Add to customNodes state
        │
        ▼
useEffect (on customNodes change)
        │
        ├── Create NodeDefinition
        ├── Set compute function (using parseFormula)
        │
        ▼
registerCustomNode()
        │
        ├── Add to customNodes array
        │
        ▼
forceUpdate (trigger Toolbox re-render)
```

---

*Architecture documentation for Structural Node Designer v1.0*
