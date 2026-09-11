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
  DEFAULT_TEXT_FONT_SIZE,
  MIN_SHAPE_SIZE,
  getShapeDefinition,
  shapePolygonPoints,
  shapeRatioResizeBox,
  shapeResizeBox,
  type ShapeResizeHandle,
} from '../features/canvas-shapes';
import {
  TOOLBOX_TOUCH_DROP_EVENT,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE,
  MIN_ZOOM,
  MAX_ZOOM,
  computePinchView,
  isWithinTapThreshold,
  type ToolboxTouchDropDetail,
} from '../features/touch-input';

const PORT_RADIUS = 7;
const PORT_HEIGHT = 28;
const HEADER_HEIGHT = 36;

/* ─── Touch support ───
   Fingers are far less precise than a mouse cursor, so the ports and the shape
   resize handles get a larger INVISIBLE hit area (see `.touch-hit` in
   index.css). Nothing is drawn differently, and the areas are inert for a
   mouse, so the desktop hit areas stay exactly as they are. */
const TOUCH_PORT_RADIUS = 13;      // vs the 7px visible port circle
const TOUCH_HANDLE_PAD = 8;        // extra canvas units around a resize handle
const TOUCH_DOUBLE_TAP_MS = 350;   // finger double-tap → existing double-click

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

/* ─── Wire selection + custom wire colors ─── */
const SELECTED_WIRE_COLOR = '#ef4444';  // a selected wire always renders red
const WIRE_COLOR_PRESETS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

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
  /** Recolor a wire (undefined = reset to the theme default). Absent = no color UI. */
  onUpdateConnectionColor?: (connId: string, color: string | undefined) => void;
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
  /* ── Alignment snap (smart guides) ── */
  /** When true, dragging a node snaps to nearby nodes' edges/centers with guide lines. */
  snapEnabled?: boolean;
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
  /** The full shape selection (marquee) — all are highlighted. */
  selectedShapeIds?: string[];
  /** Select a single shape (click; null clears). Mutually exclusive with node selection. */
  onSelectShape?: (shapeId: string | null) => void;
  /** Set the exact shape selection (marquee). */
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

/* ─── Alignment snap (smart guides) ───
   While a node is dragged with snapping on, its target position snaps to the
   nearest other node's left / center / right (vertical guides) and top /
   middle / bottom (horizontal guides) — true horizontal/vertical alignment.
   Guides span the dragged node plus every node sharing the alignment. */
const SNAP_THRESHOLD_SCREEN = 6;  // snap radius, in screen pixels
const SNAP_GUIDE_PAD = 16;        // canvas units the guides overshoot past the nodes
const SNAP_GUIDE_COLOR = '#ec4899';

interface SnapGuide { pos: number; from: number; to: number }
interface SnapResult { x: number; y: number; vertical: SnapGuide[]; horizontal: SnapGuide[] }

/** Visual node-box height — mirrors the formula in renderNode. */
function visualNodeHeight(node: CanvasNode): number {
  return HEADER_HEIGHT + Math.max(node.inputs.length, node.outputs.length) * PORT_HEIGHT + 10;
}

