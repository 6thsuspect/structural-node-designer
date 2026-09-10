import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNodeEditor } from './hooks/useNodeEditor';
import NodeCanvas from './components/NodeCanvas';
import Toolbox from './components/Toolbox';
import PropertiesPanel from './components/PropertiesPanel';
import Toolbar from './components/Toolbar';
import CustomFormulaModal, { CustomNodeData } from './components/CustomFormulaModal';
import QuickFormulaModal, { QuickNodeData } from './components/QuickFormulaModal';
import NodeCodeModal, { CodeNodeData } from './components/NodeCodeModal';
import SettingsModal from './components/SettingsModal';
import AboutAuthorModal from './components/AboutAuthorModal';
import AppLogo from './components/AppLogo';
import { CalculationTracePanel, type FormulaProvider } from './features/calculation-trace';
import { DEMO_PROJECTS, type DemoProject } from './demoProjects';
import { registerCustomNode, CATEGORY_COLORS, getNodeDefinition } from './nodeDefinitions';
import { evaluateFormulaNode } from './formulaParser';
import { generateNodeCode, extractOutputFormulas, buildQuickPrefill, buildCodePrefill } from './nodeCodegen';
import { Theme, NodeDefinition, CanvasNode, ShapeType } from './types';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import MobileToolbar from './components/MobileToolbar';
import MobileSheet from './components/MobileSheet';
import { SHAPE_CATALOG } from './features/canvas-shapes';

/* ─── theme palette helper ─── */
const panelColors = (theme: Theme) => {
  const map: Record<Theme, { bg:string;border:string;text:string;hover:string;accent:string;grip:string }> = {
    dark:        { bg:'#0f172a',border:'#1e293b',text:'#e2e8f0',hover:'#1e293b',accent:'#3b82f6',grip:'#334155' },
    light:       { bg:'#ffffff',border:'#e2e8f0',text:'#1e293b',hover:'#f1f5f9',accent:'#3b82f6',grip:'#cbd5e1' },
    grasshopper: { bg:'#1a202c',border:'#2d3748',text:'#e2e8f0',hover:'#2d3748',accent:'#68d391',grip:'#4a5568' },
    autocad:     { bg:'#0a0a0a',border:'#222222',text:'#ffffff',hover:'#1a1a1a',accent:'#00ff00',grip:'#333333' },
  };
  return map[theme];
};

/* ─── Build a NodeDefinition from custom node data ─── */
function buildCustomNodeDef(nodeData: CustomNodeData | QuickNodeData): NodeDefinition {
  return {
    type: nodeData.id, category: nodeData.category, label: nodeData.label, description: nodeData.description,
    inputs: nodeData.inputs.map(i => ({ name: i.name, type: 'number' as const, value: i.defaultValue, unit: i.unit })),
    outputs: nodeData.outputs.map(o => ({ name: o.name, type: 'number' as const, unit: o.unit })),
    compute: (inputs: Record<string, number>) => {
      // Dependency-based evaluation: each output's formula may reference other
      // outputs in the same node; evaluateFormulaNode resolves those internal
      // dependencies automatically (in the correct order) and throws a clear
      // error on undefined variables or circular dependencies.
      const equations = nodeData.outputs.map(o => ({ output: o.name, formula: o.formula }));
      return evaluateFormulaNode(equations, inputs);
    },
    color: CATEGORY_COLORS[nodeData.category] || '#00BCD4', icon: '✏️',
  };
}

/* ─── Build a NodeDefinition from custom code node data ─── */
function buildCodeNodeDef(data: CodeNodeData): NodeDefinition {
  return {
    type: data.id, category: data.category, label: data.label, description: data.description,
    inputs: data.inputs.map(i => ({ name: i.name, type: i.type, value: i.value, unit: i.unit })),
    outputs: data.outputs.map(o => ({ name: o.name, type: o.type, unit: o.unit })),
    compute: (inputs: Record<string, any>) => {
      try {
        const fn = new Function('inputs', data.code) as (i: Record<string, any>) => Record<string, any>;
        return fn(inputs) || {};
      } catch (e: any) {
        throw new Error(e?.message || 'Code error');
      }
    },
    color: CATEGORY_COLORS[data.category] || '#00BCD4', icon: '🧮',
  };
}

/* ─── Hamburger icon ─── */
function HamburgerIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill={color}/>
    <rect x="2" y="7" width="12" height="1.5" rx="0.75" fill={color}/>
    <rect x="2" y="11" width="12" height="1.5" rx="0.75" fill={color}/>
  </svg>;
}

