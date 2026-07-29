# Technical Design Document (TDD)

## Structural Node Designer

**Version:** 1.0  
**Last Updated:** 2024  
**Authors:** Development Team

---

## 1. Overview

### 1.1 Purpose
This document describes the technical architecture, design decisions, and implementation details of the Structural Node Designer application.

### 1.2 Scope
Covers the frontend web application including:
- Component architecture
- State management
- Calculation engine
- Formula parser
- Data structures
- Rendering approach

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Application                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Toolbar    │  │   Modals     │  │   Panel Components   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                     │                │
│         └─────────────────┼─────────────────────┘                │
│                           │                                      │
│                    ┌──────▼──────┐                              │
│                    │  App.tsx    │                              │
│                    │  (Layout)   │                              │
│                    └──────┬──────┘                              │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                    │
│  ┌──────▼──────┐  ┌───────▼───────┐  ┌─────▼─────┐             │
│  │  Toolbox    │  │  NodeCanvas   │  │Properties │             │
│  └─────────────┘  └───────┬───────┘  └───────────┘             │
│                           │                                      │
│                    ┌──────▼──────┐                              │
│                    │useNodeEditor│  ← Central State Hook        │
│                    └──────┬──────┘                              │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                    │
│  ┌──────▼──────┐  ┌───────▼───────┐  ┌─────▼─────┐             │
│  │  engine.ts  │  │nodeDefinitions│  │formulaParser│            │
│  │(Computation)│  │  (Library)    │  │ (Parser)   │             │
│  └─────────────┘  └───────────────┘  └───────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Hierarchy

```
App
├── Toolbar
├── HamburgerIcon (inline)
├── PanelHeader (inline)
├── CollapsedTab (inline)
├── ResizeGrip (inline)
├── Toolbox
├── NodeCanvas
├── PropertiesPanel
├── ExcelPreview
├── CustomFormulaModal
└── QuickFormulaModal
```

---

## 3. Data Structures

### 3.1 Core Types

#### Node Definition (Template)
```typescript
interface NodeDefinition {
  type: string;           // Unique identifier, e.g., "add", "plastic_moment"
  category: string;       // Category for toolbox grouping
  subcategory?: string;   // Optional sub-grouping
  label: string;          // Display name
  description?: string;   // Tooltip/help text
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  compute: (inputs: Record<string, any>) => Record<string, any>;
  color?: string;         // Header color
  icon?: string;          // Emoji or icon
}

interface PortDefinition {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'any';
  value?: any;            // Default value
  unit?: string;          // Unit label (mm, kN, MPa)
}
```

#### Canvas Node (Instance)
```typescript
interface CanvasNode {
  id: string;             // UUID
  type: string;           // References NodeDefinition.type
  x: number;              // Canvas X position
  y: number;              // Canvas Y position
  width: number;          // Node width (fixed 200px)
  height: number;         // Computed based on port count
  inputs: Port[];         // Instance ports with current values
  outputs: Port[];
  label: string;
  category: string;
  color: string;
  collapsed: boolean;
  selected: boolean;
  computed: boolean;      // Has been computed successfully
  error?: string;         // Error message if computation failed
}

interface Port {
  id: string;             // "{nodeId}-in-{index}" or "{nodeId}-out-{index}"
  name: string;
  type: PortType;
  value?: any;
  connected?: boolean;
  unit?: string;
}
```

#### Connection
```typescript
interface Connection {
  id: string;             // UUID
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}
```

### 3.2 State Structure

```typescript
// useNodeEditor hook state
{
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;           // 0.1 to 5.0
  panX: number;           // Canvas offset X
  panY: number;           // Canvas offset Y
  connecting: ConnectingState;
  selectedNodeId: string | null;
  theme: 'dark' | 'light' | 'grasshopper' | 'autocad';
  searchQuery: string;
}

// Undo/Redo stack
interface UndoAction {
  nodes: CanvasNode[];
  connections: Connection[];
}
```

---

## 4. Calculation Engine

### 4.1 Dependency Resolution

The engine uses **topological sorting** to determine execution order:

