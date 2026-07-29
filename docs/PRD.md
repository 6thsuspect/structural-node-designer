# Product Requirements Document (PRD)

## Structural Node Designer for Excel (SND-Excel)

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** In Development  
**Platform:** Web Application (React + TypeScript)

---

## 1. Executive Summary

### 1.1 Vision
Develop a professional visual programming environment that works similarly to Rhino Grasshopper, allowing structural engineers to create calculation workflows by connecting graphical nodes instead of writing complex formulas.

### 1.2 Problem Statement
Structural engineers currently face several challenges:
- Complex nested Excel formulas are difficult to write, debug, and maintain
- Calculation workflows are not visually intuitive
- Reusing calculation templates requires copy-pasting entire spreadsheets
- No standardized way to document calculation logic
- Difficulty in ensuring code compliance across projects

### 1.3 Solution
A node-based visual programming interface that:
- Replaces formula writing with drag-and-drop visual programming
- Provides pre-built nodes for common structural engineering calculations
- Supports Indian codes (IS, IRC, IRS), Eurocodes, AASHTO, and custom equations
- Generates professional calculation reports automatically
- Allows creation of reusable custom nodes and templates

---

## 2. Objectives & Success Metrics

### 2.1 Primary Objectives
| Objective | Description | Success Metric |
|-----------|-------------|----------------|
| Eliminate Complex Formulas | Replace nested Excel formulas with visual nodes | 80% reduction in formula complexity |
| Improve Productivity | Reduce time to create calculation sheets | 50% faster workflow creation |
| Ensure Code Compliance | Built-in design code libraries | 100% code-compliant calculations |
| Enable Reusability | Custom node and template creation | 90% of workflows using reusable components |
| Auto-Documentation | Automatic report generation | Zero manual documentation effort |

### 2.2 Key Performance Indicators (KPIs)
- User adoption rate within target organizations
- Average time to create a calculation workflow
- Number of custom nodes created per user
- Report generation frequency
- Error rate in calculations (should be near zero)

---

## 3. Target Users

### 3.1 Primary Users
| User Type | Description | Key Needs |
|-----------|-------------|-----------|
| Structural Engineers | Design buildings, bridges, industrial structures | Fast, accurate structural calculations |
| Bridge Engineers | Specialize in bridge design and analysis | IRC/IRS code compliance, load combinations |
| Steel Designers | Focus on steel connections and members | IS 800 compliance, bolt/weld design |
| RCC Designers | Reinforced concrete design specialists | IS 456 compliance, flexure/shear checks |
| Consultants | Provide engineering services to clients | Professional reports, reusable templates |
| Engineering Students | Learning structural engineering | Visual understanding of calculations |
| Researchers | Academic and R&D professionals | Custom formula creation, optimization |

### 3.2 Target Industries
- Infrastructure & Construction
- Railways & Metro Projects
- Commercial & Residential Buildings
- Industrial Structures
- Oil & Gas Facilities
- Power Plants
- Bridge & Highway Engineering

---

## 4. Functional Requirements

### 4.1 Core Features (MVP - Phase 1)

#### 4.1.1 Visual Node Editor
| ID | Requirement | Priority |
|----|-------------|----------|
| F1.1 | Drag-and-drop node placement | P0 |
| F1.2 | Node connection via ports | P0 |
| F1.3 | Pan and zoom canvas navigation | P0 |
| F1.4 | Node selection and deletion | P0 |
| F1.5 | Undo/Redo functionality | P0 |
| F1.6 | Real-time value display on ports | P0 |
| F1.7 | In-place value editing on nodes | P0 |

#### 4.1.2 Node Library
| ID | Requirement | Priority |
|----|-------------|----------|
| F2.1 | Input nodes (Number, Width, Depth, Load, etc.) | P0 |
| F2.2 | Math nodes (Add, Subtract, Multiply, Divide, etc.) | P0 |
| F2.3 | Logic nodes (IF, AND, OR, Compare, etc.) | P0 |
| F2.4 | Output/Display nodes | P0 |
| F2.5 | Searchable node toolbox | P0 |
| F2.6 | Category-based organization | P0 |
| F2.7 | Excel-like nodes (SUM, COUNT, AVERAGE, VLOOKUP, IF, SUMIFS) | P0 |

#### 4.1.3 Calculation Engine
| ID | Requirement | Priority |
|----|-------------|----------|
| F3.1 | Live calculation on input change | P0 |
| F3.2 | Dependency graph resolution | P0 |
| F3.3 | Circular reference detection and prevention (block cyclic connections) | P0 |
| F3.4 | Error handling and display | P0 |
| F3.5 | Connection wire click menu (delete connection) | P0 |

