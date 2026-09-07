import React, { useRef, useCallback, useEffect, useState } from 'react';
import { CanvasNode, Connection, ConnectingState, Theme, SelectionBox, NodeGroup, CanvasShape, ShapeType } from '../types';
import {
  computeGroupBounds,
  getGroupOfShape,
  groupMemberIds,
  groupShapeIds,
  hasGroupMembership,
  nodesInBox,
  normalizeMarquee,
} from '../features/node-groups';
import { computeContentBounds, computeFitView } from '../features/canvas-fit';
import {
  DEFAULT_SHAPE_FILL_OPACITY,
  MIN_SHAPE_SIZE,
  getShapeDefinition,
  shapePolygonPoints,
  shapeRatioResizeBox,
  shapeResizeBox,
  type ShapeResizeHandle,
} from '../features/canvas-shapes';

const PORT_RADIUS = 7;
const PORT_HEIGHT = 28;
const HEADER_HEIGHT = 36;

/* ─── Port row layout constants (node width is fixed at 200) ─── */
const LABEL_X = 16;             // input label left edge
const COLON_X = 74;             // fixed ":" position, right before the value box
const VALUE_BOX_X = 78;         // input value box/region left edge
const VALUE_TEXT_X = 83;        // input value text left edge
const LABEL_MAX_CHARS = 9;      // input label truncation
const INPUT_VALUE_MAX_CHARS = 17;
const OUT_NAME_MAX_CHARS = 10;