```typescript
function topologicalSort(nodes: CanvasNode[], connections: Connection[]): string[] {
  // 1. Build adjacency list and in-degree map
  // 2. Start with nodes that have no incoming connections
  // 3. Process nodes in order, decrementing in-degrees
  // 4. Detect circular references if not all nodes processed
}
```

### 4.2 Computation Flow

```
Input Change
    │
    ▼
Topological Sort (determine order)
    │
    ▼
For each node in order:
    │
    ├── Propagate values from connected outputs to inputs
    │
    ├── Collect input values into Record<string, any>
    │
    ├── Call NodeDefinition.compute(inputs)
    │
    ├── Store results in output ports
    │
    └── Mark node as computed (or set error)
    │
    ▼
Update React state with new nodes array
```

### 4.3 Circular Reference Detection

```typescript
function detectCircularReferences(nodes, connections): boolean {
  const sorted = topologicalSort(nodes, connections);
  return sorted.length !== nodes.length;
  // If not all nodes were sorted, there's a cycle
}
```

---

## 5. Formula Parser

### 5.1 Architecture

The formula parser is a **recursive descent parser** that converts mathematical expressions into an Abstract Syntax Tree (AST) for evaluation.

```
Input: "sqrt(b * d^3 / 12)"
           │
           ▼
      Tokenizer
           │
           ▼
Tokens: [FUNC:sqrt, PAREN:(, VAR:b, OP:*, VAR:d, OP:^, NUM:3, OP:/, NUM:12, PAREN:)]
           │
           ▼
       Parser
           │
           ▼
AST:    Function("sqrt")
            │
        Binary("/")
           / \
     Binary("*")  12
        / \
       b  Binary("^")
             / \
            d   3
           │
           ▼
      Evaluator
           │
           ▼
Output: (variables) => number
```

### 5.2 Supported Syntax

| Category | Elements |
|----------|----------|
| Operators | `+`, `-`, `*`, `/`, `^`, `(`, `)` |
| Functions | `sqrt`, `abs`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `log`, `log10`, `exp`, `min`, `max`, `pow`, `round`, `floor`, `ceil`, `sign` |
| Constants | `pi`, `PI`, `e`, `E` |
| Variables | Any identifier: `[a-zA-Z_][a-zA-Z0-9_]*` |

### 5.3 Operator Precedence

| Precedence | Operators | Associativity |
|------------|-----------|---------------|
| 1 (lowest) | `+`, `-` | Left |
| 2 | `*`, `/` | Left |
| 3 (highest) | `^` | Right |

### 5.4 API

```typescript
// Parse and return evaluation function
function parseFormula(formula: string): (variables: Record<string, number>) => number;

// Validate formula syntax and variable references
function validateFormula(formula: string, inputNames: string[]): { valid: boolean; error?: string };

// Extract variable names from formula
function extractVariables(formula: string): string[];
```

---

## 6. Rendering

### 6.1 Canvas Rendering (SVG)

The node canvas uses SVG for rendering, which provides:
- Vector graphics (crisp at any zoom level)
- Native mouse event handling
- CSS styling support
- Good performance for 1000s of elements

#### SVG Structure
```svg
<svg>
  <!-- Background grid pattern -->
  <defs>
    <pattern id="grid">...</pattern>
  </defs>
  <rect fill="url(#grid)" />
  
  <!-- Transform group for pan/zoom -->
  <g transform="translate(panX, panY) scale(zoom)">
    
    <!-- Connections (rendered first, behind nodes) -->
    <path d="M...C..." />  <!-- Bezier curves -->
    
    <!-- Nodes -->
    <g transform="translate(node.x, node.y)">
      <rect />           <!-- Shadow -->
      <rect />           <!-- Body -->
      <rect />           <!-- Header -->
      <text />           <!-- Title -->
      <g>                <!-- Input ports -->
        <circle />
        <text />
        <foreignObject>  <!-- Input field -->
          <input />
        </foreignObject>
      </g>
      <g>                <!-- Output ports -->
        <circle />
        <text />
      </g>
    </g>
    
  </g>
</svg>
```

### 6.2 Connection Bezier Curves

Connections use cubic Bezier curves for smooth, visually appealing paths:

```typescript
function bezierPath(x1, y1, x2, y2): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
```

### 6.3 Coordinate Systems