#### 4.1.4 Project Management
| ID | Requirement | Priority |
|----|-------------|----------|
| F4.1 | Save project to JSON file | P0 |
| F4.2 | Load project from file | P0 |
| F4.3 | Auto-save functionality | P1 |

### 4.2 Engineering Features (Phase 2)

#### 4.2.1 Structural Engineering Nodes
| ID | Requirement | Priority |
|----|-------------|----------|
| F5.1 | Section property calculations (Area, Ix, Zx, etc.) | P0 |
| F5.2 | Steel design nodes (IS 800) | P0 |
| F5.3 | RCC design nodes (IS 456) | P0 |
| F5.4 | Load combination nodes | P0 |
| F5.5 | Material property nodes | P0 |

#### 4.2.2 Design Code Libraries
| ID | Requirement | Priority |
|----|-------------|----------|
| F6.1 | IS 800 (Steel) | P0 |
| F6.2 | IS 456 (Concrete) | P0 |
| F6.3 | IS 875 (Loads) | P1 |
| F6.4 | IS 1893 (Seismic) | P1 |
| F6.5 | IRC 6, 21, 22, 24, 112 (Bridges) | P1 |

#### 4.2.3 Custom Formula System
| ID | Requirement | Priority |
|----|-------------|----------|
| F7.1 | Quick Formula input (equation parsing) | P0 |
| F7.2 | Advanced custom node editor | P0 |
| F7.3 | Auto-detection of input variables | P0 |
| F7.4 | Formula validation | P0 |
| F7.5 | Save/load custom nodes with project | P0 |

#### 4.2.4 Report Generation
| ID | Requirement | Priority |
|----|-------------|----------|
| F8.1 | Markdown report export | P0 |
| F8.2 | PDF report export | P1 |
| F8.3 | Include inputs, equations, results | P0 |
| F8.4 | Code reference citations | P1 |

### 4.3 Advanced Features (Phase 3)

#### 4.3.1 AI Assistant
| ID | Requirement | Priority |
|----|-------------|----------|
| F9.1 | Formula explanation | P2 |
| F9.2 | Node suggestions | P2 |
| F9.3 | Error diagnosis | P2 |
| F9.4 | Design optimization | P2 |

#### 4.3.2 Integration
| ID | Requirement | Priority |
|----|-------------|----------|
| F10.1 | Excel file import/export | P1 |
| F10.2 | STAAD model import | P2 |
| F10.3 | AutoCAD integration | P2 |
| F10.4 | Revit/BIM integration | P2 |

---

## 5. Non-Functional Requirements

### 5.1 Performance
| Requirement | Specification |
|-------------|---------------|
| Node Support | 10,000+ nodes per project |
| Calculation Speed | < 100ms for medium projects (500 nodes) |
| Canvas Rendering | 60 FPS during pan/zoom |
| File Size | < 5MB for typical project files |

### 5.2 Usability
| Requirement | Specification |
|-------------|---------------|
| Learning Curve | < 1 hour to basic proficiency |
| Accessibility | Keyboard navigation support |
| Responsiveness | Works on 1280×720 and above |
| Themes | Dark, Light, Grasshopper, AutoCAD styles |

### 5.3 Reliability
| Requirement | Specification |
|-------------|---------------|
| Calculation Accuracy | IEEE 754 double precision |
| Auto-save | Every 30 seconds |
| Undo History | Unlimited levels |
| Error Recovery | Graceful degradation on errors |

### 5.4 Security
| Requirement | Specification |
|-------------|---------------|
| Data Storage | Local browser/file system only (MVP) |
| No External Calls | Fully offline capable |
| Code Integrity | Formula validation before execution |

---

## 6. User Interface Requirements