/* ─── Collapsed tab ─── */
function CollapsedTab({ side, label, icon, theme, onClick }: { side:'left'|'right'; label:string; icon:string; theme:Theme; onClick:()=>void }) {
  const c = panelColors(theme);
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
      style={{ writingMode:'vertical-rl', textOrientation:'mixed', background:c.bg, border:`1px solid ${c.border}`, borderRadius:side==='left'?'0 8px 8px 0':'8px 0 0 8px', padding:'12px 6px', color:c.text, fontSize:11, fontWeight:600, letterSpacing:1, cursor:'pointer' }}
      title={`Show ${label}`}>
      <span style={{ writingMode:'vertical-rl', transform:side==='left'?'rotate(180deg)':undefined }}>{icon} {label}</span>
    </button>
  );
}

/* ─── Resize grip ─── */
function ResizeGrip({ theme, side, onPointerDown }: { theme:Theme; side:'left'|'right'; onPointerDown:(e:React.PointerEvent)=>void }) {
  const c = panelColors(theme);
  return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center cursor-col-resize group"
      style={{ width:6, background:c.border, touchAction:'none' }} onPointerDown={onPointerDown} title={`Resize ${side} panel`}>
      <div className="space-y-1 opacity-50 group-hover:opacity-100 transition-opacity">
        <div className="w-[3px] h-[3px] rounded-full" style={{ background:c.grip }}/>
        <div className="w-[3px] h-[3px] rounded-full" style={{ background:c.grip }}/>
        <div className="w-[3px] h-[3px] rounded-full" style={{ background:c.grip }}/>
        <div className="w-[3px] h-[3px] rounded-full" style={{ background:c.grip }}/>
        <div className="w-[3px] h-[3px] rounded-full" style={{ background:c.grip }}/>
      </div>
    </div>
  );
}

/* ─── Panel header ─── */
function PanelHeader({ title, icon, theme, onToggle }: { title:string; icon:string; theme:Theme; onToggle:()=>void }) {
  const c = panelColors(theme);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 flex-shrink-0 select-none" style={{ background:c.bg, borderBottom:`1px solid ${c.border}` }}>
      <button onClick={onToggle} className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0" title="Toggle panel">
        <HamburgerIcon color={c.text} />
      </button>
      <span className="text-xs" style={{ color:c.text, opacity:0.5 }}>{icon}</span>
      <span className="text-xs font-semibold tracking-wide uppercase" style={{ color:c.text }}>{title}</span>
    </div>
  );
}

/* ─── Compact (mobile/tablet) top header ───
   Slim branding bar for compact viewports; every command lives in the
   MobileToolbar below the canvas. */