```
Screen Coordinates (pixels)
    │
    │  screenToCanvas(sx, sy)
    ▼
Canvas Coordinates (logical units)
    │
    │  canvasToNode(cx, cy, node)
    ▼
Node-Local Coordinates
```

```typescript
function screenToCanvas(sx, sy) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (sx - rect.left - panX) / zoom,
    y: (sy - rect.top - panY) / zoom,
  };
}
```

---

## 7. State Management

### 7.1 useNodeEditor Hook

Central state management using React hooks:

```typescript
function useNodeEditor() {
  // State
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  // ... more state

  // Undo/Redo stacks (useRef to avoid re-renders)
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);

  // Actions
  const addNode = useCallback((type, x, y) => { ... }, []);
  const deleteNode = useCallback((nodeId) => { ... }, []);
  const moveNode = useCallback((nodeId, x, y) => { ... }, []);
  const addConnection = useCallback((from, to) => { ... }, []);
  const updateNodeInput = useCallback((nodeId, portId, value) => { ... }, []);
  // ... more actions

  return {
    // State
    nodes, connections, zoom, panX, panY, ...
    // Setters
    setZoom, setPanX, setPanY, ...
    // Actions
    addNode, deleteNode, moveNode, addConnection, ...
  };
}
```

### 7.2 State Update Pattern

All node/connection modifications follow this pattern:

```typescript
const updateSomething = useCallback(() => {
  // 1. Save undo state
  saveUndoState();
  
  // 2. Update state
  setNodes(prev => {
    const updated = /* modify nodes */;
    // 3. Recompute all nodes
    return computeAllNodes(updated, connections);
  });
}, [connections, saveUndoState]);
```

### 7.3 Undo/Redo Implementation

```typescript
const saveUndoState = useCallback(() => {
  undoStack.current.push({
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: JSON.parse(JSON.stringify(connections)),
  });
  redoStack.current = [];  // Clear redo on new action
  if (undoStack.current.length > 100) {
    undoStack.current.shift();  // Limit stack size
  }
}, [nodes, connections]);

const undo = useCallback(() => {
  if (undoStack.current.length === 0) return;
  const state = undoStack.current.pop();
  redoStack.current.push({ nodes, connections });
  setNodes(state.nodes);
  setConnections(state.connections);
}, [nodes, connections]);
```

---

## 8. Panel System

### 8.1 Resizable Panels

Each panel has independent resize functionality:

```typescript
// Panel state
const [toolboxWidth, setToolboxWidth] = useState(250);
const [propertiesWidth, setPropertiesWidth] = useState(290);
const [excelHeight, setExcelHeight] = useState(200);

// Unified resize handling
const [resizing, setResizing] = useState<'toolbox' | 'properties' | 'excel' | null>(null);
const resizeStart = useRef({ x: 0, y: 0, size: 0 });

useEffect(() => {
  if (!resizing) return;
  
  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    
    if (resizing === 'toolbox') {
      setToolboxWidth(clamp(resizeStart.current.size + dx, 180, 500));
    } else if (resizing === 'properties') {
      setPropertiesWidth(clamp(resizeStart.current.size - dx, 200, 500));
    } else if (resizing === 'excel') {
      setExcelHeight(clamp(resizeStart.current.size - dy, 80, 600));
    }
  };
  
  const onUp = () => setResizing(null);
  
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  return () => { /* cleanup */ };
}, [resizing]);
```

### 8.2 Collapsible Panels

```typescript
const [toolboxOpen, setToolboxOpen] = useState(true);
const [propertiesOpen, setPropertiesOpen] = useState(true);

// When collapsed, show vertical tab
{toolboxOpen ? (
  <>
    <PanelHeader onToggle={() => setToolboxOpen(false)} />
    <Toolbox />
    <ResizeGrip />
  </>
) : (
  <CollapsedTab onClick={() => setToolboxOpen(true)} />
)}
```

---

## 9. Theming

### 9.1 Theme Structure

```typescript
type Theme = 'dark' | 'light' | 'grasshopper' | 'autocad';

const themeColors: Record<Theme, ThemeColors> = {
  dark: {
    bg: '#1a1a2e',
    gridColor: '#2a2a4a',
    nodeBg: '#16213e',
    nodeBorder: '#334155',
    text: '#e2e8f0',
    portBg: '#0f3460',
    connColor: '#60a5fa',
    selectedBorder: '#f59e0b',
    // ...
  },
  // ... other themes
};
```