function computeSnapGuides(targetX: number, targetY: number, self: CanvasNode, nodes: CanvasNode[], zoom: number): SnapResult {
  const w = self.width;
  const h = visualNodeHeight(self);
  const selfX = [targetX, targetX + w / 2, targetX + w];       // left, centerX, right
  const selfY = [targetY, targetY + h / 2, targetY + h];       // top, centerY, bottom
  const threshold = SNAP_THRESHOLD_SCREEN / zoom;

  // Pass 1: closest same-kind match per axis (nearest node box wins).
  let dx = 0, dy = 0, xKind = -1, yKind = -1, bestX = threshold, bestY = threshold;
  for (const n of nodes) {
    if (n.id === self.id) continue;
    const nh = visualNodeHeight(n);
    const oX = [n.x, n.x + n.width / 2, n.x + n.width];
    const oY = [n.y, n.y + nh / 2, n.y + nh];
    for (let k = 0; k < 3; k++) {
      const ax = Math.abs(oX[k] - selfX[k]);
      if (ax <= bestX) { bestX = ax; dx = oX[k] - selfX[k]; xKind = k; }
      const ay = Math.abs(oY[k] - selfY[k]);
      if (ay <= bestY) { bestY = ay; dy = oY[k] - selfY[k]; yKind = k; }
    }
  }

  // Pass 2: span each guide across every node sharing the winning alignment.
  const vertical: SnapGuide[] = [];
  const horizontal: SnapGuide[] = [];
  if (xKind >= 0) {
    const pos = selfX[xKind] + dx;
    let from = targetY - SNAP_GUIDE_PAD, to = targetY + h + SNAP_GUIDE_PAD;
    for (const n of nodes) {
      if (n.id === self.id) continue;
      const nh = visualNodeHeight(n);
      const o = [n.x, n.x + n.width / 2, n.x + n.width][xKind];
      if (Math.abs(o - pos) < 0.5) {
        from = Math.min(from, n.y - SNAP_GUIDE_PAD);
        to = Math.max(to, n.y + nh + SNAP_GUIDE_PAD);
      }
    }
    vertical.push({ pos, from, to });
  }
  if (yKind >= 0) {
    const pos = selfY[yKind] + dy;
    let from = targetX - SNAP_GUIDE_PAD, to = targetX + w + SNAP_GUIDE_PAD;
    for (const n of nodes) {
      if (n.id === self.id) continue;
      const nh = visualNodeHeight(n);
      const o = [n.y, n.y + nh / 2, n.y + nh][yKind];
      if (Math.abs(o - pos) < 0.5) {
        from = Math.min(from, n.x - SNAP_GUIDE_PAD);
        to = Math.max(to, n.x + n.width + SNAP_GUIDE_PAD);
      }
    }
    horizontal.push({ pos, from, to });
  }
  return { x: targetX + dx, y: targetY + dy, vertical, horizontal };
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
  onDeleteNode, onRemoveConnection, onUpdateConnectionColor, onUpdateInput, onEditNodeCode, onEditFormula,
  onZoomChange, onPanChange, onDropNode,
  onViewTrace, focusTarget,
  selectedNodeIds, groups, onSelectNodes, onMoveNodes, onGroupSelection, onUngroupSelection, onUpdateNodeFront, onMultiDelete,
  fitSignal,
  snapEnabled = false,
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
  /* ── Text annotations: inline editing (double-click a Text shape) ── */
  const [editingShapeText, setEditingShapeText] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const textEditCancelRef = useRef(false);
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
  /* ── Wire selection: left-click selects ONLY the wire (nodes/shapes are
     deselected); the selected wire renders red until deselected ── */
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  // ── Node Groups feature: right-click context menu for the current multi-selection ──
  const [selMenu, setSelMenu] = useState<{ x: number; y: number } | null>(null);
  // ─── NEW: hovered node for visual feedback (no blink) ───
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  /* ── Touch support: only the first finger drives a touch gesture (extra
     fingers are ignored — no new multi-touch gestures are introduced), and a
     finger that never travels is a tap, the touch equivalent of a click. ── */
  const touchPointerIdRef = useRef<number | null>(null);
  const touchTapRef = useRef<{ x: number; y: number } | null>(null);
  /* ── Touch support: live finger positions, so a second finger can turn the
     gesture into a two-finger pinch-zoom of the existing view state. ── */
  const touchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ distance: number; midX: number; midY: number; zoom: number; panX: number; panY: number } | null>(null);
  /* ── Touch support: multi-select mode ──
     Hold one finger still on the canvas: after LONG_PRESS_MS the canvas enters
     multi-select mode and that finger becomes the "anchor". While it stays
     down, a second finger only taps — a node is added to / removed from the
     existing selection (the Shift+click behaviour, which a finger cannot
     reach), and empty canvas opens the existing selection menu with its Group
     action. Everything is the EXISTING selection state: `onSelectNodes` and
     the existing `selMenu`. */
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const multiSelectRef = useRef<{ holdPointerId: number } | null>(null);
  const multiSelectTapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const longPressRef = useRef<{ pointerId: number; x: number; y: number; timer: number } | null>(null);
  /* ── Touch support: last tap on a Text shape → the existing double-click ── */
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  // ─── Calculation Trace: temporary highlight while panning to a traced node ───
  const [traceHighlightId, setTraceHighlightId] = useState<string | null>(null);
  /* ── Alignment snap: live smart guides while a node is dragged (canvas coords) ── */
  const [snapGuides, setSnapGuides] = useState<{ vertical: SnapGuide[]; horizontal: SnapGuide[] } | null>(null);
  // The live selected wire (null when the id is stale, e.g. after undo/delete).
  const selectedConn = connections.find(c => c.id === selectedConnId) ?? null;
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

  /* ── Alignment snap: clear any live guides when snapping is switched off ── */
  useEffect(() => {
    if (!snapEnabled) setSnapGuides(null);
  }, [snapEnabled]);

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

  /* ── Touch support ──
     Every canvas interaction now runs on Pointer Events, which carry mouse,
     finger and pen input through the same handlers — the existing actions,
     coordinates and state are unchanged. Two small finger-specific bits are
     added on top: extra fingers are ignored while a gesture runs, and the
     canvas marks itself once a finger is used so the larger invisible hit
     areas switch on (see `.touch-hit` in index.css). */
  /** End whatever single-finger interaction is running (used when the
   *  gesture becomes a pinch). */
  const endSingleFingerGesture = useCallback(() => {
    setIsPanning(false);
    setDragNode(null);
    setDragShape(null);
    setShapeResize(null);
    setSnapGuides(null);
    setMarquee(null);
    marqueeShiftRef.current = false;
    touchTapRef.current = null;
    if (connecting.isConnecting) onFinishConnecting(); // cancel the wire, as on pointercancel
  }, [connecting.isConnecting, onFinishConnecting]);

  /** Baseline for a pinch, captured from the view state it starts in. */
  const beginPinch = useCallback(() => {
    const [a, b] = [...touchPointersRef.current.values()];
    if (!a || !b) return;
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    endSingleFingerGesture();
    pinchRef.current = {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      midX: (a.x + b.x) / 2 - (rect?.left ?? 0),
      midY: (a.y + b.y) / 2 - (rect?.top ?? 0),
      zoom,
      panX,
      panY,
    };
  }, [zoom, panX, panY, endSingleFingerGesture]);

  /** Stop watching a hold (the finger moved, lifted, or a pinch took over). */
  const clearLongPress = useCallback(() => {
    const press = longPressRef.current;
    if (press) window.clearTimeout(press.timer);
    longPressRef.current = null;
  }, []);

  const deactivateMultiSelect = useCallback(() => {
    multiSelectRef.current = null;
    multiSelectTapRef.current = null;
    setMultiSelectActive(false);
  }, []);

  /** A finger has been held still: the existing multi-selection becomes
   *  finger-driven until that finger is lifted. */
  const activateMultiSelect = useCallback((pointerId: number) => {
    multiSelectRef.current = { holdPointerId: pointerId };
    multiSelectTapRef.current = null;
    setMultiSelectActive(true);
    // The hold is a mode switch, not a pan / node drag / marquee / wire.
    endSingleFingerGesture();
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
  }, [endSingleFingerGesture]);

  /** Watch a freshly pressed finger for the hold that enters multi-select mode. */
  const startLongPressWatch = (e: React.PointerEvent) => {
    clearLongPress();
    // A press on a port starts a connection wire — never a mode switch.
    if ((e.target as Element | null)?.closest('[data-port-id]')) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const timer = window.setTimeout(() => {
      longPressRef.current = null;
      const live = touchPointersRef.current.get(pointerId);
      // Still down, and still (almost) where it was pressed?
      if (!live || !isWithinTapThreshold({ x: startX, y: startY }, live, LONG_PRESS_MOVE_TOLERANCE)) return;
      activateMultiSelect(pointerId);
    }, LONG_PRESS_MS);
    longPressRef.current = { pointerId, x: startX, y: startY, timer };
  };

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      // Mouse input → back to the unchanged desktop hit areas.
      svgRef.current?.classList.remove('touch-input');
      return;
    }
    const pointers = touchPointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svgRef.current?.classList.add('touch-input');
    /* Multi-select mode: every finger except the anchor only taps (the tap is
       completed on pointerup, see handlePointerUpCapture). */
    const multi = multiSelectRef.current;
    if (multi) {
      if (e.pointerId !== multi.holdPointerId) {
        multiSelectTapRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      }
      e.stopPropagation();
      return;
    }
    if (pointers.size > 1) {
      /* Touch support: a second finger = two-finger pinch-zoom, i.e. the same
         zoom+pan change the mouse wheel performs (the single-finger gesture
         yields to it). Extra fingers beyond the pair are ignored. */
      clearLongPress();
      if (!pinchRef.current) beginPinch();
      e.stopPropagation();
      return;
    }
    touchPointerIdRef.current = e.pointerId;
    startLongPressWatch(e);
  };

  /* Touch support: while two fingers are down the canvas follows the pinch
     (same zoom limits, same "keep the point under the fingers" behaviour as
     the wheel) — the single-finger handlers stay out of it. */
  const handlePointerMoveCapture = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const pointers = touchPointersRef.current;
    const tracked = pointers.get(e.pointerId);
    if (!tracked) return;
    tracked.x = e.clientX;
    tracked.y = e.clientY;
    /* Multi-select mode: the anchor finger no longer pans, and a selector
       finger that travels is a drag, not a tap. */
    const multi = multiSelectRef.current;
    if (multi) {
      if (e.pointerId !== multi.holdPointerId) {
        const tap = multiSelectTapRef.current;
        if (tap && tap.pointerId === e.pointerId && !isWithinTapThreshold(tap, { x: e.clientX, y: e.clientY })) {
          multiSelectTapRef.current = null;
        }
        e.stopPropagation();
      }
      return;
    }
    /* Touch support: a finger that moves off the press point is a pan / drag,
       so it can no longer start the multi-select hold. */
    const press = longPressRef.current;
    if (press && press.pointerId === e.pointerId
      && !isWithinTapThreshold({ x: press.x, y: press.y }, { x: e.clientX, y: e.clientY }, LONG_PRESS_MOVE_TOLERANCE)) {
      clearLongPress();
    }
    const pinch = pinchRef.current;
    if (!pinch || pointers.size < 2 || pinch.distance <= 0) return;
    const [a, b] = [...pointers.values()];
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const view = computePinchView(
      { zoom: pinch.zoom, panX: pinch.panX, panY: pinch.panY, midX: pinch.midX, midY: pinch.midY },
      {
        midX: (a.x + b.x) / 2 - (rect?.left ?? 0),
        midY: (a.y + b.y) / 2 - (rect?.top ?? 0),
        scale: Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance,
      },
      MIN_ZOOM,
      MAX_ZOOM,
    );
    onZoomChange(view.zoom);
    onPanChange(view.panX, view.panY);
    e.stopPropagation();
  };

  /* Touch support: while the anchor finger is held, a tap from another finger
     either adds the tapped node to the current selection (the existing
     selection state — Shift+click for fingers) or, on empty canvas, opens the
     existing selection menu (Group / Ungroup / Clear Selection). */
  const handleMultiSelectTap = useCallback((clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY);
    const nodeId = target?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? '';
    if (nodeId) {
      setSelectedConnId(null); // a tapped node replaces any wire selection
      if (!onSelectNodes) { onSelectNode(nodeId); return; }
      // Same toggle rule as Shift+click: a node's whole group joins/leaves.
      const current = selectedNodeIds ?? [];
      const members = groupMemberIds(groups ?? [], nodeId);
      const memberSet = new Set(members);
      if (members.every(id => current.includes(id))) {
        onSelectNodes(current.filter(id => !memberSet.has(id)));
      } else {
        onSelectNodes(Array.from(new Set([...current, ...members])));
      }
      return;
    }
    // Empty canvas (or a shape) → the existing selection menu, at the tap point.
    const rect = svgRef.current?.getBoundingClientRect();
    setContextMenu(null);
    setConnMenu(null);
    setShapeMenu(null);
    setSelMenu({ x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) });
  }, [selectedNodeIds, groups, onSelectNodes, onSelectNode]);

  /* Touch support: a selector finger is released — if it stayed put it was a
     tap, and the mode handles it (no node drag / pan / pinch / deselect). */
  const handlePointerUpCapture = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const tap = multiSelectTapRef.current;
    const multi = multiSelectRef.current;
    if (!multi || !tap || tap.pointerId !== e.pointerId) return;
    multiSelectTapRef.current = null;
    e.stopPropagation();
    if (!isWithinTapThreshold(tap, { x: e.clientX, y: e.clientY })) return; // travelled: not a tap
    handleMultiSelectTap(e.clientX, e.clientY);
  };

  /* Touch support: release the finger slots in the capture phase, so a new
     gesture can always start even if a pointerup is ever swallowed, and end
     the pinch as soon as a finger is lifted. */
  useEffect(() => {
    const endFinger = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const pointers = touchPointersRef.current;
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size < 2) pinchRef.current = null;
      if (touchPointerIdRef.current === e.pointerId) touchPointerIdRef.current = null;
      if (longPressRef.current?.pointerId === e.pointerId) clearLongPress();
      // Multi-select mode lasts exactly as long as its anchor finger is down.
      if (multiSelectRef.current?.holdPointerId === e.pointerId) deactivateMultiSelect();
    };
    window.addEventListener('pointerup', endFinger, true);
    window.addEventListener('pointercancel', endFinger, true);
    return () => {
      window.removeEventListener('pointerup', endFinger, true);
      window.removeEventListener('pointercancel', endFinger, true);
      clearLongPress();
    };
  }, [clearLongPress, deactivateMultiSelect]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
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
        /* Touch support: a finger dragged on the empty canvas pans it — the
           same pan action the mouse reaches with the middle button or
           Alt+drag (a touchscreen has neither). A finger that does not travel
           is a tap and still clears the selection on release, like a click. */
        if (e.pointerType !== 'mouse') {
          setIsPanning(true);
          setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
          touchTapRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
        // Marquee selection starts here; a tiny marquee (plain click) still
        // clears the selection, preserving the previous click behavior.
        const pos = screenToCanvas(e.clientX, e.clientY);
        marqueeShiftRef.current = e.shiftKey;
        setMarquee({ active: true, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      }
    }
  }, [panX, panY, connecting.isConnecting, screenToCanvas]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      /* Touch support: pan only once the finger has travelled past the tap
         threshold — below that the gesture is still a tap (a click). */
      const tap = touchTapRef.current;
      if (tap && isWithinTapThreshold(tap, { x: e.clientX, y: e.clientY })) return;
      if (tap) touchTapRef.current = null;
      onPanChange(e.clientX - panStart.x, e.clientY - panStart.y);
    }
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
      const primary = nodes.find(n => n.id === dragNode.id);
      let targetX = pos.x - dragNode.offsetX;
      let targetY = pos.y - dragNode.offsetY;
      // Alignment snap: snap the dragged node's target to the nearest node's
      // edges/center (true horizontal/vertical alignment) and show guides.
      // For multi/group drags the snap is computed from the primary node and
      // the whole set follows the snapped delta.
      if (snapEnabled && primary) {
        const snap = computeSnapGuides(targetX, targetY, primary, nodes, zoom);
        targetX = snap.x;
        targetY = snap.y;
        setSnapGuides(
          snap.vertical.length > 0 || snap.horizontal.length > 0
            ? { vertical: snap.vertical, horizontal: snap.horizontal }
            : null,
        );
      } else {
        setSnapGuides(null);
      }
      if (dragNode.memberIds.length > 1 && onMoveNodes) {
        // Grouped node: move the whole group (nodes AND its shapes) by the delta.
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
      dragShape, onMoveShape, shapeResize, onResizeShape, shapes, snapEnabled]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsPanning(false);
    setDragNode(null);
    setDragShape(null);
    setShapeResize(null);
    setSnapGuides(null);
    /* Touch support: a finger that never travelled is a tap, i.e. exactly the
       mouse's plain click on the empty canvas — it clears the selection. */
    if (touchTapRef.current) {
      touchTapRef.current = null;
      onSelectNode(null);
      onSelectShapes?.([], false);
      setSelectedConnId(null);
    }
    // Finish the marquee selection (if one was in progress).
    if (marquee) {
      const box = normalizeMarquee(marquee.startX, marquee.startY, marquee.endX, marquee.endY);
      const small = (box.x2 - box.x1) * zoom < 5 && (box.y2 - box.y1) * zoom < 5;
      if (small) {
        // Plain click on empty canvas → clear selection (existing behavior).
        // Shapes feature: also drop any shape selection.
        if (!marqueeShiftRef.current) { onSelectNode(null); onSelectShapes?.([], false); setSelectedConnId(null); }
      } else {
        // A real marquee replaces the selection — a selected wire is dropped too.
        setSelectedConnId(null);
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
      /* Touch support: the browser captures a touch pointer to the element the
         finger started on, so the event target is not the element under the
         finger — resolve the released-on port by position instead (same hit
         areas, same connection logic, same preview). */
      const target = (e.pointerType === 'mouse'
        ? e.target
        : document.elementFromPoint(e.clientX, e.clientY)) as Element | null;
      const portData = target?.closest('[data-port-id]');
      if (portData) {
        onFinishConnecting(portData.getAttribute('data-node-id') || '', portData.getAttribute('data-port-id') || '');
      } else {
        onFinishConnecting();
      }
    }
    /* Touch support: free the finger-gesture slot so a new gesture can start. */
    if (e.pointerType !== 'mouse' && touchPointerIdRef.current === e.pointerId) {
      touchPointerIdRef.current = null;
    }
  }, [connecting, marquee, zoom, nodes, shapes, onSelectNodes, selectedNodeIds, selectedShapeIds, onSelectNode, onSelectShapes, onFinishConnecting]);

  /* ── Touch support: the browser can cancel a pointer mid-gesture (system
     gesture, app switch, phone call). End the interaction cleanly instead of
     leaving a node or a connection wire stuck to the finger. ── */
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    setIsPanning(false);
    setDragNode(null);
    setDragShape(null);
    setShapeResize(null);
    setSnapGuides(null);
    setMarquee(null);
    marqueeShiftRef.current = false;
    touchTapRef.current = null;
    if (connecting.isConnecting) onFinishConnecting();
    if (e.pointerType !== 'mouse' && touchPointerIdRef.current === e.pointerId) {
      touchPointerIdRef.current = null;
    }
  }, [connecting.isConnecting, onFinishConnecting]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    // Left button only: right-click selection is handled in onContextMenu, so a
    // right-press must not alter the selection here.
    if (e.button !== 0) return;
    setSelMenu(null);
    setSelectedConnId(null); // a clicked node replaces any wire selection
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
    // Ctrl+left-press on an already-selected node: hold and drag to move the
    // WHOLE current node selection together (the selection itself is untouched).
    // Ctrl+press anywhere else falls through to the normal click behavior below.
    if ((e.ctrlKey || e.metaKey) && onMoveNodes) {
      const current = selectedNodeIds ?? [];
      if (current.includes(nodeId)) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setDragNode({ id: nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y, memberIds: current, memberShapeIds: [] });
        }
        return; // move the selection only — no selection change
      }
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

  const handlePortPointerDown = useCallback((e: React.PointerEvent, nodeId: string, portId: string, isOutput: boolean) => {
    e.stopPropagation();
    // Left button only: right-clicking a port must not start a connection wire
    // (right-clicks select via the node's onContextMenu instead).
    if (e.button !== 0) return;
    setConnMenu(null);
    setSelectedConnId(null);
    const pos = screenToCanvas(e.clientX, e.clientY);
    onStartConnecting(nodeId, portId, isOutput, pos.x, pos.y);
  }, [screenToCanvas]);

  const handlePortPointerUp = useCallback((e: React.PointerEvent, nodeId: string, portId: string) => {
    /* Touch support: the browser captures a touch pointer to the element the
       finger started on, so this handler would always see the SOURCE port.
       Finger releases are resolved by position in the canvas-level pointerup
       (document.elementFromPoint) and run through the same onFinishConnecting. */
    if (e.pointerType !== 'mouse') return;
    e.stopPropagation();
    if (connecting.isConnecting) onFinishConnecting(nodeId, portId);
  }, [connecting]);

  /* ── Left-click a wire: select ONLY it (any node/shape selection is dropped).
     The menu no longer opens here — right-click shows the wire options. ── */
  const handleConnectionPointerDown = useCallback((e: React.PointerEvent, connId: string) => {
    e.stopPropagation();
    // Left button only: right-clicks open the wire menu instead.
    if (e.button !== 0) return;
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
    onSelectNode(null);
    setSelectedConnId(connId);
  }, [onSelectNode]);

  /* ── Right-click a wire: select it (when not already) and open its options
     menu at the cursor (container-relative, so toolbar/toolbox don't offset it). ── */
  const handleConnectionContextMenu = useCallback((e: React.MouseEvent, connId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
    if (connId !== selectedConnId) {
      onSelectNode(null);
      setSelectedConnId(connId);
    }
    const rect = svgRef.current?.getBoundingClientRect();
    setConnMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), connId });
  }, [onSelectNode, selectedConnId]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConnMenu(null);
    setSelMenu(null);
    // Right-clicking an unselected node selects it (group-aware) so the
    // menu's Group/Ungroup actions have a well-defined target.
    if (!(selectedNodeIds ?? []).includes(nodeId)) onSelectNode(nodeId);
    onSelectShape?.(null);
    setContextMenu({ nodeId });
  }, [selectedNodeIds, onSelectNode, onSelectShape]);

  // Right-click on empty canvas with a selection (nodes and/or shapes) → menu.
  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    const current = (selectedNodeIds ?? []).length + (selectedShapeIds ?? []).length;
    /* Touch multi-select: the browser's own long-press menu must not replace
       the selection menu the second finger opens. */
    if (multiSelectRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Right-click during wire selection shows the WIRE options (no node/shape menu).
    if (current === 0 && selectedConn) {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu(null);
      setShapeMenu(null);
      const rect = svgRef.current?.getBoundingClientRect();
      setConnMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), connId: selectedConn.id });
      return;
    }
    if (current === 0) return; // keep the native browser menu as before
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setShapeMenu(null);
    const rect = svgRef.current?.getBoundingClientRect();
    setSelMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, [selectedNodeIds, selectedShapeIds, selectedConn]);

  /* ── Text annotations: inline edit lifecycle (double-click → textarea) ── */
  const beginShapeTextEdit = useCallback((shape: CanvasShape) => {
    textEditCancelRef.current = false;
    setEditingTextValue(shape.text ?? '');
    setEditingShapeText(shape.id);
    setSelectedConnId(null);
    if (shape.id !== selectedShapeId) onSelectShape?.(shape.id);
  }, [selectedShapeId, onSelectShape]);

  /* ── Shapes feature: shape body drag (select + move; grouped shapes move
     their whole group — nodes and shapes — with them) ── */
  const handleShapePointerDown = useCallback((e: React.PointerEvent, shape: CanvasShape) => {
    e.stopPropagation();
    // Left button only: right-click selection is handled in onContextMenu, so a
    // right-press must not alter the selection here.
    if (e.button !== 0) return;
    /* Touch support: touchscreens do not reliably emit the double-click that
       opens the inline editor on a Text shape, so two quick finger taps do the
       same thing (the first tap still behaves exactly like a single click). */
    if (e.pointerType !== 'mouse' && shape.type === 'text') {
      const now = Date.now();
      const lastTap = lastTapRef.current;
      if (lastTap && lastTap.id === shape.id && now - lastTap.time < TOUCH_DOUBLE_TAP_MS) {
        lastTapRef.current = null;
        beginShapeTextEdit(shape);
        return; // the second tap opens the editor instead of starting a drag
      }
      lastTapRef.current = { id: shape.id, time: now };
    }
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeMenu(null);
    setShapeSizeEditor(null);
    setSelectedConnId(null); // a clicked shape replaces any wire selection
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
  }, [screenToCanvas, onSelectShape, groups, beginShapeTextEdit]);

  /* ── Shapes feature: begin a corner-handle resize (only rendered when
     selected AND not frozen, so the guard is belt-and-braces). The aspect
     ratio is captured now so Ctrl can lock it for the whole drag. ── */
  const handleShapeHandlePointerDown = useCallback((e: React.PointerEvent, shape: CanvasShape, handle: ShapeResizeHandle) => {
    e.stopPropagation();
    // Left button only: right-clicks open the shape menu instead of resizing.
    if (e.button !== 0) return;
    if (shape.frozen) return;
    setShapeResize({ id: shape.id, handle, ratio: shape.width / Math.max(1, shape.height) });
  }, []);

  /* ── Shapes feature: right-click opens the shape menu ── */
  const handleShapeContextMenu = useCallback((e: React.MouseEvent, shapeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setConnMenu(null);
    setSelMenu(null);
    setShapeSizeEditor(null);
    if (shapeId !== selectedShapeId) onSelectShape?.(shapeId);
    const rect = svgRef.current?.getBoundingClientRect();
    setShapeMenu({ id: shapeId, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, [selectedShapeId, onSelectShape]);

  const commitShapeTextEdit = useCallback(() => {
    // Escape sets the cancel flag before unmounting; the trailing blur must not commit.
    if (textEditCancelRef.current) { textEditCancelRef.current = false; setEditingShapeText(null); return; }
    if (editingShapeText) onUpdateShape?.(editingShapeText, { text: editingTextValue });
    setEditingShapeText(null);
  }, [editingShapeText, editingTextValue, onUpdateShape]);

  const cancelShapeTextEdit = useCallback(() => {
    textEditCancelRef.current = true;
    setEditingShapeText(null);
  }, []);

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

  /* ── Touch support: HTML5 drag & drop (what a mouse drag out of the Toolbox
     uses) never fires for a finger. The Toolbox forwards finger drops as a
     lightweight event which runs the SAME drop handlers as the mouse above, so
     the node/shape is placed with the same canvas coordinate conversion. ── */
  useEffect(() => {
    const onToolboxTouchDrop = (ev: Event) => {
      const detail = (ev as CustomEvent<ToolboxTouchDropDetail>).detail;
      if (!detail) return;
      const pos = screenToCanvas(detail.clientX, detail.clientY);
      if (detail.shapeType && onDropShape) { onDropShape(detail.shapeType as ShapeType, pos.x, pos.y); return; }
      if (detail.nodeType) onDropNode(detail.nodeType, pos.x, pos.y);
    };
    window.addEventListener(TOOLBOX_TOUCH_DROP_EVENT, onToolboxTouchDrop);
    return () => window.removeEventListener(TOOLBOX_TOUCH_DROP_EVENT, onToolboxTouchDrop);
  }, [screenToCanvas, onDropShape, onDropNode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Text fields keep native behavior (Delete edits text, it must not delete canvas items).
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
      if (e.key === 'Delete' && !editingPort && !editingShapeText && !typing) {
        // A selected wire is deleted first (wire selection is exclusive).
        if (selectedConn) {
          onRemoveConnection(selectedConn.id);
          setSelectedConnId(null);
          setConnMenu(null);
          return;
        }
        // Shapes feature: a selected shape is deleted before any node logic runs.
        if (selectedShapeId && (shapes ?? []).some(s => s.id === selectedShapeId)) {
          onDeleteShape?.(selectedShapeId);
          return;
        }
        const multi = selectedNodeIds ?? [];
        if (multi.length > 1 && onMultiDelete) onMultiDelete(multi);
        else if (selectedNodeId) onDeleteNode(selectedNodeId);
      }
      if (e.key === 'Escape') { setContextMenu(null); setConnMenu(null); setSelMenu(null); setShapeMenu(null); setShapeSizeEditor(null); setEditingPort(null); setSelectedConnId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedNodeIds, editingPort, editingShapeText, onMultiDelete, onDeleteNode, selectedShapeId, shapes, onDeleteShape, selectedConn, onRemoveConnection]);

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
    // Selected wires render red; otherwise a custom wire color wins, else the theme default.
    const isSelected = selectedConn?.id === conn.id;
    const stroke = isSelected ? SELECTED_WIRE_COLOR : (conn.color ?? colors.conn);

    return (
      <g key={conn.id}>
        <path
          d={bezierPath(from.x, from.y, to.x, to.y)}
          fill="none"
          stroke={stroke}
          strokeWidth={isSelected ? 3.5 : 2.5}
          strokeOpacity={isSelected ? 1 : 0.8}
        />
        {/* Wide invisible hit-area: left-click selects the wire, right-click opens its menu */}
        <path
          d={bezierPath(from.x, from.y, to.x, to.y)}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          className="cursor-pointer"
          onPointerDown={(e) => handleConnectionPointerDown(e, conn.id)}
          onContextMenu={(e) => handleConnectionContextMenu(e, conn.id)}
        >
          <title>{`${fromNode.label} → ${toNode.label}`}</title>
        </path>
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
        onPointerDown={(e) => handlePortPointerDown(e, node.id, port.id, isOutput)}
        onPointerUp={(e) => handlePortPointerUp(e, node.id, port.id)}
      >
        {/* Touch support: invisible finger-sized hit area around the visible
            port circle. It draws nothing and is inert for a mouse, so the
            desktop hit area is unchanged. */}
        <circle className="touch-hit" cx={x} cy={y} r={TOUCH_PORT_RADIUS} fill="transparent" />
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
    // Every selected node is highlighted (primary + full multi-selection);
    // anything not in the selection renders with the normal border (unhighlighted).
    const isSelected = node.id === selectedNodeId || (selectedNodeIds ?? []).includes(node.id);
    const isHovered = node.id === hoveredNodeId && !isSelected; // FIX #2: no blink, just subtle bg shift
    const headerColor = node.color || '#666';
    const maxPorts = Math.max(node.inputs.length, node.outputs.length);
    const nodeH = HEADER_HEIGHT + maxPorts * PORT_HEIGHT + 10;

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
        data-node-id={node.id}
        onPointerDown={(e) => handleNodePointerDown(e, node.id)}
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

  /* ── Shapes feature: corner resize handles shared by geometric + text shapes ──
     (primary selection only, hidden while frozen). */
  const renderShapeResizeHandles = (shape: CanvasShape) => {
    if (shape.id !== selectedShapeId || shape.frozen || !onResizeShape) return null;
    const hs = 10 / zoom;
    const corners: [ShapeResizeHandle, number, number, string][] = [
      ['nw', shape.x, shape.y, 'nwse-resize'],
      ['ne', shape.x + shape.width, shape.y, 'nesw-resize'],
      ['sw', shape.x, shape.y + shape.height, 'nesw-resize'],
      ['se', shape.x + shape.width, shape.y + shape.height, 'nwse-resize'],
    ];
    return corners.map(([h, hx, hy, cursor]) => (
      <g key={h}>
        {/* Touch support: invisible finger-sized grab area — same handler,
            nothing drawn, inert for a mouse. */}
        <rect
          className="touch-hit"
          x={hx - (hs + TOUCH_HANDLE_PAD) / 2} y={hy - (hs + TOUCH_HANDLE_PAD) / 2}
          width={hs + TOUCH_HANDLE_PAD} height={hs + TOUCH_HANDLE_PAD}
          fill="transparent"
          onPointerDown={(e) => handleShapeHandlePointerDown(e, shape, h)} />
        <rect
          x={hx - hs / 2} y={hy - hs / 2} width={hs} height={hs} rx={1.5 / zoom}
          fill={colors.nodeBg} stroke={colors.selected} strokeWidth={1.5 / zoom}
          style={{ cursor }}
          onPointerDown={(e) => handleShapeHandlePointerDown(e, shape, h)} />
      </g>
    ));
  };

  /* ── Text annotations: freeform formatted text in a resizable box ──
     Double-click to edit inline; formatting lives in the Properties panel.
     A selected text box shows a dashed outline (the letters stay clean). */
  const renderTextShape = (shape: CanvasShape) => {
    const isSelected = shape.id === selectedShapeId || (selectedShapeIds ?? []).includes(shape.id);
    const def = getShapeDefinition(shape.type);
    const isEditing = editingShapeText === shape.id;
    const ink = shape.fontColor || colors.text;
    const fontCss: React.CSSProperties = {
      fontSize: shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      fontFamily: shape.fontFamily || 'system-ui, sans-serif',
      fontWeight: shape.fontWeight === 'bold' ? 700 : 400,
      fontStyle: shape.fontStyle === 'italic' ? 'italic' : 'normal',
      textDecoration: shape.underline ? 'underline' : 'none',
      textAlign: shape.textAlign ?? 'left',
    };
    return (
      <g key={shape.id}
        onPointerDown={(e) => handleShapePointerDown(e, shape)}
        onDoubleClick={(e) => { e.stopPropagation(); beginShapeTextEdit(shape); }}
        onContextMenu={(e) => handleShapeContextMenu(e, shape.id)}
        style={{ cursor: dragShape?.id === shape.id ? 'grabbing' : 'move' }}>
        <title>{def?.description}</title>
        {/* Dashed selection outline + faint wash — hidden while unselected */}
        {isSelected && (
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={3}
            fill={colors.selected} fillOpacity={0.06} stroke={colors.selected}
            strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} pointerEvents="none" />
        )}
        {isEditing ? (
          <foreignObject x={shape.x} y={shape.y} width={shape.width} height={shape.height}>
            <textarea
              value={editingTextValue}
              autoFocus
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={commitShapeTextEdit}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelShapeTextEdit();
                else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitShapeTextEdit();
              }}
              placeholder="Type here…  (Ctrl+Enter to finish)"
              title="Type here — Ctrl+Enter (or click outside) to finish, Esc to cancel"
              style={{
                width: '100%', height: '100%', resize: 'none', overflow: 'hidden',
                background: 'transparent', border: 'none', outline: 'none', padding: 2,
                color: ink, lineHeight: 1.35, whiteSpace: 'pre-wrap', ...fontCss,
              }}
            />
          </foreignObject>
        ) : (
          <foreignObject x={shape.x} y={shape.y} width={shape.width} height={shape.height}>
            {/* Handlers are attached directly: HTML-in-SVG event bubbling is
                unreliable across browsers, so the div mirrors the <g> above. */}
            <div
              onPointerDown={(e) => handleShapePointerDown(e, shape)}
              onDoubleClick={(e) => { e.stopPropagation(); beginShapeTextEdit(shape); }}
              onContextMenu={(e) => handleShapeContextMenu(e, shape.id)}
              style={{
                width: '100%', height: '100%', overflow: 'hidden', padding: 2, boxSizing: 'border-box',
                color: ink, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                userSelect: 'none', ...fontCss,
              }}
            >
              {shape.text ? shape.text : <span style={{ opacity: 0.35 }}>Text</span>}
            </div>
          </foreignObject>
        )}
        {/* Frozen badge: the box size is locked (text stays editable) */}
        {shape.frozen && (
          <text x={shape.x + shape.width - 6} y={shape.y + 18} textAnchor="end"
            fontSize={14} pointerEvents="none" opacity={0.9}>❄️</text>
        )}
        {renderShapeResizeHandles(shape)}
      </g>
    );
  };

  /* ── Shapes feature: render one canvas shape ──
     Geometry lives in a child <g> so the (translucent) fill stays clickable.
     Every selected shape is highlighted; resize handles are on the PRIMARY
     one only. Resize handles only exist when selected AND not frozen. */
  const renderShape = (shape: CanvasShape) => {
    // Text annotations render through their own branch (formatted HTML text).
    if (shape.type === 'text') return renderTextShape(shape);
    const isSelected = shape.id === selectedShapeId || (selectedShapeIds ?? []).includes(shape.id);
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
        onPointerDown={(e) => handleShapePointerDown(e, shape)}
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
        {renderShapeResizeHandles(shape)}
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

  // `data-canvas` marks the canvas as the drop area for finger drags out of
  // the Toolbox (the mouse drop arrives as a native HTML5 drop event).
  return (
    <div className="relative w-full h-full overflow-hidden" data-canvas="true" style={{ background: colors.bg }}>
      <svg ref={svgRef} className="w-full h-full canvas-surface"
        onWheel={handleWheel}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMoveCapture={handlePointerMoveCapture}
        onPointerUpCapture={handlePointerUpCapture}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}
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
          {/* Alignment snap guides (smart guides while dragging with snap on) */}
          {(snapGuides?.vertical ?? []).map((g, i) => (
            <line key={`sv${i}`} x1={g.pos} y1={g.from} x2={g.pos} y2={g.to}
              stroke={SNAP_GUIDE_COLOR} strokeWidth={1.5 / zoom} strokeLinecap="round" strokeDasharray={`0.1 ${4 / zoom}`} pointerEvents="none" />
          ))}
          {(snapGuides?.horizontal ?? []).map((g, i) => (
            <line key={`sh${i}`} x1={g.from} y1={g.pos} x2={g.to} y2={g.pos}
              stroke={SNAP_GUIDE_COLOR} strokeWidth={1.5 / zoom} strokeLinecap="round" strokeDasharray={`0.1 ${4 / zoom}`} pointerEvents="none" />
          ))}
        </g>
      </svg>

      {/* Touch multi-select hint — shown only while a finger holds the canvas
          (same styling as the existing zoom indicator; never intercepts input) */}
      {multiSelectActive && (
        <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg text-xs"
          style={{ background: colors.nodeBg, color: colors.text, border: `1px solid ${colors.nodeBorder}`, pointerEvents: 'none' }}>
          ✋ Multi-select — tap nodes with a second finger
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-mono"
        style={{ background: colors.nodeBg, color: colors.text, border: `1px solid ${colors.nodeBorder}` }}>
        {Math.round(zoom * 100)}% &bull; {nodes.length} nodes &bull; {connections.length} conns{shapes && shapes.length > 0 ? ` &bull; ${shapes.length} shapes` : ''}
      </div>

      {/* Wire options menu (right-click during wire selection) */}
      {connMenu && (() => {
        const conn = connections.find(c => c.id === connMenu.connId);
        if (!conn) return null;
        const fromNode = nodes.find(n => n.id === conn.fromNodeId);
        const toNode = nodes.find(n => n.id === conn.toNodeId);
        const currentColor = conn.color ?? colors.conn;
        return (
          <div className="absolute z-50 rounded-xl shadow-2xl overflow-hidden min-w-[220px]"
            style={{ left: connMenu.x, top: connMenu.y, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}` }}>
            <div className="px-3 py-2 text-xs font-semibold" style={{ color: colors.sub, borderBottom: `1px solid ${colors.nodeBorder}` }}>
              🔗 Connection
              <div className="font-normal truncate" title={`${fromNode?.label ?? '?'} → ${toNode?.label ?? '?'}`}>
                {fromNode?.label ?? '?'} → {toNode?.label ?? '?'}
              </div>
            </div>
            {/* Custom wire color: presets + picker + reset. The menu stays open
                while picking so the color previews live on the canvas. */}
            {onUpdateConnectionColor && (
              <>
                <div className="px-3 pt-2 text-[11px] font-semibold" style={{ color: colors.sub }}>🎨 Wire color</div>
                <div className="px-3 py-2 flex flex-wrap items-center gap-1.5">
                  {WIRE_COLOR_PRESETS.map(c => (
                    <button key={c} title={c}
                      onClick={() => { onUpdateConnectionColor(conn.id, c); setConnMenu(null); }}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, border: `2px solid ${conn.color === c ? colors.text : 'transparent'}` }} />
                  ))}
                </div>
                <label className="px-3 pb-2 flex items-center gap-2 text-xs cursor-pointer" style={{ color: colors.text }}>
                  <input
                    type="color"
                    title="Custom color"
                    value={/^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#60a5fa'}
                    onChange={(e) => onUpdateConnectionColor(conn.id, e.target.value)}
                    className="w-8 h-6 p-0 rounded cursor-pointer"
                    style={{ background: colors.inputBg, border: `1px solid ${colors.nodeBorder}` }}
                  />
                  Custom…
                  <span className="font-mono" style={{ color: colors.sub }}>{currentColor}</span>
                </label>
                {conn.color && (
                  <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
                    onClick={() => { onUpdateConnectionColor(conn.id, undefined); setConnMenu(null); }}>↩️ Reset to default</button>
                )}
              </>
            )}
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors" style={{ color: '#ef4444' }}
              onClick={() => { onRemoveConnection(conn.id); setSelectedConnId(null); setConnMenu(null); }}>🗑️ Delete Connection</button>
            <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.text }}
              onClick={() => { setConnMenu(null); }}>✕ Cancel</button>
          </div>
        );
      })()}

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
