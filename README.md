# Structural Node Designer - Documentation

Welcome to the documentation for **Structural Node Designer**, a Grasshopper-inspired visual programming environment for structural engineering calculations.

---

## 📚 Documentation Index

| Document | Description | Audience |
|----------|-------------|----------|
| [PRD.md](./PRD.md) | Product Requirements Document - Vision, objectives, features | Product, Engineering |
| [USER_GUIDE.md](./USER_GUIDE.md) | User manual - How to use the application | End Users |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Technical design - Architecture and implementation details | Developers |
| [API_REFERENCE.md](./API_REFERENCE.md) | API documentation - Types, functions, components | Developers |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture - Component diagrams and data flow | Developers, Architects |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Developer guide - Setup, workflows, code style | Contributors |
| [CHANGELOG.md](./CHANGELOG.md) | Version history - What's new, migration notes | All |

---

## 🚀 Quick Links

### For Users
- [Getting Started →](./USER_GUIDE.md#1-getting-started)
- [Creating Custom Formulas →](./USER_GUIDE.md#5-custom-formulas)
- [Keyboard Shortcuts →](./USER_GUIDE.md#7-keyboard-shortcuts)
- [Node Reference →](./USER_GUIDE.md#8-node-reference)

### For Developers
- [Project Setup →](./DEVELOPMENT_GUIDE.md#1-getting-started)
- [Adding New Nodes →](./DEVELOPMENT_GUIDE.md#4-adding-new-nodes)
- [Component Props →](./API_REFERENCE.md#6-component-props)
- [Formula Parser API →](./API_REFERENCE.md#4-formula-parser-api)

### Project Information
- [Feature Roadmap →](./PRD.md#8-roadmap)
- [Design Codes Supported →](./PRD.md#appendix-a-supported-design-codes)
- [Release Notes →](./CHANGELOG.md)

---

## 🏗️ About the Project

### Vision
Create a professional visual programming environment inside web browsers that works similarly to Rhino Grasshopper, allowing structural engineers to create calculation workflows by connecting graphical nodes instead of writing complex formulas.

### Key Features
- **70+ Built-in Nodes** - Math, Logic, Section, Steel, RCC, Loads, **Excel**
- **Custom Formula System** - Create your own nodes with simple equations
- **Live Calculations** - Real-time updates as you change values
- **Circular Reference Prevention** - Infinite loops auto-blocked
- **Connection Click Menu** - Click wires to delete/reconnect
- **Code Compliance** - IS 800, IS 456, IS 875, IS 1893, IRC codes
- **4 Visual Themes** - Dark, Light, Grasshopper, AutoCAD
- **Collapsible Panels** - Resizable, auto-hide toolbox and properties
- **Settings Panel** - Shortcuts, themes, tips, about info
- **Project Save/Load** - JSON-based project files
- **Report Generation** - Automatic calculation documentation
- **Fixed Output Layout** - Values LEFT, names RIGHT (no overlap)
- **Fixed Hover Blinking** - Targeted CSS transitions

### Technology Stack
- React 19 + TypeScript 5
- Vite 7 + Tailwind CSS 4
- SVG-based rendering
- Custom formula parser

---

## 📖 Document Summaries

### PRD.md (Product Requirements Document)
Comprehensive product specification including:
- Project vision and objectives
- Target users and industries
- Detailed functional requirements
- Non-functional requirements
- UI requirements
- Roadmap and milestones

### USER_GUIDE.md
End-user documentation covering:
- Getting started tutorial
- Interface overview
- Working with nodes
- Creating connections
- Custom formula creation
- Project management
- Keyboard shortcuts
- Complete node reference

### TECHNICAL_DESIGN.md
Technical implementation details:
- System architecture
- Data structures and types
- Calculation engine design
- Formula parser implementation
- Rendering pipeline
- State management
- File format specification

### API_REFERENCE.md
Programmatic interface documentation:
- TypeScript interfaces
- Node definition API
- Calculation engine API
- Formula parser API
- useNodeEditor hook
- Component prop types

### ARCHITECTURE.md
System architecture documentation:
- High-level component diagrams
- Data flow diagrams
- Module dependencies
- State architecture
- Rendering architecture
- Performance considerations
- Security considerations

### DEVELOPMENT_GUIDE.md
Contributor documentation:
- Development environment setup
- Project structure
- Development workflow
- Adding new nodes
- Modifying the UI
- Testing guidelines
- Code style conventions
- Common tasks

### CHANGELOG.md
Version history including:
- Release notes
- New features
- Bug fixes
- Breaking changes
- Migration guides
- Known issues

---

## 🎯 Quick Reference

### Formula Syntax
```
Operators:  + - * / ^ ( )
Functions:  sqrt, abs, sin, cos, tan, log, exp, min, max, pow, round
Constants:  pi, e

Example:    Stress = M / (b * d^2 / 6)
```

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Delete | Delete node |
| Alt+Drag | Pan canvas |
| Scroll | Zoom |

### File Format
Projects are saved as `.snd.json` files containing:
- Nodes with positions and values
- Connections between nodes
- Canvas zoom and pan state
- Theme preference
- Custom node definitions

---

## 📞 Support

For questions or issues:
1. Check the [User Guide](./USER_GUIDE.md) and [Troubleshooting](./USER_GUIDE.md#10-troubleshooting)
2. Review the [API Reference](./API_REFERENCE.md) for technical details
3. Consult the [Development Guide](./DEVELOPMENT_GUIDE.md#9-troubleshooting) for development issues

---

## 📄 License

*See LICENSE file in repository root*

---

## 🙏 Acknowledgments

- Inspired by [Rhino Grasshopper](https://www.grasshopper3d.com/)
- Built with [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)
- Design codes: Bureau of Indian Standards (IS, IRC, IRS)

---

*Documentation version 1.0 - Last updated 2024*