### 9.2 Theme Application

Components receive theme via props and apply colors inline:

```typescript
function NodeCanvas({ theme, ... }) {
  const colors = themeColors[theme];
  
  return (
    <svg style={{ background: colors.bg }}>
      <rect fill={colors.nodeBg} stroke={colors.nodeBorder} />
      <text fill={colors.text}>...</text>
    </svg>
  );
}
```

---

## 10. File Format

### 10.1 Project File Structure (.snd.json)

```json
{
  "name": "Project Name",
  "version": "1.0",
  "created": "2024-01-01T00:00:00.000Z",
  "modified": "2024-01-02T00:00:00.000Z",
  "canvas": {
    "nodes": [
      {
        "id": "uuid-1",
        "type": "number_input",
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 64,
        "inputs": [
          { "id": "uuid-1-in-0", "name": "Value", "type": "number", "value": 100, "unit": "kN" }
        ],
        "outputs": [
          { "id": "uuid-1-out-0", "name": "Out", "type": "number", "value": 100 }
        ],
        "label": "Number",
        "category": "Inputs",
        "color": "#4CAF50",
        "collapsed": false,
        "selected": false,
        "computed": true
      }
    ],
    "connections": [
      {
        "id": "uuid-conn-1",
        "fromNodeId": "uuid-1",
        "fromPortId": "uuid-1-out-0",
        "toNodeId": "uuid-2",
        "toPortId": "uuid-2-in-0"
      }
    ],
    "zoom": 1,
    "panX": 0,
    "panY": 0
  },
  "theme": "dark",
  "customNodes": [
    {
      "id": "custom_123",
      "label": "My Formula",
      "description": "Custom calculation",
      "category": "Custom",
      "equations": ["Result = a + b * c"],
      "inputs": [
        { "name": "a", "defaultValue": 0, "unit": "" },
        { "name": "b", "defaultValue": 0, "unit": "" },
        { "name": "c", "defaultValue": 0, "unit": "" }
      ],
      "outputs": [
        { "name": "Result", "formula": "a + b * c", "unit": "" }
      ]
    }
  ]
}
```

---

## 11. Performance Considerations

### 11.1 Optimizations Implemented

| Optimization | Description |
|--------------|-------------|
| Memoization | useCallback for event handlers |
| Lazy Computation | Only recompute affected downstream nodes |
| SVG over Canvas | Better for interactive elements |
| Ref for Stacks | Undo/redo stacks don't trigger re-renders |
| Deep Clone for Undo | Prevents reference issues |

### 11.2 Future Optimizations

| Optimization | Benefit |
|--------------|---------|
| Virtualized Node Rendering | Handle 10,000+ nodes |
| Web Workers for Computation | Non-blocking calculations |
| Incremental Recomputation | Only update changed branches |
| Canvas API for Connections | Faster rendering of many connections |

---

## 12. Testing Strategy

### 12.1 Unit Tests (Planned)
- Formula parser: token, parse, evaluate
- Calculation engine: topological sort, compute
- Node definitions: each compute function

### 12.2 Integration Tests (Planned)
- Add/remove nodes
- Create/delete connections
- Save/load projects
- Undo/redo operations

### 12.3 E2E Tests (Planned)
- Complete workflows (demo project)
- Custom node creation
- Report generation

---

## 13. Security Considerations

### 13.1 Formula Execution Safety

The formula parser uses a custom evaluator (not `eval()`) to prevent code injection:

```typescript
// SAFE: Custom evaluator
function evaluate(ast: ASTNode, variables: Record<string, number>): number {
  switch (ast.type) {
    case 'number': return ast.value;
    case 'variable': return variables[ast.value];
    case 'binary': return applyOperator(ast.operator, left, right);
    // ...
  }
}

// UNSAFE (not used): eval()
// eval("return " + formula);  // Never do this!
```

### 13.2 File Handling

- JSON.parse with try/catch for error handling
- No execution of code from files
- Validation of expected structure

---

*Document maintained by the development team.*