/** Truncate a string with an ellipsis so it can never overlap its neighbours. */
function truncateText(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface Props {
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;
  panX: number;
  panY: number;
  connecting: ConnectingState;
  selectedNodeId: string | null;
  theme: Theme;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartConnecting: (nodeId: string, portId: string, isOutput: boolean, mx: number, my: number) => void;
  onUpdateConnecting: (mx: number, my: number) => void;
  onFinishConnecting: (nodeId?: string, portId?: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRemoveConnection: (connId: string) => void;
  onUpdateInput: (nodeId: string, portId: string, value: any) => void;
  onEditNodeCode: (nodeId: string) => void;
  onEditFormula: (nodeId: string) => void;
  onZoomChange: (z: number) => void;
  onPanChange: (x: number, y: number) => void;
  onDropNode: (type: string, x: number, y: number) => void;
  /* ── Calculation Trace integration (optional — feature is inert when absent) ── */
  /** Opens the read-only Calculation Trace for a node. */
  onViewTrace?: (nodeId: string) => void;
  /** Pan/zoom + temporary highlight request (token changes per request). */
  focusTarget?: { nodeId: string; token: number } | null;
  /** Zoom-to-fit request (token changes per request; 0/undefined = none yet). */
  fitSignal?: number;
  /* ── Node Groups integration (optional — feature is inert when absent) ── */
  /** Current multi-selection (marquee / group-aware single selection). */
  selectedNodeIds?: string[];
  /** Node groups to render outlines for and drag together. */
  groups?: NodeGroup[];
  /** Set an explicit multi-selection (from the marquee box). */
  onSelectNodes?: (nodeIds: string[]) => void;
  /** Move several nodes (and their group's shapes) by a delta. */
  onMoveNodes?: (memberIds: string[], dx: number, dy: number, shapeIds?: string[]) => void;
  /** Group / ungroup the given nodes AND shapes (mixed groups). */
  onGroupSelection?: (nodeIds: string[], shapeIds: string[]) => void;
  onUngroupSelection?: (nodeIds: string[], shapeIds: string[]) => void;
  /** Per-item draw order for a node (front layer toggle). */
  onUpdateNodeFront?: (nodeId: string, front: boolean) => void;
  /** Delete several nodes at once (multi-selection Delete key). */
  onMultiDelete?: (nodeIds: string[]) => void;
  /* ── Shapes integration (optional — feature is inert when absent) ── */
  /** Shapes to render (layered by each shape's own `front` flag). */
  shapes?: CanvasShape[];
  /** The currently selected shape id (primary — resize handles + panel). */
  selectedShapeId?: string | null;
  /** The full shape selection (marquee / ctrl+right-click) — all are highlighted. */
  selectedShapeIds?: string[];
  /** Select a single shape (click; null clears). Mutually exclusive with node selection. */
  onSelectShape?: (shapeId: string | null) => void;
  /** Set the exact shape selection (marquee / ctrl+right-click toggling). */
  onSelectShapes?: (shapeIds: string[], clearNodes: boolean, primaryId?: string) => void;
  /** Move a shape to a new top-left position (drag). */
  onMoveShape?: (shapeId: string, x: number, y: number) => void;
  /** Replace a shape's bounding box (corner-handle resize). */
  onResizeShape?: (shapeId: string, box: { x: number; y: number; width: number; height: number }) => void;
  /** Patch any shape field (e.g. per-shape draw-order front flag). */
  onUpdateShape?: (shapeId: string, patch: Partial<CanvasShape>) => void;
  /** Drop a new shape from the Toolbox "Shapes" category. */
  onDropShape?: (type: ShapeType, x: number, y: number) => void;
  /** Delete a shape. */
  onDeleteShape?: (shapeId: string) => void;
  /** Toggle a shape's frozen (size-locked) state. */
  onToggleShapeFrozen?: (shapeId: string) => void;
}

function getPortPosition(node: CanvasNode, portId: string, isOutput: boolean): { x: number; y: number } {
  const ports = isOutput ? node.outputs : node.inputs;
  const idx = ports.findIndex(p => p.id === portId);
  if (idx < 0) return { x: node.x, y: node.y };
  return {
    x: node.x + (isOutput ? node.width : 0),
    y: node.y + HEADER_HEIGHT + idx * PORT_HEIGHT + PORT_HEIGHT / 2,
  };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const themeColors: Record<Theme, Record<string, string>> = {
  dark:        { bg:'#1a1a2e',grid:'#2a2a4a',nodeBg:'#16213e',nodeBorder:'#334155',text:'#e2e8f0',portBg:'#0f3460',conn:'#60a5fa',selected:'#f59e0b',inputBg:'#1e293b',header:'#f8fafc',sub:'#94a3b8' },
  light:       { bg:'#f1f5f9',grid:'#e2e8f0',nodeBg:'#ffffff',nodeBorder:'#cbd5e1',text:'#1e293b',portBg:'#f8fafc',conn:'#3b82f6',selected:'#f59e0b',inputBg:'#f1f5f9',header:'#ffffff',sub:'#64748b' },
  grasshopper: { bg:'#2d3436',grid:'#3d4447',nodeBg:'#4a5568',nodeBorder:'#718096',text:'#e2e8f0',portBg:'#2d3748',conn:'#68d391',selected:'#f6e05e',inputBg:'#2d3748',header:'#ffffff',sub:'#a0aec0' },
  autocad:     { bg:'#000000',grid:'#1a1a1a',nodeBg:'#1a1a1a',nodeBorder:'#444444',text:'#ffffff',portBg:'#111111',conn:'#00ff00',selected:'#ffff00',inputBg:'#0a0a0a',header:'#ffffff',sub:'#888888' },
};

export default function NodeCanvas({
  nodes, connections, zoom, panX, panY, connecting, selectedNodeId, theme,
  onMoveNode, onSelectNode, onStartConnecting, onUpdateConnecting, onFinishConnecting,
  onDeleteNode, onRemoveConnection, onUpdateInput, onEditNodeCode, onEditFormula,
  onZoomChange, onPanChange, onDropNode,
  onViewTrace, focusTarget,
  selectedNodeIds, groups, onSelectNodes, onMoveNodes, onGroupSelection, onUngroupSelection, onUpdateNodeFront, onMultiDelete,
  fitSignal,
  shapes, selectedShapeId, selectedShapeIds, onSelectShapes, onSelectShape, onMoveShape, onResizeShape, onUpdateShape,
  onDropShape, onDeleteShape, onToggleShapeFrozen,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = themeColors[theme];
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // memberIds = the full drag set (the node's whole group when grouped, else just itself).
  // memberShapeIds = the group's shapes (mixed groups move together too).
  const [dragNode, setDragNode] = useState<{ id: string; offsetX: number; offsetY: number; memberIds: string[]; memberShapeIds: string[] } | null>(null);
  const [editingPort, setEditingPort] = useState<{ nodeId: string; portId: string } | null>(null);
  /* ── Shapes feature: drag + corner-resize interaction state ── */
  const [dragShape, setDragShape] = useState<{ id: string; offsetX: number; offsetY: number; memberNodeIds: string[]; memberShapeIds: string[] } | null>(null);
  // ratio = the shape's aspect ratio captured at drag start (Ctrl = fixed ratio).
  const [shapeResize, setShapeResize] = useState<{ id: string; handle: ShapeResizeHandle; ratio: number } | null>(null);
  const [shapeMenu, setShapeMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  /* ── Shapes feature: "Edit dimensions" popover (right-click menu) ── */
  const [shapeSizeEditor, setShapeSizeEditor] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
  /* ── Node Groups: outline + name shown ONLY while hovering the group ── */
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  /* ── Node Groups feature: marquee (rubber-band) selection box ── */
  const [marquee, setMarquee] = useState<SelectionBox | null>(null);
  const marqueeShiftRef = useRef(false);
  // Node context menu is anchored to the node (not a fixed screen point), so it
  // follows the node while the canvas is panned or zoomed.
  const [contextMenu, setContextMenu] = useState<{ nodeId: string } | null>(null);
  // ─── NEW: connection context menu state ───
  const [connMenu, setConnMenu] = useState<{ x: number; y: number; connId: string } | null>(null);
  // ── Node Groups feature: right-click context menu for the current multi-selection ──
  const [selMenu, setSelMenu] = useState<{ x: number; y: number } | null>(null);
  // ─── NEW: hovered node for visual feedback (no blink) ───
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // ─── Calculation Trace: temporary highlight while panning to a traced node ───
  const [traceHighlightId, setTraceHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusTarget) return;
    const node = nodes.find(n => n.id === focusTarget.nodeId);
    if (!node) return;
    // Pan so the node is centered (canvas is not modified — view transform only).
    const svg = svgRef.current;
    if (svg) {
      const cx = svg.clientWidth / 2;
      const cy = svg.clientHeight / 2;
      onPanChange(cx - (node.x + node.width / 2) * zoom, cy - (node.y + node.height / 2) * zoom);
    }
    setTraceHighlightId(node.id);
    const t = window.setTimeout(() => {
      setTraceHighlightId(current => (current === node.id ? null : current));
    }, 2500);
    return () => window.clearTimeout(t);
    // Re-run only when a new focus request arrives (token changes per request).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  /* ── Zoom to Fit: zoom + pan so ALL nodes are visible and centered ──
     Triggered by the toolbar button via a changing token (same pattern as
     focusTarget). Uses the existing onZoomChange/onPanChange — no new view
     state, and the zoom respects the app's existing 0.1–5 limits. */
  useEffect(() => {
    if (!fitSignal) return;
    // Shapes are canvas items too — fit them along with the nodes.
    const bounds = computeContentBounds([...nodes, ...(shapes ?? [])]);
    const svg = svgRef.current;
    if (!bounds || !svg) return;
    const view = computeFitView(bounds, svg.clientWidth, svg.clientHeight);
    if (!view) return;
    onZoomChange(view.zoom);
    onPanChange(view.panX, view.panY);
    // Re-run only when a new fit request arrives (token changes per request).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (sx - rect.left - panX) / zoom, y: (sy - rect.top - panY) / zoom };
  }, [zoom, panX, panY]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.max(0.1, Math.min(5, zoom * factor));
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    onZoomChange(newZoom);
    onPanChange(mx - (mx - panX) * (newZoom / zoom), my - (my - panY) * (newZoom / zoom));
  }, [zoom, panX, panY]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
    } else if (e.button === 0) {
      const target = e.target as SVGElement;
      if (target === svgRef.current || target.classList.contains('canvas-bg')) {
        if (connecting.isConnecting) return; // a wire is being dragged
        // Marquee selection starts here; a tiny marquee (plain click) still
        // clears the selection, preserving the previous click behavior.
        const pos = screenToCanvas(e.clientX, e.clientY);
        marqueeShiftRef.current = e.shiftKey;
        setMarquee({ active: true, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      }
    }
  }, [panX, panY, connecting.isConnecting, screenToCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) onPanChange(e.clientX - panStart.x, e.clientY - panStart.y);
    if (marquee) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setMarquee(prev => (prev ? { ...prev, endX: pos.x, endY: pos.y } : prev));
    }
    // Node Groups: which group's bounds contain the cursor? (topmost wins)
    // The outline + name render only for the hovered group.
    if ((groups ?? []).length > 0) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const all = groups ?? [];
      let found: string | null = null;
      for (let i = all.length - 1; i >= 0; i--) {
        const b = computeGroupBounds(all[i], nodes, shapes ?? []);
        if (b && pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) {
          found = all[i].id;
          break;
        }
      }
      setHoveredGroupId(found);
    }
    if (dragNode) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const targetX = pos.x - dragNode.offsetX;
      const targetY = pos.y - dragNode.offsetY;
      if (dragNode.memberIds.length > 1 && onMoveNodes) {
        // Grouped node: move the whole group (nodes AND its shapes) by the delta.
        const primary = nodes.find(n => n.id === dragNode.id);
        if (primary) onMoveNodes(dragNode.memberIds, targetX - primary.x, targetY - primary.y, dragNode.memberShapeIds);
      } else {
        onMoveNode(dragNode.id, targetX, targetY);
      }
    }
    if (dragShape) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const targetX = pos.x - dragShape.offsetX;
      const targetY = pos.y - dragShape.offsetY;
      const total = dragShape.memberNodeIds.length + dragShape.memberShapeIds.length;
      if (total > 1 && onMoveNodes) {
        // Grouped shape: move the whole group (shapes AND its nodes) by the delta.
        const primary = (shapes ?? []).find(s => s.id === dragShape.id);
        if (primary) onMoveNodes(dragShape.memberNodeIds, targetX - primary.x, targetY - primary.y, dragShape.memberShapeIds);
      } else if (onMoveShape) {
        onMoveShape(dragShape.id, targetX, targetY);
      }
    }
    if (shapeResize && onResizeShape) {
      const s = (shapes ?? []).find(sh => sh.id === shapeResize.id);
      // A frozen shape cannot be resized (handles aren't rendered, but guard anyway).
      if (s && !s.frozen) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        // Ctrl (or Cmd) held → keep the aspect ratio captured at drag start.
        const box = (e.ctrlKey || e.metaKey)
          ? shapeRatioResizeBox(s, shapeResize.handle, pos.x, pos.y, shapeResize.ratio)
          : shapeResizeBox(s, shapeResize.handle, pos.x, pos.y);
        onResizeShape(s.id, box);
      }
    }
    if (connecting.isConnecting) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      onUpdateConnecting(pos.x, pos.y);
    }
  }, [isPanning, panStart, dragNode, marquee, nodes, groups, connecting, screenToCanvas, onMoveNodes,
      dragShape, onMoveShape, shapeResize, onResizeShape, shapes]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);
    setDragNode(null);
    setDragShape(null);
    setShapeResize(null);
    // Finish the marquee selection (if one was in progress).
    if (marquee) {
      const box = normalizeMarquee(marquee.startX, marquee.startY, marquee.endX, marquee.endY);
      const small = (box.x2 - box.x1) * zoom < 5 && (box.y2 - box.y1) * zoom < 5;
      if (small) {
        // Plain click on empty canvas → clear selection (existing behavior).
        // Shapes feature: also drop any shape selection.
        if (!marqueeShiftRef.current) { onSelectNode(null); onSelectShapes?.([], false); }
      } else {
        const ids = nodesInBox(nodes, box);
        // Shapes inside the box join the selection and are highlighted too.
        const shapeIds = nodesInBox(shapes ?? [], box);
        onSelectShapes?.(
          marqueeShiftRef.current
            ? Array.from(new Set([...(selectedShapeIds ?? []), ...shapeIds]))
            : shapeIds,
          false,
        );
        if (onSelectNodes) {
          if (marqueeShiftRef.current) {
            // Additive: union with the current selection.
            onSelectNodes(Array.from(new Set([...(selectedNodeIds ?? []), ...ids])));
          } else {
            onSelectNodes(ids);
          }
        } else if (ids.length === 1) {
          onSelectNode(ids[0]);
        }
      }
      marqueeShiftRef.current = false;
      setMarquee(null);
    }
    if (connecting.isConnecting) {
      const target = e.target as SVGElement;
      const portData = target.closest('[data-port-id]');
      if (portData) {
        onFinishConnecting(portData.getAttribute('data-node-id') || '', portData.getAttribute('data-port-id') || '');
      } else {
        onFinishConnecting();
      }
    }
  }, [connecting, marquee, zoom, nodes, shapes, onSelectNodes, selectedNodeIds, selectedShapeIds, onSelectNode, onSelectShapes]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelMenu(null);
    // Shift+click: toggle this node's (group's) membership in the selection.
    if (e.shiftKey && onSelectNodes) {
      const current = selectedNodeIds ?? [];
      const members = groupMemberIds(groups ?? [], nodeId);
      const memberSet = new Set(members);
      const allIn = members.every(id => current.includes(id));
      // Shapes feature: touching a node clears any shape selection.
      onSelectShape?.(null);
      if (allIn) onSelectNodes(current.filter(id => !memberSet.has(id)));
      else onSelectNodes(Array.from(new Set([...current, ...members])));
      return; // selection toggle only — no drag
    }
    onSelectNode(nodeId);
    onSelectShape?.(null);
    setConnMenu(null);
    setContextMenu(null);
    const pos = screenToCanvas(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      // Grouping feature: dragging a grouped node drags its whole group —
      // including the group's shapes (mixed node+shape groups).
      const memberIds = onMoveNodes ? groupMemberIds(groups ?? [], nodeId) : [nodeId];
      const memberShapeIds = onMoveNodes ? groupShapeIds(groups ?? [], nodeId) : [];
      setDragNode({ id: nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y, memberIds, memberShapeIds });
    }
  }, [nodes, screenToCanvas, onSelectNode, groups, onMoveNodes, onSelectNodes, selectedNodeIds]);

  const handlePortMouseDown = useCallback((e: React.MouseEvent, nodeId: string, portId: string, isOutput: boolean) => {
    e.stopPropagation();
    setConnMenu(null);
    const pos = screenToCanvas(e.clientX, e.clientY);
    onStartConnecting(nodeId, portId, isOutput, pos.x, pos.y);
  }, [screenToCanvas]);

  const handlePortMouseUp = useCallback((e: React.MouseEvent, nodeId: string, portId: string) => {
    e.stopPropagation();
    if (connecting.isConnecting) onFinishConnecting(nodeId, portId);
  }, [connecting]);

  // ─── NEW: click on connection wire ───
  const handleConnectionClick = useCallback((e: React.MouseEvent, connId: string) => {
    e.stopPropagation();
    setContextMenu(null);
    // Store container-relative coordinates so the menu opens right at the cursor
    // (clientX/Y are viewport coords and would be offset by the toolbar/toolbox).
    const rect = svgRef.current?.getBoundingClientRect();
    setConnMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), connId });
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConnMenu(null);
    setSelMenu(null);
    // Ctrl+right-click: toggle this node's (group's) membership in the current
    // multi-selection — no menu (build a mixed node+shape selection one by one).
    if (e.ctrlKey || e.metaKey) {
      const current = selectedNodeIds ?? [];
      const members = groupMemberIds(groups ?? [], nodeId);
      const memberSet = new Set(members);
      const allIn = members.every(id => current.includes(id));
      onSelectNodes?.(
        allIn ? current.filter(id => !memberSet.has(id)) : Array.from(new Set([...current, ...members])),
      );
      return;
    }
    // Right-clicking an unselected node selects it (group-aware) so the
    // menu's Group/Ungroup actions have a well-defined target.
    if (!(selectedNodeIds ?? []).includes(nodeId)) onSelectNode(nodeId);
    onSelectShape?.(null);
    setContextMenu({ nodeId });
  }, [selectedNodeIds, onSelectNode, onSelectNodes, groups]);

  // Right-click on empty canvas with a selection (nodes and/or shapes) → menu.
  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    const current = (selectedNodeIds ?? []).length + (selectedShapeIds ?? []).length;
    if (current === 0) return; // keep the native browser menu as before
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setShapeMenu(null);
    const rect = svgRef.current?.getBoundingClientRect();
    setSelMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, [selectedNodeIds, selectedShapeIds]);

  /* ── Shapes feature: shape body drag (select + move; grouped shapes move
     their whole group — nodes and shapes — with them) ── */
  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shape: CanvasShape) => {
    e.stopPropagation();
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
    onSelectShape?.(shape.id);
    const pos = screenToCanvas(e.clientX, e.clientY);
    const g = getGroupOfShape(groups ?? [], shape.id);
    setDragShape({
      id: shape.id,
      offsetX: pos.x - shape.x,
      offsetY: pos.y - shape.y,
      memberNodeIds: g ? [...g.nodeIds] : [],
      memberShapeIds: g ? [...(g.shapeIds ?? [shape.id])] : [shape.id],
    });
  }, [screenToCanvas, onSelectShape, groups]);

  /* ── Shapes feature: begin a corner-handle resize (only rendered when
     selected AND not frozen, so the guard is belt-and-braces). The aspect
     ratio is captured now so Ctrl can lock it for the whole drag. ── */
  const handleShapeHandleMouseDown = useCallback((e: React.MouseEvent, shape: CanvasShape, handle: ShapeResizeHandle) => {
    e.stopPropagation();
    if (shape.frozen) return;
    setShapeResize({ id: shape.id, handle, ratio: shape.width / Math.max(1, shape.height) });
  }, []);

  /* ── Shapes feature: right-click — Ctrl toggles selection (multi-select
     shapes one by one); plain right-click opens the shape menu ── */
  const handleShapeContextMenu = useCallback((e: React.MouseEvent, shapeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeSizeEditor(null);
    if (e.ctrlKey || e.metaKey) {
      const current = selectedShapeIds ?? [];
      const next = current.includes(shapeId)
        ? current.filter(id => id !== shapeId)
        : [...current, shapeId];
      onSelectShapes?.(next, false, next.includes(shapeId) ? shapeId : undefined);
      return;
    }
    if (shapeId !== selectedShapeId) onSelectShape?.(shapeId);
    const rect = svgRef.current?.getBoundingClientRect();
    setShapeMenu({ id: shapeId, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, [selectedShapeId, selectedShapeIds, onSelectShape, onSelectShapes]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY);
    // Shapes feature: the Toolbox "Shapes" tab drops shapeType payloads.
    const shapeType = e.dataTransfer.getData('shapeType') as ShapeType | '';
    if (shapeType && onDropShape) { onDropShape(shapeType, pos.x, pos.y); return; }
    const type = e.dataTransfer.getData('nodeType');
    if (type) onDropNode(type, pos.x, pos.y);
  }, [screenToCanvas, onDropShape]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && !editingPort) {
        // Shapes feature: a selected shape is deleted before any node logic runs.
        if (selectedShapeId && (shapes ?? []).some(s => s.id === selectedShapeId)) {
          onDeleteShape?.(selectedShapeId);
          return;
        }
        const multi = selectedNodeIds ?? [];
        if (multi.length > 1 && onMultiDelete) onMultiDelete(multi);
        else if (selectedNodeId) onDeleteNode(selectedNodeId);
      }
      if (e.key === 'Escape') { setContextMenu(null); setConnMenu(null); setSelMenu(null); setShapeMenu(null); setShapeSizeEditor(null); setEditingPort(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedNodeIds, editingPort, onMultiDelete, onDeleteNode, selectedShapeId, shapes, onDeleteShape]);

  // ─── Grid ───
  const renderGrid = () => {
    const gs = 20;
    return (
      <>
        <defs>
          <pattern id="smG" width={gs} height={gs} patternUnits="userSpaceOnUse">
            <path d={`M ${gs} 0 L 0 0 0 ${gs}`} fill="none" stroke={colors.grid} strokeWidth="0.5"/>
          </pattern>
          <pattern id="lgG" width={gs*5} height={gs*5} patternUnits="userSpaceOnUse">
            <rect width={gs*5} height={gs*5} fill="url(#smG)"/>
            <path d={`M ${gs*5} 0 L 0 0 0 ${gs*5}`} fill="none" stroke={colors.grid} strokeWidth="1"/>
          </pattern>
        </defs>
        <rect className="canvas-bg" width="100%" height="100%" fill={colors.bg} />
        <rect className="canvas-bg" width="100%" height="100%" fill="url(#lgG)" />
      </>
    );
  };

  // ─── Connection rendering with click hit-area ───
  const renderConnection = (conn: Connection) => {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId);
    const toNode = nodes.find(n => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return null;
    const from = getPortPosition(fromNode, conn.fromPortId, true);
    const to = getPortPosition(toNode, conn.toPortId, false);
    const isHighlighted = connMenu?.connId === conn.id;

    return (
      <g key={conn.id}>
        <path
          d={bezierPath(from.x, from.y, to.x, to.y)}
          fill="none"
          stroke={colors.conn}
          strokeWidth={isHighlighted ? 3.5 : 2.5}
          strokeOpacity={isHighlighted ? 1 : 0.8}
        />
        {/* Wide invisible hit-area so user can click the wire */}
        <path
          d={bezierPath(from.x, from.y, to.x, to.y)}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          className="cursor-pointer"
          onClick={(e) => handleConnectionClick(e, conn.id)}
        />
      </g>
    );
  };

  const renderActiveConnection = () => {
    if (!connecting.isConnecting || !connecting.fromNodeId || !connecting.fromPortId) return null;
    const fromNode = nodes.find(n => n.id === connecting.fromNodeId);
    if (!fromNode) return null;
    const from = getPortPosition(fromNode, connecting.fromPortId, connecting.fromIsOutput || false);
    const to = { x: connecting.mouseX, y: connecting.mouseY };
    const path = connecting.fromIsOutput ? bezierPath(from.x, from.y, to.x, to.y) : bezierPath(to.x, to.y, from.x, from.y);
    return <path d={path} fill="none" stroke={colors.conn} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.6} />;
  };

  // ─── Value formatter ───
  const fmt = (v: any): string => {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v !== 'number') return String(v ?? '—');
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e7) return v.toExponential(2);
    if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (abs < 0.01 && abs > 0) return v.toExponential(2);
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  // Value + designation (unit). The designation is only appended when it is
  // actually defined on the port, keeping empty "designations" out of the UI.
  const portValueText = (port: { value?: any; unit?: string }): string => {
    let base: string;
    if (typeof port.value === 'boolean') base = port.value ? 'TRUE' : 'FALSE';
    else if (port.value === undefined || port.value === null || port.value === '') base = '';
    else base = fmt(port.value);
    if (!base) return '';
    return port.unit ? `${base} ${port.unit}` : base;
  };

  // ─── Port rendering ───
  // Clean layout: fixed regions so no text can overlap.
  //   INPUTS  → [●] label : [ value/editor ]
  //   OUTPUTS → [●] value : name            (value left, name right)
  const renderPort = (node: CanvasNode, port: typeof node.inputs[0], idx: number, isOutput: boolean) => {
    const x = isOutput ? node.width : 0;
    const y = HEADER_HEIGHT + idx * PORT_HEIGHT + PORT_HEIGHT / 2;
    const connected = isOutput
      ? connections.some(c => c.fromNodeId === node.id && c.fromPortId === port.id)
      : connections.some(c => c.toNodeId === node.id && c.toPortId === port.id);
    const portColor = isOutput ? '#60a5fa' : '#f97316';

    const labelText = truncateText(port.name, LABEL_MAX_CHARS);
    const valueText = portValueText(port);
    const inputValueText = truncateText(valueText || (connected ? '—' : ''), INPUT_VALUE_MAX_CHARS);
    const outNameText = truncateText(port.name, OUT_NAME_MAX_CHARS);

    return (
      <g
        key={port.id}
        data-node-id={node.id}
        data-port-id={port.id}
        data-is-output={isOutput}
        className="cursor-crosshair"
        onMouseDown={(e) => handlePortMouseDown(e, node.id, port.id, isOutput)}
        onMouseUp={(e) => handlePortMouseUp(e, node.id, port.id)}
      >
        {/* Port circle — FIX #2: transform-box fill-box so scale works on SVG circles */}
        <circle cx={x} cy={y} r={PORT_RADIUS}
          fill={connected ? portColor : colors.portBg}
          stroke={portColor} strokeWidth={1.5}
          className="hover:scale-110"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', transition: 'transform 0.15s ease' }}
        />
        {connected && <circle cx={x} cy={y} r={3} fill="white" />}
        {connected && <circle cx={x} cy={y} r={3} fill="white" />}

        {/* ─── INPUT PORTS ─── */}
        {!isOutput && (
          <>
            {/* Label (truncated; full name in tooltip) */}
            <text x={LABEL_X} y={y + 4} textAnchor="start" fill={colors.text} fontSize={10} fontWeight="700" fontFamily="system-ui">
              {labelText}
              <title>{port.name}{port.unit ? ` (${port.unit})` : ''}</title>
            </text>
            {/* Fixed ":" — always ends before the value box, so it can't overlap */}
            <text x={COLON_X} y={y + 4} textAnchor="end" fill={colors.sub} fontSize={9} fontFamily="system-ui" opacity={0.55}>:</text>

            {/* Editable number value (unconnected) */}
            {!connected && port.type === 'number' && (
              <g>
                <rect x={VALUE_BOX_X} y={y - 9} width={node.width - VALUE_BOX_X - 12} height={18} rx={3}
                  fill={colors.inputBg} stroke={colors.nodeBorder} strokeWidth={0.5} className="cursor-text"
                  onClick={(e) => { e.stopPropagation(); setEditingPort({ nodeId: node.id, portId: port.id }); }} />
                {editingPort?.nodeId === node.id && editingPort?.portId === port.id ? (
                  <foreignObject x={VALUE_TEXT_X - 3} y={y - 8} width={node.width - VALUE_TEXT_X - 6} height={16}>
                    <input type="number" defaultValue={port.value} autoFocus
                      style={{ width:'100%',height:'100%',background:'transparent',border:'none',color:colors.text,fontSize:'10px',outline:'none',fontFamily:'monospace' }}
                      onBlur={(e) => { onUpdateInput(node.id, port.id, parseFloat(e.target.value) || 0); setEditingPort(null); }}
                      onKeyDown={(e) => { if (e.key==='Enter') { onUpdateInput(node.id, port.id, parseFloat((e.target as HTMLInputElement).value)||0); setEditingPort(null); } }} />
                  </foreignObject>
                ) : (
                  <text x={VALUE_TEXT_X} y={y + 2} fill={colors.text} fontSize={10} fontFamily="monospace" className="cursor-text"
                    onClick={(e) => { e.stopPropagation(); setEditingPort({ nodeId: node.id, portId: port.id }); }}>
                    {inputValueText}
                    <title>{valueText}</title>
                  </text>
                )}
              </g>
            )}
            {/* Editable string value (unconnected) */}
            {!connected && port.type === 'string' && (
              <g>
                <rect x={VALUE_BOX_X} y={y - 9} width={node.width - VALUE_BOX_X - 12} height={18} rx={3} fill={colors.inputBg} stroke={colors.nodeBorder} strokeWidth={0.5} className="cursor-text"
                  onClick={(e) => { e.stopPropagation(); setEditingPort({ nodeId: node.id, portId: port.id }); }} />
                {editingPort?.nodeId === node.id && editingPort?.portId === port.id ? (
                  <foreignObject x={VALUE_TEXT_X - 3} y={y - 8} width={node.width - VALUE_TEXT_X - 6} height={16}>
                    <input type="text" defaultValue={port.value} autoFocus
                      style={{ width:'100%',height:'100%',background:'transparent',border:'none',color:colors.text,fontSize:'10px',outline:'none',fontFamily:'monospace' }}
                      onBlur={(e) => { onUpdateInput(node.id, port.id, e.target.value); setEditingPort(null); }}
                      onKeyDown={(e) => { if (e.key==='Enter') { onUpdateInput(node.id, port.id, (e.target as HTMLInputElement).value); setEditingPort(null); } }} />
                  </foreignObject>
                ) : (
                  <text x={VALUE_TEXT_X} y={y + 2} fill={colors.text} fontSize={10} fontFamily="monospace" className="cursor-text"
                    onClick={(e) => { e.stopPropagation(); setEditingPort({ nodeId: node.id, portId: port.id }); }}>
                    {inputValueText}
                    <title>{valueText}</title>
                  </text>
                )}
              </g>
            )}
            {/* Boolean toggle (unconnected) */}
            {!connected && port.type === 'boolean' && (
              <g onClick={(e) => { e.stopPropagation(); onUpdateInput(node.id, port.id, !port.value); }} className="cursor-pointer">
                <rect x={VALUE_BOX_X} y={y - 9} width={node.width - VALUE_BOX_X - 12} height={18} rx={3} fill={colors.inputBg} stroke={colors.nodeBorder} strokeWidth={0.5} />
                <text x={VALUE_TEXT_X} y={y + 2} fill={port.value ? '#10b981' : colors.sub} fontSize={10} fontFamily="monospace">
                  {port.value ? '✓ TRUE' : '✗ FALSE'}
                </text>
              </g>
            )}
            {/* Connected value (from the upstream output port) */}
            {connected && (
              <text x={VALUE_TEXT_X} y={y + 2} fill="#60a5fa" fontSize={10} fontFamily="monospace" fontStyle="italic">
                {inputValueText}
                <title>{valueText}</title>
              </text>
            )}
          </>
        )}

        {/* ─── OUTPUT PORTS ─── */}
        {/* Only the output name is shown on the node — the computed value text is
            hidden to keep the node UI clean (values remain in the Properties panel). */}
        {isOutput && (
          <text x={node.width - 10} y={y + 4} textAnchor="end" fill={colors.sub} fontSize={10} fontFamily="system-ui">
            {outNameText}
            <title>{port.name}</title>
          </text>
        )}
      </g>
    );
  };

  // ─── Node rendering ───
  const renderNode = (node: CanvasNode) => {
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId && !isSelected; // FIX #2: no blink, just subtle bg shift
    const headerColor = node.color || '#666';
    const maxPorts = Math.max(node.inputs.length, node.outputs.length);
    const nodeH = HEADER_HEIGHT + maxPorts * PORT_HEIGHT + 10;

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}>
        {/* Shadow */}
        <rect x={3} y={3} width={node.width} height={nodeH} rx={8} fill="rgba(0,0,0,0.25)" />
        {/* Body — FIX #2: only background shifts on hover, no transform/scale */}
        <rect width={node.width} height={nodeH} rx={8}
          fill={isHovered && !node.error ? colors.nodeBg : colors.nodeBg}
          stroke={isSelected ? colors.selected : colors.nodeBorder}
          strokeWidth={isSelected ? 2.5 : 1}
          strokeOpacity={isHovered ? 0.6 : 1}
          style={{ transition: 'stroke-opacity 0.2s ease, stroke-width 0.2s ease' }}
        />
        {/* Calculation Trace: temporary highlight ring (view-only, auto-clears) */}
        {traceHighlightId === node.id && (
          <rect x={-6} y={-6} width={node.width + 12} height={nodeH + 12} rx={12}
            fill="none" stroke={colors.selected} strokeWidth={3}
            className="animate-pulse pointer-events-none" />
        )}
        {/* Header */}
        <rect width={node.width} height={HEADER_HEIGHT} rx={8} fill={headerColor} opacity={0.9} />
        <rect y={HEADER_HEIGHT - 8} width={node.width} height={8} fill={headerColor} opacity={0.9} />
        {/* Title (truncated so it can't overlap the category badge) */}
        <text x={12} y={HEADER_HEIGHT / 2 + 5} fill={colors.header} fontSize={13} fontWeight="600" fontFamily="system-ui">
          {truncateText(node.label, 17)}
          <title>{node.label}</title>
        </text>
        {/* Category badge */}
        <text x={node.width - 8} y={HEADER_HEIGHT / 2 + 4} textAnchor="end" fill={colors.header} fontSize={9} opacity={0.6} fontFamily="system-ui">{node.category}</text>
        {/* Error dot */}
        {node.error && <circle cx={node.width - 14} cy={HEADER_HEIGHT / 2} r={5} fill="#ef4444"><title>{node.error}</title></circle>}
        {/* Ports */}
        {node.inputs.map((p, i) => renderPort(node, p, i, false))}
        {node.outputs.map((p, i) => renderPort(node, p, i, true))}
      </g>
    );
  };

  /* ── Shapes feature: render one canvas shape ──
     Geometry lives in a child <g> so the (translucent) fill stays clickable.
     Every selected shape is highlighted; resize handles are on the PRIMARY
     one only. Resize handles only exist when selected AND not frozen. */
  const renderShape = (shape: CanvasShape) => {
    const isSelected = shape.id === selectedShapeId || (selectedShapeIds ?? []).includes(shape.id);
    const isPrimary = shape.id === selectedShapeId;
    const def = getShapeDefinition(shape.type);
    const shapeColor = shape.color || colors.conn;
    const stroke = isSelected ? colors.selected : shapeColor;
    let geometry: React.ReactNode;
    if (shape.type === 'rectangle' || shape.type === 'square') {
      geometry = <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={3} />;
    } else if (shape.type === 'circle') {
      geometry = <ellipse
        cx={shape.x + shape.width / 2} cy={shape.y + shape.height / 2}
        rx={shape.width / 2} ry={shape.height / 2} />;
    } else {
      geometry = <polygon points={shapePolygonPoints(shape.type, shape.x, shape.y, shape.width, shape.height) || ''} />;
    }
    return (
      <g key={shape.id}
        onMouseDown={(e) => handleShapeMouseDown(e, shape)}
        onContextMenu={(e) => handleShapeContextMenu(e, shape.id)}
        style={{ cursor: dragShape?.id === shape.id ? 'grabbing' : 'move' }}>
        <g fill={shapeColor} fillOpacity={shape.fillOpacity ?? DEFAULT_SHAPE_FILL_OPACITY} stroke={stroke} strokeWidth={isSelected ? 2.5 : 1.5}>
          {geometry}
          <title>{def?.description}{shape.frozen ? ' — size frozen (right-click to unfreeze)' : ''}</title>
        </g>
        {/* Frozen badge: the shape's size is locked */}
        {shape.frozen && (
          <text x={shape.x + shape.width - 6} y={shape.y + 18} textAnchor="end"
            fontSize={14} pointerEvents="none" opacity={0.9}>❄️</text>
        )}
        {/* Corner resize handles (primary selection only, hidden while frozen) */}
        {isPrimary && !shape.frozen && onResizeShape && (() => {
          const hs = 10 / zoom;
          const corners: [ShapeResizeHandle, number, number, string][] = [
            ['nw', shape.x, shape.y, 'nwse-resize'],
            ['ne', shape.x + shape.width, shape.y, 'nesw-resize'],
            ['sw', shape.x, shape.y + shape.height, 'nesw-resize'],
            ['se', shape.x + shape.width, shape.y + shape.height, 'nwse-resize'],
          ];
          return corners.map(([h, hx, hy, cursor]) => (
            <rect key={h}
              x={hx - hs / 2} y={hy - hs / 2} width={hs} height={hs} rx={1.5 / zoom}
              fill={colors.nodeBg} stroke={colors.selected} strokeWidth={1.5 / zoom}
              style={{ cursor }}
              onMouseDown={(e) => handleShapeHandleMouseDown(e, shape, h)} />
          ));
        })()}
      </g>
    );
  };

  /* ── Node Groups + Shapes: the current COMBINED selection (nodes + shapes)
     is the target of the Group/Ungroup actions in every menu ── */
  const menuNodeIds = selectedNodeIds ?? [];
  const menuShapeIds = selectedShapeIds ?? [];
  const menuTotal = menuNodeIds.length + menuShapeIds.length;
  const menuCanGroup = Boolean(onGroupSelection) && menuTotal >= 2;
  const menuCanUngroup = Boolean(onUngroupSelection) && hasGroupMembership(groups ?? [], menuNodeIds, menuShapeIds);

  // ─── Context menu anchor ───
  // Compute where the open node context menu should sit, in container-relative
  // coordinates. This runs on every render, so the menu tracks the node as the
  // canvas is panned or zoomed (it never drifts away from its node).
  const contextMenuAnchor = (() => {
    if (!contextMenu) return null;
    const node = nodes.find(n => n.id === contextMenu.nodeId);
    if (!node) return null;
    const svg = svgRef.current;
    const cw = svg?.clientWidth ?? window.innerWidth;
    const ch = svg?.clientHeight ?? window.innerHeight;
    const nx = panX + node.x * zoom;
    const ny = panY + node.y * zoom;
    const nw = node.width * zoom;
    const nh = node.height * zoom;
    const MENU_W = 208;
    // Height estimate includes optional items (draw order / trace / group /
    // ungroup) so the on-screen clamping below keeps the whole menu visible.
    const MENU_H = 214 + (onViewTrace ? 38 : 0) + (menuCanGroup ? 38 : 0) + (menuCanUngroup ? 38 : 0);
    const GAP = 8;
    // Prefer to the right of the node; flip to the left when it would overflow.
    let x = nx + nw + GAP;
    if (x + MENU_W > cw - 4) x = nx - GAP - MENU_W;
    x = Math.max(4, Math.min(x, Math.max(4, cw - MENU_W - 4)));
    // Align with the node top; flip up when it would overflow the bottom.
    let y = ny;
    if (y + MENU_H > ch - 4) y = ny + nh - MENU_H;
    y = Math.max(4, Math.min(y, Math.max(4, ch - MENU_H - 4)));
    return { x, y };
  })();

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: colors.bg }}>
      <svg ref={svgRef} className="w-full h-full"
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoveredGroupId(null)}
        onContextMenu={handleBackgroundContextMenu}
        onDragOver={handleDragOver} onDrop={handleDrop}
        style={{ cursor: isPanning ? 'grabbing' : dragNode ? 'move' : connecting.isConnecting ? 'crosshair' : 'default' }}>
        {renderGrid()}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* Back layer: shapes not marked "front" (per-item draw order) */}
          {(shapes ?? []).filter(s => !s.front).map(renderShape)}
          {/* Node group outlines — shown ONLY while hovering the group */}
          {(groups ?? []).filter(g => g.id === hoveredGroupId).map(g => {
            const bounds = computeGroupBounds(g, nodes, shapes ?? []);
            if (!bounds) return null;
            return (
              <g key={g.id} pointerEvents="none">
                <rect
                  x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} rx={10}
                  fill="none" stroke={colors.conn} strokeWidth={1.5 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`} opacity={0.55}
                />
                <text
                  x={bounds.x + 8 / zoom} y={bounds.y - 5 / zoom}
                  fontSize={11 / zoom} fontWeight="600" fontFamily="system-ui"
                  fill={colors.conn} opacity={0.9}
                >
                  {g.name}
                </text>
              </g>
            );
          })}
          {connections.map(renderConnection)}
          {renderActiveConnection()}
          {/* Default layer: nodes (always above wires, as before) */}
          {nodes.filter(n => !n.front).map(renderNode)}
          {/* Front layer: items marked "front" (nodes and shapes) */}
          {nodes.filter(n => n.front).map(renderNode)}
          {(shapes ?? []).filter(s => s.front).map(renderShape)}
          {/* Marquee selection box (grouping feature) */}
          {marquee?.active && (() => {
            const box = normalizeMarquee(marquee.startX, marquee.startY, marquee.endX, marquee.endY);
            return (
              <rect
                x={box.x1} y={box.y1} width={box.x2 - box.x1} height={box.y2 - box.y1}
                fill={colors.conn} fillOpacity={0.08} stroke={colors.conn}
                strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                pointerEvents="none"
              />
            );
          })()}
        </g>
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-mono"
        style={{ background: colors.nodeBg, color: colors.text, border: `1px solid ${colors.nodeBorder}` }}>
        {Math.round(zoom * 100)}% &bull; {nodes.length} nodes &bull; {connections.length} conns{shapes && shapes.length > 0 ? ` &bull; ${shapes.length} shapes` : ''}
      </div>

      {/* ─── NEW: Connection context menu ─── */}
      {connMenu && (
        <div className="absolute z-50 rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
          style={{ left: connMenu.x, top: connMenu.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
          <div className="px-3 py-2 text-xs font-semibold" style={{ color: colors.sub, borderBottom: `1px solid ${colors.nodeBorder}` }}>🔗 Connection</div>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors" style={{ color: '#ef4444' }}
            onClick={() => { onRemoveConnection(connMenu.connId); setConnMenu(null); }}>🗑️ Delete Connection</button>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
            onClick={() => { setConnMenu(null); }}>✕ Cancel</button>
        </div>
      )}

      {/* Node context menu — anchored to the node and follows it on pan/zoom */}
      {contextMenu && contextMenuAnchor && (
        <div className="absolute z-50 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
          style={{ left: contextMenuAnchor.x, top: contextMenuAnchor.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
            onClick={() => { onEditNodeCode(contextMenu.nodeId); setContextMenu(null); }}>🧮 Edit Node Code</button>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
            onClick={() => { onEditFormula(contextMenu.nodeId); setContextMenu(null); }}>⚡ Edit Formula &amp; Inputs</button>
          {/* Shapes feature: per-item draw order (front layer) */}
          {onUpdateNodeFront && (() => {
            const n = nodes.find(nn => nn.id === contextMenu.nodeId);
            const front = Boolean(n?.front);
            return (
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                onClick={() => { onUpdateNodeFront(n!.id, !front); setContextMenu(null); }}>
                {front ? '🔽 Send to back' : '🔼 Bring to front'}
              </button>
            );
          })()}
          {/* Node Groups integration — optional, inert when not provided.
             Acts on the combined selection (nodes AND shapes). */}
          {(menuCanGroup || menuCanUngroup) && (
            <>
              <div className="my-1 border-t" style={{ borderColor: colors.nodeBorder }} />
              {menuCanGroup && (
                <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                  onClick={() => { onGroupSelection?.(menuNodeIds, menuShapeIds); setContextMenu(null); }}>📦 Group Selection (Ctrl+G)</button>
              )}
              {menuCanUngroup && (
                <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                  onClick={() => { onUngroupSelection?.(menuNodeIds, menuShapeIds); setContextMenu(null); }}>📂 Ungroup (Ctrl+Shift+G)</button>
              )}
            </>
          )}
          {/* Calculation Trace integration — optional, inert when not provided */}
          {onViewTrace && (
            <>
              <div className="my-1 border-t" style={{ borderColor: colors.nodeBorder }} />
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                onClick={() => { onViewTrace(contextMenu.nodeId); setContextMenu(null); }}>🔎 View Calculation Trace</button>
              <div className="my-1 border-t" style={{ borderColor: colors.nodeBorder }} />
            </>
          )}
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors" style={{ color: '#ef4444' }}
            onClick={() => { onDeleteNode(contextMenu.nodeId); setContextMenu(null); }}>🗑️ Delete Node</button>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.sub }}
            onClick={() => setContextMenu(null)}>✕ Cancel</button>
        </div>
      )}

      {/* Node Groups: right-click menu for the current selection (nodes + shapes) */}
      {selMenu && (
        <div className="absolute z-50 rounded-xl shadow-2xl overflow-hidden min-w-[210px]"
          style={{ left: selMenu.x, top: selMenu.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
          <div className="px-3 py-2 text-xs font-semibold" style={{ color: colors.sub, borderBottom: `1px solid ${colors.nodeBorder}` }}>
            📦 Selection ({menuTotal} item{menuTotal === 1 ? '' : 's'})
          </div>
          {menuCanGroup && (
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
              onClick={() => { onGroupSelection?.(menuNodeIds, menuShapeIds); setSelMenu(null); }}>📦 Group Selection (Ctrl+G)</button>
          )}
          {menuCanUngroup && (
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
              onClick={() => { onUngroupSelection?.(menuNodeIds, menuShapeIds); setSelMenu(null); }}>📂 Ungroup (Ctrl+Shift+G)</button>
          )}
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.sub }}
            onClick={() => { onSelectNode(null); onSelectShapes?.([], false); setSelMenu(null); }}>✕ Clear Selection</button>
        </div>
      )}

      {/* Shapes feature: right-click menu for a shape (freeze size / delete) */}
      {shapeMenu && (() => {
        const s = (shapes ?? []).find(sh => sh.id === shapeMenu.id);
        if (!s) return null;
        return (
          <div className="absolute z-50 rounded-xl shadow-2xl overflow-hidden min-w-[210px]"
            style={{ left: shapeMenu.x, top: shapeMenu.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
            <div className="px-3 py-2 text-xs font-semibold" style={{ color: colors.sub, borderBottom: `1px solid ${colors.nodeBorder}` }}>
              {getShapeDefinition(s.type)?.icon || '◼'} {getShapeDefinition(s.type)?.label || s.type}
            </div>
            {onToggleShapeFrozen && (
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                onClick={() => { onToggleShapeFrozen(s.id); setShapeMenu(null); }}>
                {s.frozen ? '❄️ Unfreeze size' : '🧊 Freeze size'}
              </button>
            )}
            {/* Edit exact dimensions (position is kept) */}
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
              onClick={() => {
                setShapeSizeEditor({
                  id: s.id,
                  x: shapeMenu.x,
                  y: shapeMenu.y,
                  width: Math.round(s.width),
                  height: Math.round(s.height),
                });
                setShapeMenu(null);
              }}>✏️ Edit dimensions</button>
            {/* Per-item draw order (front layer) */}
            {onUpdateShape && (
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                onClick={() => { onUpdateShape(s.id, { front: !s.front }); setShapeMenu(null); }}>
                {s.front ? '🔽 Send to back' : '🔼 Bring to front'}
              </button>
            )}
            {/* Node Groups: group/ungroup acts on the combined selection */}
            {(menuCanGroup || menuCanUngroup) && (
              <>
                <div className="my-1 border-t" style={{ borderColor: colors.nodeBorder }} />
                {menuCanGroup && (
                  <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                    onClick={() => { onGroupSelection?.(menuNodeIds, menuShapeIds); setShapeMenu(null); }}>📦 Group Selection (Ctrl+G)</button>
                )}
                {menuCanUngroup && (
                  <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                    onClick={() => { onUngroupSelection?.(menuNodeIds, menuShapeIds); setShapeMenu(null); }}>📂 Ungroup (Ctrl+Shift+G)</button>
                )}
              </>
            )}
            {onDeleteShape && (
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors" style={{ color: '#ef4444' }}
                onClick={() => { onDeleteShape(s.id); setShapeMenu(null); }}>🗑️ Delete Shape</button>
            )}
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.sub }}
              onClick={() => setShapeMenu(null)}>✕ Cancel</button>
          </div>
        );
      })()}

      {/* Shapes feature: "Edit dimensions" popover (from the shape right-click menu) */}
      {shapeSizeEditor && (() => {
        const s = (shapes ?? []).find(sh => sh.id === shapeSizeEditor.id);
        if (!s) return null;
        const apply = () => {
          onResizeShape?.(s.id, {
            x: s.x, y: s.y,
            width: Math.max(MIN_SHAPE_SIZE, shapeSizeEditor.width),
            height: Math.max(MIN_SHAPE_SIZE, shapeSizeEditor.height),
          });
          setShapeSizeEditor(null);
        };
        return (
          <div className="absolute z-50 rounded-xl shadow-2xl p-3 min-w-[200px] space-y-2"
            style={{ left: shapeSizeEditor.x, top: shapeSizeEditor.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
            <div className="text-xs font-semibold" style={{ color: colors.sub }}>✏️ Edit dimensions</div>
            {s.frozen && (
              <p className="text-[10px]" style={{ color: '#f59e0b' }}>🧊 Size is frozen — unfreeze to edit.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px]" style={{ color: colors.sub }}>
                Width
                <input
                  type="number" min={MIN_SHAPE_SIZE} value={shapeSizeEditor.width} disabled={s.frozen}
                  onChange={(e) => setShapeSizeEditor(prev => (prev ? { ...prev, width: parseFloat(e.target.value) || 0 } : prev))}
                  className="w-full mt-0.5 px-2 py-1 rounded text-sm outline-none disabled:opacity-50"
                  style={{ background: colors.inputBg, color: colors.text, border: `1px solid ${colors.nodeBorder}`, fontFamily: 'monospace' }} />
              </label>
              <label className="text-[10px]" style={{ color: colors.sub }}>
                Height
                <input
                  type="number" min={MIN_SHAPE_SIZE} value={shapeSizeEditor.height} disabled={s.frozen}
                  onChange={(e) => setShapeSizeEditor(prev => (prev ? { ...prev, height: parseFloat(e.target.value) || 0 } : prev))}
                  className="w-full mt-0.5 px-2 py-1 rounded text-sm outline-none disabled:opacity-50"
                  style={{ background: colors.inputBg, color: colors.text, border: `1px solid ${colors.nodeBorder}`, fontFamily: 'monospace' }} />
              </label>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-1 rounded text-xs font-medium transition-all hover:opacity-80" style={{ background: colors.conn, color: '#0b1220' }}
                onClick={apply} disabled={s.frozen}>Apply</button>
              <button className="flex-1 px-3 py-1 rounded text-xs font-medium transition-all hover:bg-white/10" style={{ color: colors.sub }}
                onClick={() => setShapeSizeEditor(null)}>Cancel</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