### 6.1 Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│                        Toolbar/Ribbon                        │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│ Toolbox  │           Canvas                 │  Properties   │
│ (Nodes)  │        (Node Editor)             │   Panel       │
│          │                                  │               │
│          ├──────────────────────────────────┤               │
│          │       Excel Preview              │               │
└──────────┴──────────────────────────────────┴───────────────┘
```

### 6.2 Panel Behavior
| Panel | Default State | Behavior |
|-------|---------------|----------|
| Toolbox | Open (250px) | Collapsible, resizable 180-500px |
| Properties | Open (290px) | Collapsible, resizable 200-500px |
| Excel Preview | Open (200px) | Collapsible, resizable 80-600px |
| All Panels | — | Independent toggle via hamburger icon |

### 6.3 Interaction Patterns
| Action | Trigger |
|--------|---------|
| Add Node | Drag from toolbox to canvas |
| Connect Nodes | Click-drag from output port to input port |
| Edit Value | Click on port value or use Properties panel |
| Pan Canvas | Alt+Drag or Middle-mouse drag |
| Zoom | Mouse scroll wheel |
| Select Node | Click on node |
| Delete Node | Select + Delete key, or context menu |
| Multi-select | Ctrl+Click or selection box |

---

## 7. Technical Architecture

### 7.1 Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend Framework | React 19 |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 4 |
| Build Tool | Vite 7 |
| State Management | React Hooks (useState, useCallback, useRef) |
| Canvas Rendering | SVG |
| Formula Parsing | Custom recursive descent parser |

### 7.2 Key Components
```
src/
├── App.tsx                    # Main application layout
├── types.ts                   # TypeScript interfaces
├── nodeDefinitions.ts         # 60+ built-in node definitions
├── engine.ts                  # Calculation engine
├── formulaParser.ts           # Custom formula parser
├── hooks/
│   └── useNodeEditor.ts       # Central state management
├── components/
│   ├── NodeCanvas.tsx         # SVG-based node editor
│   ├── Toolbox.tsx            # Node library sidebar
│   ├── PropertiesPanel.tsx    # Node property editor
│   ├── Toolbar.tsx            # Top ribbon bar
│   ├── ExcelPreview.tsx       # Spreadsheet preview
│   ├── CustomFormulaModal.tsx # Advanced node editor
│   └── QuickFormulaModal.tsx  # Simple equation input
└── demoWorkflow.ts            # Demo project loader
```

---

## 8. Roadmap

### Phase 1: MVP (Current)
- [x] Visual node editor with pan/zoom
- [x] 70+ built-in nodes (Math, Logic, Section, Steel, RCC, Loads, **Excel**)
- [x] Live calculation engine with circular reference prevention
- [x] Custom formula system (Quick Formula + Advanced)
- [x] Project save/load
- [x] Collapsible, resizable panels with hamburger toggle
- [x] 4 themes (Dark, Light, Grasshopper, AutoCAD)
- [x] Markdown report generation
- [x] **Connection click menu** (delete/reconnect)
- [x] **Infinite loop prevention** (block cyclic connections)
- [x] **Excel-like nodes** (SUM, COUNT, AVERAGE, Lookup, IF, SUMIFS)
- [x] **Settings panel** (shortcuts, themes, tips, about)
- [x] **Fixed output text overlap** (value LEFT, name RIGHT)
- [x] **Fixed hover blinking** (targeted CSS transitions only)
- [x] **Removed bottom Excel preview panel**

### Phase 2: Engineering Expansion
- [ ] Complete IS 800 node library
- [ ] Complete IS 456 node library
- [ ] Bridge engineering nodes (IRC)
- [ ] Unit conversion engine
- [ ] PDF report generation
- [ ] Excel file export

### Phase 3: Advanced Features
- [ ] AI-powered formula assistant
- [ ] STAAD/MIDAS model import
- [ ] 3D structural visualization
- [ ] Cloud collaboration
- [ ] Template marketplace

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Formula parsing errors | High | Medium | Comprehensive validation, test suite |
| Performance with large projects | Medium | Medium | Virtualization, lazy evaluation |
| Browser compatibility | Low | Low | Modern browser targeting, polyfills |
| Code compliance accuracy | High | Low | Expert review, unit tests per code clause |

---

## 10. Appendices

### A. Supported Design Codes
- IS 800:2007 (Steel)
- IS 456:2000 (Concrete)
- IS 875:1987 (Loads)
- IS 1893:2016 (Seismic)
- IS 1343:2012 (Prestressed Concrete)
- IRC 6, 21, 22, 24, 78, 83, 112
- IRS Codes (Railways)
- Eurocode 2, 3, 4
- AISC 360
- AASHTO LRFD

### B. Formula Syntax Reference
```
Operators:    + - * / ^ ( )
Functions:    sqrt, abs, sin, cos, tan, log, exp, min, max, pow, round
Constants:    pi, e
Example:      Stress = M / (b * d^2 / 6)
```

### C. Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save Project |
| Delete | Delete selected node |
| Alt+Drag | Pan canvas |
| Scroll | Zoom in/out |

---

*Document maintained by the Structural Node Designer development team.*