function CompactHeader({ theme }: { theme: Theme }) {
  const c = panelColors(theme);
  return (
    <div className="flex items-center gap-2 px-3 flex-shrink-0 snd-safe-top" style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, paddingBottom: 8, minHeight: 44 }}>
      <AppLogo size={24} />
      <div className="text-xs font-bold tracking-tight truncate" style={{ color: c.text }}>
        Structural Node Designer
      </div>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const editor = useNodeEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Compact viewport (phone/tablet) → drawer-based layout. Viewport-width
     based, so it also follows rotation, split-screen and window resizes. */
  const isCompact = useResponsiveLayout();

  /* ── panel visibility ── */
  const [toolboxOpen, setToolboxOpen]       = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [showSplash, setShowSplash]         = useState(true);

  /* ── panel sizes ── */
  const [toolboxWidth, setToolboxWidth]       = useState(250);
  const [propertiesWidth, setPropertiesWidth] = useState(290);

  /* ── resize ── */
  const [resizing, setResizing] = useState<'toolbox'|'properties'|null>(null);
  const resizeStart = useRef({ x:0, y:0, size:0 });

  /* ── modals ── */
  const [showCustomFormulaModal, setShowCustomFormulaModal] = useState(false);
  const [showQuickFormulaModal, setShowQuickFormulaModal]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  /* ── Alignment snap (smart guides while dragging nodes) ── */
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [customNodes, setCustomNodes] = useState<(CustomNodeData|QuickNodeData)[]>([]);
  const [codeNodes, setCodeNodes] = useState<CodeNodeData[]>([]);
  const [showNodeCodeModal, setShowNodeCodeModal] = useState(false);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [editingFormulaNode, setEditingFormulaNode] = useState<QuickNodeData | null>(null);
  const [, forceUpdate] = useState(0);

  const selectedNode = editor.nodes.find(n => n.id === editor.selectedNodeId) || null;
  const editNode = editor.nodes.find(n => n.id === editNodeId) || selectedNode;

  /* ── Shapes feature: the selected canvas shape (mutually exclusive with nodes —
     the panel shows the node when a node is selected, else the primary shape) ── */
  const selectedShape = selectedNode
    ? null
    : editor.shapes.find(s => s.id === editor.selectedShapeId) || null;

  /* ── Mobile inspector: open when something is selected, close on clear ── */
  useEffect(() => {
    if (!isCompact) return;
    setInspectorOpen(Boolean(selectedNode || selectedShape));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact, selectedNode, selectedShape]);

  /* ── Zoom to Fit: token per request — NodeCanvas computes & applies the fit ── */
  const [fitSignal, setFitSignal] = useState(0);

  /* ── Calculation Trace feature (additive, read-only) ── */
  const [traceNodeId, setTraceNodeId] = useState<string | null>(null);
  const [traceFocus, setTraceFocus] = useState<{ nodeId: string; token: number } | null>(null);

  /* ── Responsive (touch/mobile) layout — additive; desktop (≥1024 px) is
     pixel-identical to before. Compact viewports get the canvas plus a
     bottom toolbar and drawer sheets that reuse the same panels. ── */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Tap-to-place: a node/shape picked from the mobile library waiting for a
  // canvas tap (the canvas converts the tap to world coordinates).
  const [placeMode, setPlaceMode] = useState<{ nodeType?: string; shapeType?: ShapeType } | null>(null);

  /* Opens the trace panel for a node (context menu / properties button). */
  const handleViewTrace = useCallback((nodeId: string) => {
    setTraceNodeId(nodeId);
  }, []);

  /* "Locate" from a trace step: close the panel, then let the canvas
     pan/zoom to the node and highlight it briefly. */
  const handleTraceLocate = useCallback((nodeId: string) => {
    setTraceNodeId(null);
    setTraceFocus({ nodeId, token: Date.now() });
  }, []);

  /* Authoritative per-output formulas for CUSTOM nodes (quick / advanced /
     code). Built-in nodes return undefined → the trace service falls back to
     the existing description-based extraction. Read-only. */
  const traceFormulaProvider = useCallback<FormulaProvider>((node) => {
    const custom = customNodes.find(n => n.id === node.type);
    if (custom) {
      const formulas: Record<string, string> = {};
      custom.outputs.forEach(o => { formulas[o.name] = o.formula; });
      return { formulas, source: 'custom' };
    }
    const code = codeNodes.find(c => c.id === node.type);
    if (code) {
      const formulas: Record<string, string> = {};
      buildCodePrefill(node, code.code).outputs.forEach(o => { formulas[o.name] = o.formula; });
      return { formulas, source: 'custom' };
    }
    return undefined;
  }, [customNodes, codeNodes]);

  /* ── Reconstruct editable code for any node (built-in, formula, or code) ── */
  const buildInitialCode = (node: CanvasNode): string => {
    const def = getNodeDefinition(node.type);
    let formulaMap: Record<string, string> | undefined;
    const quick = customNodes.find(n => 'equations' in n && n.id === node.type) as QuickNodeData | undefined;
    const advanced = customNodes.find(n => !('equations' in n) && n.id === node.type) as CustomNodeData | undefined;
    if (quick) {
      formulaMap = {};
      quick.outputs.forEach(o => { formulaMap![o.name] = o.formula; });
    } else if (advanced) {
      formulaMap = {};
      advanced.outputs.forEach(o => { formulaMap![o.name] = o.formula; });
    } else {
      formulaMap = extractOutputFormulas(node, def);
    }
    return generateNodeCode(node, def, formulaMap);
  };

  /* ── register custom nodes ── */
  useEffect(() => {
    customNodes.forEach(nodeData => {
      registerCustomNode(buildCustomNodeDef(nodeData));
    });
    forceUpdate(n => n + 1);
  }, [customNodes]);

  /* ── register custom code nodes ── */
  useEffect(() => {
    codeNodes.forEach(nodeData => {
      registerCustomNode(buildCodeNodeDef(nodeData));
    });
    forceUpdate(n => n + 1);
  }, [codeNodes]);

  const handleSaveCustomNode = useCallback((nodeData: CustomNodeData|QuickNodeData) => {
    setCustomNodes(prev => {
      const existing = prev.findIndex(n => n.id === nodeData.id);
      if (existing >= 0) { const updated = [...prev]; updated[existing] = nodeData; return updated; }
      return [...prev, nodeData];
    });
    // Register immediately (so it can be used right away) and, when launched from a
    // node's context menu, convert that node to the new definition.
    registerCustomNode(buildCustomNodeDef(nodeData));
    if (editNodeId) editor.replaceNodeType(editNodeId, nodeData.id);
    setEditNodeId(null);
    setEditingFormulaNode(null);
  }, [editNodeId, editor]);

  const handleSaveNodeCode = useCallback((data: CodeNodeData) => {
    setCodeNodes(prev => {
      const existing = prev.findIndex(n => n.id === data.id);
      if (existing >= 0) { const updated = [...prev]; updated[existing] = data; return updated; }
      return [...prev, data];
    });
    registerCustomNode(buildCodeNodeDef(data));
    if (editNodeId) editor.replaceNodeType(editNodeId, data.id);
    setEditNodeId(null);
    setShowNodeCodeModal(false);
  }, [editNodeId, editor]);

  /* ── context menu: edit a node's code ── */
  const handleOpenNodeCode = useCallback((nodeId: string) => {
    setEditNodeId(nodeId);
    setShowNodeCodeModal(true);
  }, []);

  /* ── context menu: edit formula & inputs ── */
  const handleOpenFormula = useCallback((nodeId: string) => {
    const node = editor.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const quick = customNodes.find(n => 'equations' in n && n.id === node.type) as QuickNodeData | undefined;
    if (quick) {
      setEditingFormulaNode(quick);
    } else {
      // An "Advanced" custom node has per-output formulas; expose them as equations.
      const advanced = customNodes.find(n => !('equations' in n) && n.id === node.type) as CustomNodeData | undefined;
      if (advanced) {
        setEditingFormulaNode({
          id: advanced.id,
          label: advanced.label,
          description: advanced.description,
          category: advanced.category,
          equations: advanced.outputs.map(o => `${o.name} = ${o.formula}`),
          inputs: advanced.inputs,
          outputs: advanced.outputs,
        });
      } else {
        // Code node: rebuild the equations from the stored JavaScript so the
        // dialog shows the same formulas as "Edit Node Code" (not current values).
        const codeNode = codeNodes.find(c => c.id === node.type);
        if (codeNode) {
          const prefill = buildCodePrefill(node, codeNode.code);
          setEditingFormulaNode({
            id: `quick_${node.id}`,
            label: prefill.label,
            description: prefill.description,
            category: prefill.category,
            equations: prefill.equations,
            inputs: prefill.inputs,
            outputs: prefill.outputs,
          });
        } else {
          // Built-in node: rebuild inputs + equations from the node itself
          // (its inputs, description formulas, and current output values).
          const prefill = buildQuickPrefill(node, getNodeDefinition(node.type));
          setEditingFormulaNode({
            id: `quick_${node.id}`,
            label: prefill.label,
            description: prefill.description,
            category: prefill.category,
            equations: prefill.equations,
            inputs: prefill.inputs,
            outputs: prefill.outputs,
          });
        }
      }
    }
    setEditNodeId(nodeId);
    setShowQuickFormulaModal(true);
  }, [editor.nodes, customNodes, codeNodes]);

  /* ── project save ── */
  const handleSaveProject = useCallback(() => {
    const project = {
      name: 'Structural Node Designer Project', version: '1.0',
      created: new Date().toISOString(), modified: new Date().toISOString(),
      canvas: { nodes:editor.nodes, connections:editor.connections, zoom:editor.zoom, panX:editor.panX, panY:editor.panY },
      theme: editor.theme, customNodes, codeNodes, groups: editor.groups,
      shapes: editor.shapes,
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'project.snd.json'; a.click();
    URL.revokeObjectURL(url);
  }, [editor.nodes, editor.connections, editor.zoom, editor.panX, editor.panY, editor.theme, editor.groups, editor.shapes, customNodes, codeNodes]);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Text fields keep native behavior (typing, Ctrl+Z inside text, …).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); editor.undo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==='y') { e.preventDefault(); editor.redo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); handleSaveProject(); }
      // Node Groups: Ctrl+G group selection, Ctrl+Shift+G ungroup.
      // Mixed groups: the current selection includes nodes AND shapes.
      if ((e.ctrlKey||e.metaKey) && e.key==='g') {
        e.preventDefault();
        if (e.shiftKey) editor.ungroupSelection(editor.selectedNodeIds, editor.selectedShapeIds);
        else editor.groupSelection(editor.selectedNodeIds, editor.selectedShapeIds);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, handleSaveProject]);

  /* ── resize handler (pointer events: mouse + touch + pen) ── */
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      if (resizing === 'toolbox') setToolboxWidth(Math.max(180, Math.min(500, resizeStart.current.size + dx)));
      else if (resizing === 'properties') setPropertiesWidth(Math.max(200, Math.min(500, resizeStart.current.size - dx)));
    };
    const onUp = () => setResizing(null);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { document.body.style.cursor=''; document.body.style.userSelect=''; window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp); window.removeEventListener('pointercancel',onUp); };
  }, [resizing]);

  const startResize = (which: 'toolbox'|'properties', e: React.PointerEvent) => {
    resizeStart.current = { x:e.clientX, y:e.clientY, size: which==='toolbox' ? toolboxWidth : propertiesWidth };
    setResizing(which);
  };

  /* ── file handlers ── */
  const handleLoadFile = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        const project = JSON.parse(content);
        if (project.customNodes && Array.isArray(project.customNodes)) setCustomNodes(project.customNodes);
        if (project.codeNodes && Array.isArray(project.codeNodes)) setCodeNodes(project.codeNodes);
      } catch {}
      editor.loadProject(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [editor]);

  /* ── Load a bundled demo project (listed by file name) ── */
  const handleLoadDemo = useCallback((demo: DemoProject) => {
    try {
      const project = JSON.parse(demo.json);
      if (project.customNodes && Array.isArray(project.customNodes)) setCustomNodes(project.customNodes);
      if (project.codeNodes && Array.isArray(project.codeNodes)) setCodeNodes(project.codeNodes);
    } catch { /* fall through to a plain load */ }
    editor.loadProject(demo.json);
    setShowSplash(false);
  }, [editor]);

  const handleDropNode = useCallback((type: string, x: number, y: number) => { editor.addNode(type, x, y); setShowSplash(false); }, [editor]);

  /* ── Shapes feature: drop a shape from the Toolbox "Shapes" tab ── */
  const handleDropShape = useCallback((type: ShapeType, x: number, y: number) => { editor.addShape(type, x, y); setShowSplash(false); }, [editor]);

  /* ── Tap-to-place (mobile): insert the pending node/shape at the tapped
     canvas position (NodeCanvas converts the tap to world coordinates) ── */
  const handlePlaceAtWorld = useCallback((x: number, y: number) => {
    if (placeMode?.nodeType) handleDropNode(placeMode.nodeType, x, y);
    else if (placeMode?.shapeType) handleDropShape(placeMode.shapeType, x, y);
    setPlaceMode(null);
  }, [placeMode, handleDropNode, handleDropShape]);

  /* ═══ SPLASH ═══ */
  if (showSplash && editor.nodes.length === 0) {
    const bgColor = editor.theme==='light'?'#f1f5f9':editor.theme==='grasshopper'?'#1a202c':editor.theme==='autocad'?'#000':'#0f172a';
    const textColor = editor.theme==='light'?'#1e293b':'#e2e8f0';
    const subColor = editor.theme==='light'?'#64748b':'#94a3b8';
    const accentColor = editor.theme==='grasshopper'?'#68d391':editor.theme==='autocad'?'#00ff00':'#3b82f6';

    return (
      <div className="h-full w-full flex flex-col items-center justify-center relative" style={{ background:bgColor }}>
        <div className="text-center space-y-6 max-w-lg">
          <div className="mb-4 flex justify-center"><AppLogo size={72} /></div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color:textColor }}>Structural Node Designer</h1>
          <p className="text-sm leading-relaxed" style={{ color:subColor }}>
            A Grasshopper-inspired visual programming environment for structural engineering calculations.
            Create workflows by connecting nodes. Supports IS 800, IS 456, IRC codes, and custom formulas.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center pt-4">
            {DEMO_PROJECTS.map(d => (
              <button key={d.fileName} onClick={() => handleLoadDemo(d)} title={d.fileName} className="px-6 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 text-white" style={{ background:accentColor }}>🚀 {d.name}</button>
            ))}
            <button onClick={() => { setShowSplash(false); setShowQuickFormulaModal(true); }} className="px-6 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 text-white" style={{ background:'#10b981' }}>⚡ Quick Formula</button>
            <button onClick={() => setShowSplash(false)} className="px-6 py-3 rounded-lg text-sm font-medium transition-all hover:scale-105" style={{ background:'transparent', color:textColor, border:`1px solid ${subColor}44` }}>✨ Empty Canvas</button>
            <button onClick={handleLoadFile} className="px-6 py-3 rounded-lg text-sm font-medium transition-all hover:scale-105" style={{ background:'transparent', color:textColor, border:`1px solid ${subColor}44` }}>📂 Open Project</button>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-6">
            {[
              { icon:'⚡',title:'Quick Formula',desc:'Type equations, auto-detect inputs',hl:true },
              { icon:'📐',title:'Section Properties',desc:'I-Section, Rectangle, Circle' },
              { icon:'⚙️',title:'Steel Design',desc:'IS 800 compliant checks' },
              { icon:'🧱',title:'RCC Design',desc:'IS 456 flexure & shear' },
              { icon:'📊',title:'Excel Nodes',desc:'SUM, COUNT, AVERAGE, Lookup' },
              { icon:'📄',title:'Reports',desc:'Auto calculation sheets' },
            ].map(item => (
              <div key={item.title} className="p-3 rounded-lg text-left" style={{ background:(item as any).hl?`${accentColor}20`:`${subColor}10`, border:`1px solid ${(item as any).hl?accentColor:subColor}20` }}>
                <div className="text-xl mb-1">{item.icon}</div>
                <div className="text-xs font-bold" style={{ color:textColor }}>{item.title}</div>
                <div className="text-[10px]" style={{ color:subColor }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="pt-4 flex items-center justify-center gap-4">
            <span className="text-[10px]" style={{ color:subColor }}>Theme:</span>
            {(['dark','light','grasshopper','autocad'] as const).map(t => (
              <button key={t} onClick={() => editor.setTheme(t)} className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                style={{ background:editor.theme===t?accentColor:'transparent', color:editor.theme===t?'#fff':subColor, border:`1px solid ${subColor}30` }}>
                {t==='dark'?'🌙':t==='light'?'☀️':t==='grasshopper'?'🦗':'📐'} {t}
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-3 left-0 right-0 text-center text-[11px]" style={{ color:subColor }}>
          © 2026 Arvind Singh Rawat. All Rights Reserved.
        </div>
        <input ref={fileInputRef} type="file" accept=".json,.snd" className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  /* ═══ MAIN LAYOUT ═══ */
  /* The canvas is shared by both layouts; place-mode props only activate when
     the mobile library arms them (desktop stays drag-and-drop only). */
  const canvas = (
    <NodeCanvas
      nodes={editor.nodes} connections={editor.connections} zoom={editor.zoom} panX={editor.panX} panY={editor.panY}
      connecting={editor.connecting} selectedNodeId={editor.selectedNodeId} theme={editor.theme}
      onMoveNode={editor.moveNode} onSelectNode={editor.selectNode}
      onStartConnecting={editor.startConnecting} onUpdateConnecting={editor.updateConnecting} onFinishConnecting={editor.finishConnecting}
      onDeleteNode={editor.deleteNode} onRemoveConnection={editor.removeConnection} onUpdateConnectionColor={editor.updateConnectionColor}
      onUpdateInput={editor.updateNodeInput}
      onEditNodeCode={handleOpenNodeCode} onEditFormula={handleOpenFormula}
      onZoomChange={editor.setZoom}
      onPanChange={(x,y) => { editor.setPanX(x); editor.setPanY(y); }} onDropNode={handleDropNode}
      onViewTrace={handleViewTrace} focusTarget={traceFocus} fitSignal={fitSignal} snapEnabled={snapEnabled}
      selectedNodeIds={editor.selectedNodeIds} groups={editor.groups}
      onSelectNodes={editor.selectNodes} onMoveNodes={editor.moveNodesBy}
      onGroupSelection={editor.groupSelection} onUngroupSelection={editor.ungroupSelection}
      onUpdateNodeFront={editor.setNodeFront}
      onMultiDelete={editor.deleteNodes}
      shapes={editor.shapes} selectedShapeId={editor.selectedShapeId} selectedShapeIds={editor.selectedShapeIds}
      onSelectShape={editor.selectShape} onSelectShapes={editor.setShapeSelection}
      onMoveShape={editor.moveShape} onResizeShape={(id, box) => editor.updateShape(id, box)}
      onUpdateShape={editor.updateShape}
      onDropShape={handleDropShape} onDeleteShape={editor.deleteShape} onToggleShapeFrozen={editor.toggleShapeFrozen}
      placeNodeType={placeMode?.nodeType ?? null} placeShapeType={placeMode?.shapeType ?? null}
      onPlaceAtWorld={handlePlaceAtWorld}
    />
  );

  /* Labels for the tap-to-place hint banner */
  const placeLabel = placeMode?.nodeType
    ? getNodeDefinition(placeMode.nodeType)?.label ?? placeMode.nodeType
    : placeMode?.shapeType
      ? SHAPE_CATALOG.find(s => s.type === placeMode.shapeType)?.label ?? placeMode.shapeType
      : null;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden select-none relative">
      <input ref={fileInputRef} type="file" accept=".json,.snd" className="hidden" onChange={handleFileChange} />

      {/* Top bar: slim header on compact viewports, full toolbar on desktop */}
      {isCompact ? (
        <CompactHeader theme={editor.theme} />
      ) : (
        <Toolbar theme={editor.theme} onThemeChange={editor.setTheme} onSave={handleSaveProject} onLoad={handleLoadFile} onClear={editor.clearAll}
          onUndo={editor.undo} onRedo={editor.redo} onReport={editor.generateReport}
          onZoomIn={() => editor.setZoom(Math.min(5, editor.zoom*1.2))} onZoomOut={() => editor.setZoom(Math.max(0.1, editor.zoom*0.8))}
          onZoomFit={() => setFitSignal(t => t + 1)}
          onLoadDemo={handleLoadDemo} onCreateCustomNode={() => setShowCustomFormulaModal(true)}
          onQuickFormula={() => setShowQuickFormulaModal(true)} onSettings={() => setShowSettings(true)}
          onAbout={() => setShowAbout(true)} snapEnabled={snapEnabled} onToggleSnap={() => setSnapEnabled(v => !v)} />
      )}

      {isCompact ? (
        /* ═══ COMPACT LAYOUT (phone / tablet): full-bleed canvas + bottom
           toolbar + drawer sheets reusing the desktop Toolbox/Properties
           panels. Gestures are handled inside NodeCanvas. ═══ */
        <div className="flex-1 relative overflow-hidden min-h-0">
          {canvas}

          {/* Tap-to-place hint banner */}
          {placeLabel && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 z-20 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full shadow-xl text-xs font-medium"
              style={{ background: panelColors(editor.theme).bg, border: `1px solid ${panelColors(editor.theme).border}`, color: panelColors(editor.theme).text }}>
              <span>👆 Tap canvas to place <b>{placeLabel}</b></span>
              <button
                onClick={() => setPlaceMode(null)}
                aria-label="Cancel placement"
                className="w-8 h-8 rounded-full flex items-center justify-center active:bg-white/10"
                style={{ color: panelColors(editor.theme).text, opacity: 0.7 }}
              >✕</button>
            </div>
          )}

          {/* Mobile toolbar (reuses the desktop commands) */}
          <MobileToolbar
            theme={editor.theme} onThemeChange={editor.setTheme}
            onSave={handleSaveProject} onLoad={handleLoadFile} onClear={editor.clearAll}
            onUndo={editor.undo} onRedo={editor.redo} onReport={editor.generateReport}
            onZoomIn={() => editor.setZoom(Math.min(5, editor.zoom*1.2))} onZoomOut={() => editor.setZoom(Math.max(0.1, editor.zoom*0.8))}
            onZoomFit={() => setFitSignal(t => t + 1)}
            onLoadDemo={handleLoadDemo} onCreateCustomNode={() => setShowCustomFormulaModal(true)}
            onQuickFormula={() => setShowQuickFormulaModal(true)} onSettings={() => setShowSettings(true)}
            onAbout={() => setShowAbout(true)} snapEnabled={snapEnabled} onToggleSnap={() => setSnapEnabled(v => !v)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onToggleProperties={() => setInspectorOpen(v => !v)}
            propertiesOpen={inspectorOpen}
          />

          {/* Node library drawer (same Toolbox component, tap-to-place enabled) */}
          <MobileSheet open={libraryOpen} title="Node Library" icon="🧩" theme={editor.theme} onClose={() => setLibraryOpen(false)}>
            <Toolbox
              theme={editor.theme} searchQuery={editor.searchQuery} onSearchChange={editor.setSearchQuery}
              onCreateCustom={() => { setLibraryOpen(false); setShowCustomFormulaModal(true); }}
              onQuickFormula={() => { setLibraryOpen(false); setShowQuickFormulaModal(true); }}
              onPickNode={(type) => { setPlaceMode({ nodeType: type }); setLibraryOpen(false); }}
              onPickShape={(type) => { setPlaceMode({ shapeType: type }); setLibraryOpen(false); }}
            />
          </MobileSheet>

          {/* Properties / inspector drawer (same PropertiesPanel component) */}
          <MobileSheet open={inspectorOpen} title="Properties" icon="📋" theme={editor.theme} onClose={() => setInspectorOpen(false)}>
            <div className="h-[56dvh] overflow-hidden">
              <PropertiesPanel node={selectedNode} connections={editor.connections} theme={editor.theme}
                onUpdateInput={editor.updateNodeInput} onDeleteNode={editor.deleteNode} onDuplicateNode={editor.duplicateNode}
                onViewTrace={handleViewTrace} onUpdateNodeFront={editor.setNodeFront}
                shape={selectedShape} onUpdateShape={editor.updateShape} onDeleteShape={editor.deleteShape}
                onToggleShapeFrozen={editor.toggleShapeFrozen} />
            </div>
          </MobileSheet>
        </div>
      ) : (
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Toolbox */}
        {toolboxOpen ? (
          <>
            <div className="flex flex-col h-full overflow-hidden" style={{ width:toolboxWidth, flexShrink:0 }}>
              <PanelHeader title="Toolbox" icon="🧩" theme={editor.theme} onToggle={() => setToolboxOpen(false)} />
              <div className="flex-1 overflow-hidden">
                <Toolbox theme={editor.theme} searchQuery={editor.searchQuery} onSearchChange={editor.setSearchQuery} onCreateCustom={() => setShowCustomFormulaModal(true)} onQuickFormula={() => setShowQuickFormulaModal(true)} />
              </div>
            </div>
            <ResizeGrip theme={editor.theme} side="left" onPointerDown={(e) => startResize('toolbox',e)} />
          </>
        ) : (
          <div className="flex items-start pt-2 flex-shrink-0">
            <CollapsedTab side="left" label="Toolbox" icon="🧩" theme={editor.theme} onClick={() => setToolboxOpen(true)} />
          </div>
        )}

        {/* CENTER: Canvas — no Excel panel */}
        <div className="flex-1 overflow-hidden min-w-0">
          {canvas}
        </div>

        {/* RIGHT: Properties */}
        {propertiesOpen ? (
          <>
            <ResizeGrip theme={editor.theme} side="right" onPointerDown={(e) => startResize('properties',e)} />
            <div className="flex flex-col h-full overflow-hidden" style={{ width:propertiesWidth, flexShrink:0 }}>
              <PanelHeader title="Properties" icon="📋" theme={editor.theme} onToggle={() => setPropertiesOpen(false)} />
              <div className="flex-1 overflow-hidden">
                <PropertiesPanel node={selectedNode} connections={editor.connections} theme={editor.theme}
                  onUpdateInput={editor.updateNodeInput} onDeleteNode={editor.deleteNode} onDuplicateNode={editor.duplicateNode}
                  onViewTrace={handleViewTrace} onUpdateNodeFront={editor.setNodeFront}
                  shape={selectedShape} onUpdateShape={editor.updateShape} onDeleteShape={editor.deleteShape}
                  onToggleShapeFrozen={editor.toggleShapeFrozen} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start pt-2 flex-shrink-0">
            <CollapsedTab side="right" label="Properties" icon="📋" theme={editor.theme} onClick={() => setPropertiesOpen(true)} />
          </div>
        )}
      </div>
      )}

      {/* Floating copyright — fully transparent overlay, bottom center.
          No background, no border; pointer-events-none so it never blocks canvas/panel interaction.
          Hidden on compact viewports (the mobile toolbar lives there). */}
      {!isCompact && <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 5 }}>
        <span
          className="text-[11px]"
          style={{
            color: panelColors(editor.theme).text,
            opacity: 0.55,
            textShadow: editor.theme === 'light'
              ? '0 1px 2px rgba(255,255,255,0.9)'
              : '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          © 2026 Arvind Singh Rawat. All Rights Reserved.
        </span>
      </div>}

      {/* Modals */}
      <CustomFormulaModal isOpen={showCustomFormulaModal} theme={editor.theme} onClose={() => setShowCustomFormulaModal(false)} onSave={handleSaveCustomNode} />
      <QuickFormulaModal isOpen={showQuickFormulaModal} theme={editor.theme}
        editingNode={editingFormulaNode}
        onClose={() => { setShowQuickFormulaModal(false); setEditingFormulaNode(null); setEditNodeId(null); }}
        onSave={handleSaveCustomNode} />
      <NodeCodeModal isOpen={showNodeCodeModal} theme={editor.theme}
        node={editNode}
        existingCode={editNode ? (codeNodes.find(c => c.id === editNode.type)?.code ?? null) : null}
        initialCode={editNode ? buildInitialCode(editNode) : ''}
        onClose={() => { setShowNodeCodeModal(false); setEditNodeId(null); }}
        onSave={handleSaveNodeCode} />
      <SettingsModal isOpen={showSettings} theme={editor.theme} onThemeChange={editor.setTheme} onClose={() => setShowSettings(false)} onClearAll={editor.clearAll} />
      <AboutAuthorModal isOpen={showAbout} theme={editor.theme} onClose={() => setShowAbout(false)} />

      {/* Calculation Trace (additive feature — read-only, on demand) */}
      <CalculationTracePanel
        isOpen={traceNodeId !== null}
        theme={editor.theme}
        nodes={editor.nodes}
        connections={editor.connections}
        rootNodeId={traceNodeId}
        formulaProvider={traceFormulaProvider}
        projectName="Structural Node Designer Project"
        onClose={() => setTraceNodeId(null)}
        onLocateNode={handleTraceLocate}
      />
    </div>
  );
}
