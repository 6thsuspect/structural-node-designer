# Development Guide

## Structural Node Designer

**Version:** 1.0  
**For:** Developers, Contributors

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Project Structure](#2-project-structure)
3. [Development Workflow](#3-development-workflow)
4. [Adding New Nodes](#4-adding-new-nodes)
5. [Modifying the UI](#5-modifying-the-ui)
6. [Testing](#6-testing)
7. [Code Style](#7-code-style)
8. [Common Tasks](#8-common-tasks)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Getting Started

### 1.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| npm | 9+ | Package manager |
| VS Code | Latest | Recommended IDE |

### 1.2 Setup

```bash
# Clone the repository
git clone <repository-url>
cd structural-node-designer

# Install dependencies
npm install

# Start development server
npm run dev
```

### 1.3 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

### 1.4 Recommended VS Code Extensions

- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript Vue Plugin (Volar)** - TS support
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

---

## 2. Project Structure

```
structural-node-designer/
├── docs/                      # Documentation
│   ├── PRD.md                 # Product requirements
│   ├── TECHNICAL_DESIGN.md    # Technical design
│   ├── USER_GUIDE.md          # User documentation
│   ├── API_REFERENCE.md       # API documentation
│   ├── ARCHITECTURE.md        # Architecture overview
│   ├── DEVELOPMENT_GUIDE.md   # This file
│   └── CHANGELOG.md           # Version history
│
├── public/                    # Static assets
│
├── src/
│   ├── components/            # React components
│   │   ├── NodeCanvas.tsx     # Main canvas (SVG + connection menus)
│   │   ├── Toolbox.tsx        # Node library panel
│   │   ├── PropertiesPanel.tsx# Node inspector
│   │   ├── Toolbar.tsx        # Top ribbon (with ⚙️ Settings)
│   │   ├── SettingsModal.tsx  # Settings dialog (NEW)
│   │   ├── CustomFormulaModal.tsx  # Advanced editor
│   │   └── QuickFormulaModal.tsx   # Simple editor
│   │
│   ├── hooks/
│   │   └── useNodeEditor.ts   # Central state hook
│   │
│   ├── App.tsx                # Main application
│   ├── types.ts               # TypeScript types
│   ├── nodeDefinitions.ts     # Node library
│   ├── engine.ts              # Calculation engine
│   ├── formulaParser.ts       # Formula parser
│   ├── demoWorkflow.ts        # Demo project
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
│
├── index.html                 # HTML template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
└── README.md                  # Project readme
```

---

## 3. Development Workflow

### 3.1 Feature Development

```
1. Understand requirements
   └── Read PRD.md and relevant docs

2. Plan implementation
   └── Identify affected files
   └── Design data structures
   └── Plan UI changes

3. Implement
   └── Start with types (types.ts)
   └── Add node definitions if needed
   └── Modify components
   └── Update state management

4. Test
   └── Manual testing
   └── Test edge cases
   └── Test with demo workflow

5. Document
   └── Update relevant docs
   └── Add to CHANGELOG.md
```

### 3.2 Hot Module Replacement

Vite provides instant HMR. When you save a file:
- Components: Re-rendered without page reload
- Styles: Instantly updated
- State: Preserved when possible

### 3.3 Build Process

```bash
npm run build
```

Output:
- `dist/index.html` - Single self-contained HTML file
- All JS/CSS inlined (via vite-plugin-singlefile)

---

## 4. Adding New Nodes

### 4.1 Simple Node (No New Logic)

Add to `src/nodeDefinitions.ts`:

```typescript
{
  type: 'unique_type_id',        // Lowercase, underscore
  category: 'Category',           // Existing or new category
  label: 'Display Name',
  description: 'What this node does',
  inputs: [
    { name: 'A', type: 'number', value: 0, unit: 'mm' },
    { name: 'B', type: 'number', value: 0, unit: 'mm' },
  ],
  outputs: [
    { name: 'Result', type: 'number', unit: 'mm²' },
  ],
  compute: (inputs) => ({
    Result: inputs.A * inputs.B,
  }),
  icon: '📐',  // Emoji or character
},
```

### 4.2 Node with Complex Logic

```typescript
{
  type: 'complex_calculation',
  category: 'Steel',
  label: 'Complex Calc',
  description: 'Multi-step calculation',
  inputs: [
    { name: 'Fy', type: 'number', value: 250, unit: 'MPa' },
    { name: 'Zp', type: 'number', value: 0, unit: 'mm³' },
    { name: 'γm0', type: 'number', value: 1.1 },
  ],
  outputs: [
    { name: 'Mp', type: 'number', unit: 'Nmm' },
    { name: 'Md', type: 'number', unit: 'Nmm' },
    { name: 'Status', type: 'string' },
  ],
  compute: (inputs) => {
    const fy = Number(inputs.Fy) || 0;
    const zp = Number(inputs.Zp) || 0;
    const gm = Number(inputs['γm0']) || 1.1;
    
    const mp = fy * zp;
    const md = mp / gm;
    
    return {
      Mp: Math.round(mp),
      Md: Math.round(md),
      Status: md > 0 ? 'OK' : 'Check inputs',
    };
  },
  color: '#607D8B',  // Custom header color
  icon: 'Mp',
},
```

### 4.3 Adding a New Category

1. Add color to `CATEGORY_COLORS`:
```typescript
CATEGORY_COLORS['NewCategory'] = '#FF5722';
```

2. Add icon to `CATEGORY_ICONS`:
```typescript
CATEGORY_ICONS['NewCategory'] = '🆕';
```

3. Add nodes with `category: 'NewCategory'`

### 4.4 Node Guidelines

| Guideline | Reason |
|-----------|--------|
| Always handle `null`/`undefined` inputs | Prevents NaN results |
| Use `Number()` for numeric inputs | Converts strings |
| Round appropriately | Clean output values |
| Return all declared outputs | Prevents undefined |
| Use descriptive port names | User clarity |
| Include units | Engineering context |

---

## 5. Modifying the UI

### 5.1 Component Structure

```typescript
function MyComponent({ prop1, prop2, theme }: Props) {
  // Theme-based colors
  const colors = themeColors[theme];
  
  // Local state
  const [localState, setLocalState] = useState(initial);
  
  // Event handlers
  const handleClick = useCallback(() => {
    // ...
  }, [dependencies]);
  
  return (
    <div style={{ background: colors.bg }}>
      {/* Content */}
    </div>
  );
}
```

### 5.2 Styling Approach

This project uses:
- **Tailwind CSS** for utility classes
- **Inline styles** for dynamic theme colors

```tsx
// Tailwind for layout/spacing
<div className="flex items-center gap-2 px-3 py-2">

// Inline for theme-dependent colors
<div style={{ background: colors.bg, color: colors.text }}>

// Combined
<div
  className="flex items-center rounded-lg transition-all"
  style={{ background: colors.nodeBg }}
>
```

### 5.3 Adding a Theme

1. Add to `Theme` type in `types.ts`:
```typescript
export type Theme = 'dark' | 'light' | 'grasshopper' | 'autocad' | 'myTheme';
```

2. Add colors to all `themeColors` objects:
```typescript
const themeColors: Record<Theme, ThemeColors> = {
  // ... existing themes
  myTheme: {
    bg: '#hexcolor',
    text: '#hexcolor',
    // ... all required colors
  },
};
```

3. Add option to theme selector in Toolbar.

### 5.4 Adding a New Panel

1. Add state in `App.tsx`:
```typescript
const [showMyPanel, setShowMyPanel] = useState(true);
const [myPanelSize, setMyPanelSize] = useState(200);
```

2. Create component:
```typescript
// src/components/MyPanel.tsx
export default function MyPanel({ theme, ... }: Props) {
  return (
    <div>...</div>
  );
}
```

3. Add to layout in `App.tsx`.

---

## 6. Testing

### 6.1 Manual Testing Checklist

**Node Operations:**
- [ ] Add node via drag-and-drop
- [ ] Select node
- [ ] Move node
- [ ] Delete node (Delete key)
- [ ] Delete node (context menu)
- [ ] Duplicate node

**Connections:**
- [ ] Create connection (output → input)
- [ ] Value propagates correctly
- [ ] Cannot connect input → input
- [ ] Cannot self-connect

**Values:**
- [ ] Edit value on canvas
- [ ] Edit value in Properties
- [ ] Values recompute on change

**Project:**
- [ ] Save project
- [ ] Load project
- [ ] Load demo workflow
- [ ] Clear all

**Custom Nodes:**
- [ ] Quick Formula creation
- [ ] Advanced editor creation
- [ ] Custom node appears in toolbox
- [ ] Custom node works when placed
- [ ] Custom nodes saved with project

**UI:**
- [ ] Collapse/expand panels
- [ ] Resize panels
- [ ] Pan canvas
- [ ] Zoom canvas
- [ ] Theme switching

### 6.2 Edge Cases to Test

| Case | Expected Behavior |
|------|-------------------|
| Division by zero | Returns 0 or Infinity |
| Circular reference | Partial computation |
| Very large numbers | Handles gracefully |
| Empty formula | Shows error |
| Invalid formula syntax | Shows error message |
| Rapid clicking | No race conditions |
| Large project (100+ nodes) | Acceptable performance |

---

## 7. Code Style

### 7.1 TypeScript Guidelines

```typescript
// ✅ Explicit types for function parameters
function calculate(a: number, b: number): number {
  return a + b;
}

// ✅ Interface for object shapes
interface NodeProps {
  id: string;
  x: number;
  y: number;
}

// ✅ Const for immutable data
const CATEGORIES = ['Math', 'Logic'] as const;

// ✅ Use optional chaining
const value = node?.inputs?.[0]?.value;

// ✅ Nullish coalescing
const num = inputs.value ?? 0;
```

### 7.2 React Guidelines

```typescript
// ✅ Functional components
function MyComponent(props: Props) { }

// ✅ useCallback for handlers passed as props
const handleClick = useCallback(() => {
  // ...
}, [dependencies]);

// ✅ Destructure props
function Button({ label, onClick }: ButtonProps) { }

// ✅ Key prop for lists
{items.map(item => (
  <Item key={item.id} {...item} />
))}
```

### 7.3 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `NodeCanvas.tsx` |
| Hooks | camelCase with `use` | `useNodeEditor` |
| Event handlers | `handle` prefix | `handleClick` |
| Callbacks (props) | `on` prefix | `onClick` |
| Constants | UPPER_SNAKE | `MAX_NODES` |
| Types | PascalCase | `CanvasNode` |
| Files | PascalCase (components) | `NodeCanvas.tsx` |
| Files | camelCase (utilities) | `engine.ts` |

---

## 8. Common Tasks

### 8.1 Add a New Math Function to Parser

Edit `src/formulaParser.ts`:

```typescript
const FUNCTIONS: Record<string, (args: number[]) => number> = {
  // ... existing functions
  'myFunc': (args) => {
    // args[0] is first argument, etc.
    return Math.someOperation(args[0]);
  },
};
```

### 8.2 Add a New Input Type

1. Add to `PortType` in `types.ts`:
```typescript
export type PortType = 'number' | 'string' | 'boolean' | 'any' | 'myType';
```

2. Handle in NodeCanvas port rendering.

3. Handle in PropertiesPanel input rendering.

### 8.3 Modify Connection Appearance

Edit `src/components/NodeCanvas.tsx`:

```typescript
// Find renderConnection function
const renderConnection = (conn: Connection) => {
  // Modify path styling here
  return (
    <path
      d={bezierPath(...)}
      stroke={colors.connColor}
      strokeWidth={3}  // Change width
      strokeDasharray="5,5"  // Add dashes
    />
  );
};
```

### 8.4 Add Keyboard Shortcut

Edit `App.tsx`:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Existing shortcuts...
    
    // Add new shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      setShowQuickFormulaModal(true);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### 8.5 Export to Different Format

```typescript
// Add to useNodeEditor or App
const exportToCSV = useCallback(() => {
  let csv = 'Node,Type,Input,Value,Output,Value\n';
  
  nodes.forEach(node => {
    node.inputs.forEach(input => {
      csv += `${node.label},${node.type},${input.name},${input.value},,\n`;
    });
    node.outputs.forEach(output => {
      csv += `${node.label},${node.type},,,${output.name},${output.value}\n`;
    });
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  // ... download
}, [nodes]);
```

---

## 9. Troubleshooting

### 9.1 Common Issues

| Issue | Solution |
|-------|----------|
| Node not appearing in toolbox | Check category spelling, rebuild |
| Compute function not called | Check connections, ensure compute returns all outputs |
| Values showing NaN | Add null checks in compute function |
| Undo not working | Ensure saveUndoState() called before mutation |
| Theme colors not applying | Check all theme objects have the color key |

### 9.2 Debugging Tips

```typescript
// Log node computation
compute: (inputs) => {
  console.log('Computing with inputs:', inputs);
  const result = /* ... */;
  console.log('Result:', result);
  return result;
},

// Log state changes
useEffect(() => {
  console.log('Nodes updated:', nodes);
}, [nodes]);

// Check connection flow
console.log('Connections:', connections);
```

### 9.3 Performance Issues

If canvas is slow:
1. Check node count (aim for <500 for best performance)
2. Reduce console.log statements
3. Check for unnecessary re-renders (React DevTools)
4. Consider memoizing expensive computations

### 9.4 Build Errors

| Error | Solution |
|-------|----------|
| Type error | Check interface definitions |
| Import error | Check file paths, case sensitivity |
| Unused variable | Remove or prefix with `_` |
| Missing dependency | `npm install <package>` |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following this guide
4. Test thoroughly
5. Update documentation
6. Submit pull request

---

*Happy coding! 🚀*
