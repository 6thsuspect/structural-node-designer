# API Reference

## Structural Node Designer - Internal API Documentation

**Version:** 1.0

---

## Table of Contents

1. [Types & Interfaces](#1-types--interfaces)
2. [Node Definitions API](#2-node-definitions-api)
3. [Calculation Engine API](#3-calculation-engine-api)
4. [Formula Parser API](#4-formula-parser-api)
5. [useNodeEditor Hook](#5-usenodeeditor-hook)
6. [Component Props](#6-component-props)

---

## 1. Types & Interfaces

### 1.1 Core Types

```typescript
// src/types.ts

export type PortType = 'number' | 'string' | 'boolean' | 'any';

export type Theme = 'dark' | 'light' | 'grasshopper' | 'autocad';
```

### 1.2 Port Interface

```typescript
export interface Port {
  id: string;           // Unique identifier: "{nodeId}-in-{index}"
  name: string;         // Display name
  type: PortType;       // Data type
  value?: any;          // Current value
  connected?: boolean;  // Has incoming connection
  unit?: string;        // Unit label (mm, kN, MPa)
}
```

### 1.3 Node Definition Interface

```typescript
export interface NodeDefinition {
  type: string;         // Unique type identifier
  category: string;     // Toolbox category
  subcategory?: string; // Optional subcategory
  label: string;        // Display name
  description?: string; // Help text
  inputs: Omit<Port, 'id' | 'connected'>[];
  outputs: Omit<Port, 'id' | 'connected'>[];
  compute: (inputs: Record<string, any>) => Record<string, any>;
  color?: string;       // Header color (hex)
  icon?: string;        // Emoji or icon character
}
```

### 1.4 Canvas Node Interface

```typescript
export interface CanvasNode {
  id: string;           // UUID
  type: string;         // References NodeDefinition.type
  x: number;            // X position on canvas
  y: number;            // Y position on canvas
  width: number;        // Node width in pixels
  height: number;       // Node height in pixels
  inputs: Port[];       // Input ports with values
  outputs: Port[];      // Output ports with values
  label: string;        // Display name
  category: string;     // Category name
  color: string;        // Header color
  collapsed: boolean;   // UI collapsed state
  selected: boolean;    // Selection state
  computed: boolean;    // Computation success flag
  error?: string;       // Error message if failed
}
```

### 1.5 Connection Interface

```typescript
export interface Connection {
  id: string;           // UUID
  fromNodeId: string;   // Source node ID
  fromPortId: string;   // Source port ID
  toNodeId: string;     // Target node ID
  toPortId: string;     // Target port ID
}
```

### 1.6 Canvas State Interface

```typescript
export interface CanvasState {
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;
  panX: number;
  panY: number;
}
```

### 1.7 Project File Interface

```typescript
export interface ProjectFile {
  name: string;
  version: string;
  created: string;      // ISO date string
  modified: string;     // ISO date string
  canvas: CanvasState;
  theme: Theme;
  customNodes?: CustomNodeData[];
}
```

### 1.8 Connecting State Interface

```typescript
export interface ConnectingState {
  isConnecting: boolean;
  fromNodeId?: string;
  fromPortId?: string;
  fromIsOutput?: boolean;
  mouseX: number;
  mouseY: number;
}
```

### 1.9 Undo Action Interface

```typescript
export interface UndoAction {
  nodes: CanvasNode[];
  connections: Connection[];
}
```

---

## 2. Node Definitions API

### 2.1 Module: `src/nodeDefinitions.ts`

#### Constants

```typescript
// Category color mapping
export const CATEGORY_COLORS: Record<string, string> = {
  'Inputs': '#4CAF50',
  'Outputs': '#FF9800',
  'Math': '#2196F3',
  'Logic': '#9C27B0',
  'Excel': '#217346',
  'Structural': '#F44336',
  'Steel': '#607D8B',
  'RCC': '#795548',
  'Bridge': '#E91E63',
  'Loads': '#FF5722',
  'Materials': '#009688',
  'Section': '#3F51B5',
  'Custom': '#00BCD4',
};

// Category icon mapping
export const CATEGORY_ICONS: Record<string, string> = {
  'Inputs': '📥',
  'Outputs': '📤',
  'Math': '🔢',
  // ... etc
};

// Built-in node definitions array
export const nodeDefinitions: NodeDefinition[];
```

#### Functions

```typescript
/**
 * Get a node definition by type
 * @param type - Node type identifier
 * @returns NodeDefinition or undefined
 */
export function getNodeDefinition(type: string): NodeDefinition | undefined;

/**
 * Get all unique categories
 * @returns Array of category names
 */
export function getCategories(): string[];

/**
 * Get all nodes in a specific category
 * @param category - Category name
 * @returns Array of NodeDefinitions
 */
export function getNodesByCategory(category: string): NodeDefinition[];

/**
 * Get all nodes (built-in + custom)
 * @returns Array of all NodeDefinitions
 */
export function getAllNodes(): NodeDefinition[];

/**
 * Register a custom node definition
 * @param node - NodeDefinition to register
 */
export function registerCustomNode(node: NodeDefinition): void;

/**
 * Remove a custom node by type
 * @param type - Node type to remove
 */
export function removeCustomNode(type: string): void;

/**
 * Get all custom nodes
 * @returns Array of custom NodeDefinitions
 */
export function getCustomNodes(): NodeDefinition[];

/**
 * Clear all custom nodes
 */
export function clearCustomNodes(): void;
```

---

## 3. Calculation Engine API

### 3.1 Module: `src/engine.ts`

#### Functions

```typescript
/**
 * Topologically sort nodes based on connections
 * Returns nodes in execution order (dependencies first)
 * 
 * @param nodes - Array of canvas nodes
 * @param connections - Array of connections
 * @returns Array of node IDs in execution order
 * 
 * @example
 * const order = topologicalSort(nodes, connections);
 * // order = ['input-1', 'input-2', 'add-1', 'output-1']
 */
export function topologicalSort(
  nodes: CanvasNode[],
  connections: Connection[]
): string[];

/**
 * Detect if the graph has circular references
 * 
 * @param nodes - Array of canvas nodes
 * @param connections - Array of connections
 * @returns true if circular reference exists
 */
export function detectCircularReferences(
  nodes: CanvasNode[],
  connections: Connection[]
): boolean;

/**
 * Compute all nodes in dependency order
 * Propagates values through connections and executes compute functions
 * 
 * @param nodes - Array of canvas nodes
 * @param connections - Array of connections
 * @returns New array of nodes with computed values
 * 
 * @example
 * const computedNodes = computeAllNodes(nodes, connections);
 */
export function computeAllNodes(
  nodes: CanvasNode[],
  connections: Connection[]
): CanvasNode[];
```

---

## 4. Formula Parser API

### 4.1 Module: `src/formulaParser.ts`

#### Functions

```typescript
/**
 * Parse a mathematical formula and return an evaluation function
 * 
 * @param formula - Mathematical expression string
 * @returns Function that takes variables and returns result
 * 
 * @example
 * const fn = parseFormula('b * d^2 / 6');
 * const result = fn({ b: 300, d: 500 }); // 12500000
 */
export function parseFormula(
  formula: string
): (variables: Record<string, number>) => number;

/**
 * Validate formula syntax and check variable references
 * 
 * @param formula - Mathematical expression string
 * @param inputNames - Array of valid variable names
 * @returns Validation result with error message if invalid
 * 
 * @example
 * const result = validateFormula('a + b', ['a', 'b']);
 * // { valid: true }
 * 
 * const result2 = validateFormula('a + c', ['a', 'b']);
 * // { valid: false, error: 'Unknown variable: c' }
 */
export function validateFormula(
  formula: string,
  inputNames: string[]
): { valid: boolean; error?: string };

/**
 * Extract all variable names from a formula
 * 
 * @param formula - Mathematical expression string
 * @returns Array of variable names found
 * 
 * @example
 * const vars = extractVariables('a * b + sqrt(c)');
 * // ['a', 'b', 'c']
 */
export function extractVariables(formula: string): string[];
```

#### Supported Syntax

| Category | Elements |
|----------|----------|
| **Operators** | `+`, `-`, `*`, `/`, `^`, `(`, `)` |
| **Functions** | `sqrt`, `abs`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `log`, `log10`, `exp`, `min`, `max`, `pow`, `round`, `floor`, `ceil`, `sign` |
| **Constants** | `pi`, `PI`, `e`, `E` |

---

## 5. useNodeEditor Hook

### 5.1 Module: `src/hooks/useNodeEditor.ts`

#### Return Type

```typescript
function useNodeEditor(): {
  // State
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;
  panX: number;
  panY: number;
  connecting: ConnectingState;
  selectedNodeId: string | null;
  theme: Theme;
  searchQuery: string;

  // State Setters
  setZoom: (zoom: number) => void;
  setPanX: (x: number) => void;
  setPanY: (y: number) => void;
  setTheme: (theme: Theme) => void;
  setSearchQuery: (query: string) => void;
  setNodes: (nodes: CanvasNode[]) => void;

  // Node Actions
  addNode: (type: string, x: number, y: number) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  updateNodeInput: (nodeId: string, portId: string, value: any) => void;
  selectNode: (nodeId: string | null) => void;
  duplicateNode: (nodeId: string) => void;

  // Connection Actions
  addConnection: (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ) => void;
  removeConnection: (connId: string) => void;
  startConnecting: (
    nodeId: string,
    portId: string,
    isOutput: boolean,
    mx: number,
    my: number
  ) => void;
  updateConnecting: (mx: number, my: number) => void;
  finishConnecting: (toNodeId?: string, toPortId?: string) => void;

  // Project Actions
  clearAll: () => void;
  saveProject: () => void;
  loadProject: (json: string) => void;

  // History Actions
  undo: () => void;
  redo: () => void;

  // Utility Actions
  recompute: () => void;
  searchNodes: (query: string) => NodeDefinition[];
  generateReport: () => void;
};
```

#### Usage Example

```typescript
import { useNodeEditor } from './hooks/useNodeEditor';

function MyComponent() {
  const editor = useNodeEditor();

  // Add a node
  const handleAddNode = () => {
    editor.addNode('add', 100, 100);
  };

  // Update an input value
  const handleUpdateValue = (nodeId: string, portId: string) => {
    editor.updateNodeInput(nodeId, portId, 42);
  };

  // Save project
  const handleSave = () => {
    editor.saveProject(); // Downloads .snd.json file
  };

  return (
    <NodeCanvas
      nodes={editor.nodes}
      connections={editor.connections}
      zoom={editor.zoom}
      onMoveNode={editor.moveNode}
      // ... etc
    />
  );
}
```

---

## 6. Component Props

### 6.1 NodeCanvas Props

```typescript
interface NodeCanvasProps {
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;
  panX: number;
  panY: number;
  connecting: ConnectingState;
  selectedNodeId: string | null;
  theme: Theme;
  
  // Callbacks
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartConnecting: (
    nodeId: string,
    portId: string,
    isOutput: boolean,
    mx: number,
    my: number
  ) => void;
  onUpdateConnecting: (mx: number, my: number) => void;
  onFinishConnecting: (nodeId?: string, portId?: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRemoveConnection: (connId: string) => void;  // NEW
  onUpdateInput: (nodeId: string, portId: string, value: any) => void;
  onZoomChange: (zoom: number) => void;
  onPanChange: (x: number, y: number) => void;
  onDropNode: (type: string, x: number, y: number) => void;
}
```

### 6.2 Toolbox Props

```typescript
interface ToolboxProps {
  theme: Theme;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateCustom?: () => void;    // Open advanced editor
  onQuickFormula?: () => void;    // Open quick formula modal
}
```

### 6.3 PropertiesPanel Props

```typescript
interface PropertiesPanelProps {
  node: CanvasNode | null;
  connections: Connection[];
  theme: Theme;
  onUpdateInput: (nodeId: string, portId: string, value: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
}
```

### 6.4 Toolbar Props

```typescript
interface ToolbarProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onLoadDemo: () => void;
  onCreateCustomNode: () => void;
  onQuickFormula: () => void;
  onSettings: () => void;  // NEW
}
```

### 6.5 ExcelPreview Props

```typescript
interface ExcelPreviewProps {
  nodes: CanvasNode[];
  connections: Connection[];
  theme: Theme;
}
```

### 6.6 QuickFormulaModal Props

```typescript
interface QuickFormulaModalProps {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
  onSave: (nodeData: QuickNodeData) => void;
  editingNode?: QuickNodeData | null;
}

interface QuickNodeData {
  id: string;
  label: string;
  description: string;
  category: string;
  equations: string[];
  inputs: { name: string; defaultValue: number; unit: string }[];
  outputs: { name: string; formula: string; unit: string }[];
}
```

### 6.7 SettingsModal Props (NEW)

```typescript
interface SettingsModalProps {
  isOpen: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
  onClearAll: () => void;
}
```

Three tabs: General (shortcuts, tips, clear), Theme (visual selector), About (version info).

### 6.8 CustomFormulaModal Props

```typescript
interface CustomFormulaModalProps {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
  onSave: (nodeData: CustomNodeData) => void;
  editingNode?: CustomNodeData | null;
}

interface CustomNodeData {
  id: string;
  label: string;
  description: string;
  category: string;
  inputs: { name: string; defaultValue: number; unit: string }[];
  outputs: { name: string; formula: string; unit: string }[];
}
```

---

## 7. Creating Custom Node Definitions

### 7.1 Example: Simple Math Node

```typescript
const myNode: NodeDefinition = {
  type: 'my_multiply',
  category: 'Math',
  label: 'My Multiply',
  description: 'Multiplies A × B × C',
  inputs: [
    { name: 'A', type: 'number', value: 1 },
    { name: 'B', type: 'number', value: 1 },
    { name: 'C', type: 'number', value: 1 },
  ],
  outputs: [
    { name: 'Result', type: 'number' },
  ],
  compute: (inputs) => ({
    Result: inputs.A * inputs.B * inputs.C,
  }),
  icon: '✖️',
};

// Register it
registerCustomNode(myNode);
```

### 7.2 Example: Engineering Node with Multiple Outputs

```typescript
const steelSection: NodeDefinition = {
  type: 'steel_tube',
  category: 'Section',
  label: 'Circular Hollow Section',
  description: 'Properties of CHS',
  inputs: [
    { name: 'D', type: 'number', value: 200, unit: 'mm' },
    { name: 't', type: 'number', value: 10, unit: 'mm' },
  ],
  outputs: [
    { name: 'Area', type: 'number', unit: 'mm²' },
    { name: 'Ix', type: 'number', unit: 'mm⁴' },
    { name: 'Zx', type: 'number', unit: 'mm³' },
  ],
  compute: (inputs) => {
    const D = inputs.D;
    const t = inputs.t;
    const d = D - 2 * t;
    const Area = Math.PI * (D * D - d * d) / 4;
    const Ix = Math.PI * (Math.pow(D, 4) - Math.pow(d, 4)) / 64;
    const Zx = Ix / (D / 2);
    return { Area, Ix, Zx };
  },
  color: '#607D8B',
  icon: '⭕',
};
```

---

*API documentation for Structural Node Designer v1.0*
