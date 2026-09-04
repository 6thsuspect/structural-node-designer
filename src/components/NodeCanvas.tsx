import React, { useRef, useCallback, useEffect, useState } from 'react';
import { CanvasNode, Connection, ConnectingState, Theme } from '../types';

const PORT_RADIUS = 7;
const PORT_HEIGHT = 28;
const HEADER_HEIGHT = 36;

/* ─── Port row layout constants (node width is fixed at 200) ─── */
const LABEL_X = 16;             // input label left edge
const OUT_VALUE_X = 14;         // output value left edge
const LABEL_MAX_CHARS = 24;     // input label truncation (full width is free)
const OUT_VALUE_MAX_CHARS = 20;
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
  onEditNodeCode: (nodeId: string) => void;
  onEditFormula: (nodeId: string) => void;
  onZoomChange: (z: number) => void;
  onPanChange: (x: number, y: number) => void;
  onDropNode: (type: string, x: number, y: number) => void;
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
  onDeleteNode, onRemoveConnection, onEditNodeCode, onEditFormula,
  onZoomChange, onPanChange, onDropNode,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = themeColors[theme];
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // Node context menu is anchored to the node (not a fixed screen point), so it
  // follows the node while the canvas is panned or zoomed.
  const [contextMenu, setContextMenu] = useState<{ nodeId: string } | null>(null);
  // ─── NEW: connection context menu state ───
  const [connMenu, setConnMenu] = useState<{ x: number; y: number; connId: string } | null>(null);
  // ─── NEW: hovered node for visual feedback (no blink) ───
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
    } else if (e.button === 0) {
      const target = e.target as SVGElement;
      if (target === svgRef.current || target.classList.contains('canvas-bg')) {
        onSelectNode(null);
      }
    }
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) onPanChange(e.clientX - panStart.x, e.clientY - panStart.y);
    if (dragNode) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      onMoveNode(dragNode.id, pos.x - dragNode.offsetX, pos.y - dragNode.offsetY);
    }
    if (connecting.isConnecting) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      onUpdateConnecting(pos.x, pos.y);
    }
  }, [isPanning, panStart, dragNode, connecting, screenToCanvas]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);
    setDragNode(null);
    if (connecting.isConnecting) {
      const target = e.target as SVGElement;
      const portData = target.closest('[data-port-id]');
      if (portData) {
        onFinishConnecting(portData.getAttribute('data-node-id') || '', portData.getAttribute('data-port-id') || '');
      } else {
        onFinishConnecting();
      }
    }
  }, [connecting]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onSelectNode(nodeId);
    setConnMenu(null);
    setContextMenu(null);
    const pos = screenToCanvas(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === nodeId);
    if (node) setDragNode({ id: nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y });
  }, [nodes, screenToCanvas, onSelectNode]);

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
    setContextMenu({ nodeId });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (type) { const pos = screenToCanvas(e.clientX, e.clientY); onDropNode(type, pos.x, pos.y); }
  }, [screenToCanvas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId) onDeleteNode(selectedNodeId);
      if (e.key === 'Escape') { setContextMenu(null); setConnMenu(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId]);

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
    const outValueText = truncateText(valueText || '—', OUT_VALUE_MAX_CHARS);
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
        {/* Only the designated label is shown on the node — the numeric value is
            intentionally hidden here to keep the node UI clean. Values can be
            viewed and edited in the Properties panel. */}
        {!isOutput && (
          <text x={LABEL_X} y={y + 4} textAnchor="start" fill={colors.text} fontSize={10} fontWeight="700" fontFamily="system-ui">
            {labelText}
            <title>{port.name}{port.unit ? ` (${port.unit})` : ''}</title>
          </text>
        )}

        {/* ─── OUTPUT PORTS ─── */}
        {/* Value on the left, name on the right — both truncated so they can't meet */}
        {isOutput && (
          <>
            <text x={OUT_VALUE_X} y={y + 4} textAnchor="start" fill="#10b981" fontSize={10} fontFamily="monospace" fontWeight="bold">
              {outValueText}
              <title>{valueText}</title>
            </text>
            <text x={OUT_VALUE_X + outValueText.length * 6 + 6} y={y + 4} textAnchor="start" fill={colors.sub} fontSize={9} fontFamily="system-ui" opacity={0.55}>:</text>
            <text x={node.width - 10} y={y + 4} textAnchor="end" fill={colors.sub} fontSize={10} fontFamily="system-ui">
              {outNameText}
              <title>{port.name}</title>
            </text>
          </>
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
    const MENU_H = 176;
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
        onDragOver={handleDragOver} onDrop={handleDrop}
        style={{ cursor: isPanning ? 'grabbing' : dragNode ? 'move' : connecting.isConnecting ? 'crosshair' : 'default' }}>
        {renderGrid()}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {connections.map(renderConnection)}
          {renderActiveConnection()}
          {nodes.map(renderNode)}
        </g>
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-mono"
        style={{ background: colors.nodeBg, color: colors.text, border: `1px solid ${colors.nodeBorder}` }}>
        {Math.round(zoom * 100)}% &bull; {nodes.length} nodes &bull; {connections.length} conns
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
          <div className="my-1 border-t" style={{ borderColor: colors.nodeBorder }} />
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors" style={{ color: '#ef4444' }}
            onClick={() => { onDeleteNode(contextMenu.nodeId); setContextMenu(null); }}>🗑️ Delete Node</button>
          <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors" style={{ color: colors.sub }}
            onClick={() => setContextMenu(null)}>✕ Cancel</button>
        </div>
      )}
    </div>
  );
}
