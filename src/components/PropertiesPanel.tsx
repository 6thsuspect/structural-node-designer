// Properties Panel Component
import { CanvasNode, Theme, Connection, CanvasShape } from '../types';
import { getNodeDefinition } from '../nodeDefinitions';
import { getShapeDefinition, MIN_SHAPE_SIZE } from '../features/canvas-shapes';

interface Props {
  node: CanvasNode | null;
  connections: Connection[];
  theme: Theme;
  onUpdateInput: (nodeId: string, portId: string, value: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  /** Calculation Trace integration (optional — button hidden when absent). */
  onViewTrace?: (nodeId: string) => void;
  /* ── Shapes feature (optional — inert when absent) ── */
  /** The currently selected canvas shape (mutually exclusive with `node`). */
  shape?: CanvasShape | null;
  onUpdateShape?: (shapeId: string, patch: Partial<CanvasShape>) => void;
  onDeleteShape?: (shapeId: string) => void;
  onToggleShapeFrozen?: (shapeId: string) => void;
  /** Per-item draw order for the selected node (front layer toggle). */
  onUpdateNodeFront?: (nodeId: string, front: boolean) => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; input: string; label: string; accent: string }> = {
  dark: { bg: '#0f172a', text: '#e2e8f0', border: '#1e293b', input: '#1e293b', label: '#94a3b8', accent: '#3b82f6' },
  light: { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0', input: '#f1f5f9', label: '#64748b', accent: '#3b82f6' },
  grasshopper: { bg: '#1a202c', text: '#e2e8f0', border: '#2d3748', input: '#2d3748', label: '#a0aec0', accent: '#68d391' },
  autocad: { bg: '#0a0a0a', text: '#ffffff', border: '#222222', input: '#111111', label: '#888888', accent: '#00ff00' },
};

export default function PropertiesPanel({
  node, connections, theme, onUpdateInput, onDeleteNode, onDuplicateNode, onViewTrace,
  shape, onUpdateShape, onDeleteShape, onToggleShapeFrozen, onUpdateNodeFront,
}: Props) {
  const colors = themeStyles[theme];

  /* ── Shapes feature: inspector for the selected shape ── */
  if (shape) {
    const def = getShapeDefinition(shape.type);
    const numInput = (label: string, value: number, onValue: (v: number) => void, disabled = false) => (
      <div>
        <label className="text-xs font-medium" style={{ color: colors.label }}>{label}</label>
        <input
          type="number"
          value={Math.round(value * 10) / 10}
          onChange={(e) => onValue(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="w-full px-2 py-1 rounded text-sm mt-0.5 outline-none transition-all disabled:opacity-50"
          style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}`, fontFamily: 'monospace' }}
        />
      </div>
    );
    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ background: colors.bg }}>
        {/* Header */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: colors.accent }}>{def?.icon || '◼'}</span>
            <h3 className="text-sm font-bold" style={{ color: colors.text }}>{def?.label || shape.type}</h3>
            {shape.frozen && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${colors.accent}33`, color: colors.accent }}>❄️ FROZEN</span>}
          </div>
          <p className="text-xs mt-1" style={{ color: colors.label }}>Shape • {shape.type}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
              Position &amp; Size
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {numInput('X', shape.x, (v) => onUpdateShape?.(shape.id, { x: v }))}
              {numInput('Y', shape.y, (v) => onUpdateShape?.(shape.id, { y: v }))}
              {numInput('Width', shape.width, (v) => onUpdateShape?.(shape.id, { width: Math.max(MIN_SHAPE_SIZE, v) }), shape.frozen)}
              {numInput('Height', shape.height, (v) => onUpdateShape?.(shape.id, { height: Math.max(MIN_SHAPE_SIZE, v) }), shape.frozen)}
            </div>
            {shape.frozen && (
              <p className="text-[10px] mt-1.5" style={{ color: colors.label }}>
                🧊 Size is frozen — unfreeze to edit width/height or drag the corner handles.
              </p>
            )}
          </div>

          {/* Fill: color + opacity */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
              Fill
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium" style={{ color: colors.label }}>Color</label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="color"
                    value={shape.color || '#60a5fa'}
                    onChange={(e) => onUpdateShape?.(shape.id, { color: e.target.value })}
                    className="w-8 h-8 p-0.5 rounded cursor-pointer"
                    style={{ background: colors.input, border: `1px solid ${colors.border}` }}
                  />
                  <input
                    type="text"
                    value={shape.color || '#60a5fa'}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onUpdateShape?.(shape.id, { color: v });
                    }}
                    className="flex-1 min-w-0 px-2 py-1 rounded text-xs outline-none"
                    style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}`, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: colors.label }}>
                  Opacity <span className="font-mono">{Math.round((shape.fillOpacity ?? 0.15) * 100)}%</span>
                </label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((shape.fillOpacity ?? 0.15) * 100)}
                  onChange={(e) => onUpdateShape?.(shape.id, { fillOpacity: parseInt(e.target.value, 10) / 100 })}
                  className="w-full mt-2 accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Draw order (per-item: this shape) */}
          {onUpdateShape && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.label }}>
                Draw Order
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(shape.front)}
                  onChange={(e) => onUpdateShape(shape.id, { front: e.target.checked })}
                  className="accent-blue-500"
                />
                <span className="text-xs" style={{ color: colors.text }}>In front of wires &amp; default items</span>
              </label>
              <p className="text-[10px] mt-1" style={{ color: colors.label }}>
                Front items draw over wires, nodes and other shapes; they also catch their clicks.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${colors.border}` }}>
          {onToggleShapeFrozen && (
            <button
              className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'transparent', color: colors.accent, border: `1px solid ${colors.accent}` }}
              onClick={() => onToggleShapeFrozen(shape.id)}
            >
              {shape.frozen ? '❄️ Unfreeze' : '🧊 Freeze'}
            </button>
          )}
          {onDeleteShape && (
            <button
              className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
              style={{ background: '#ef4444', color: '#fff' }}
              onClick={() => onDeleteShape(shape.id)}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4" style={{ background: colors.bg }}>
        <div className="text-center space-y-3">
          <div className="text-4xl opacity-30">📋</div>
          <p className="text-sm font-medium" style={{ color: colors.text }}>No Selection</p>
          <p className="text-xs" style={{ color: colors.label }}>
            Select a node to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  const def = getNodeDefinition(node.type);
  const nodeConnections = connections.filter(c => c.fromNodeId === node.id || c.toNodeId === node.id);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: colors.bg }}>
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: node.color }} />
          <h3 className="text-sm font-bold" style={{ color: colors.text }}>{node.label}</h3>
        </div>
        <p className="text-xs mt-1" style={{ color: colors.label }}>{node.category} • {node.type}</p>
        {def?.description && (
          <p className="text-xs mt-1 italic" style={{ color: colors.label }}>{def.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {/* Inputs */}
        {node.inputs.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
              Inputs
            </h4>
            <div className="space-y-2">
              {node.inputs.map(port => {
                const isConnected = connections.some(c => c.toNodeId === node.id && c.toPortId === port.id);
                return (
                  <div key={port.id}>
                    <label className="text-xs font-medium flex items-center gap-1" style={{ color: colors.label }}>
                      {port.name}
                      {port.unit && <span className="opacity-60">({port.unit})</span>}
                      {isConnected && <span className="text-blue-400 text-[10px]">● linked</span>}
                    </label>
                    {port.type === 'number' ? (
                      <input
                        type="number"
                        value={port.value ?? 0}
                        onChange={(e) => onUpdateInput(node.id, port.id, parseFloat(e.target.value) || 0)}
                        disabled={isConnected}
                        className="w-full px-2 py-1 rounded text-sm mt-0.5 outline-none transition-all disabled:opacity-50"
                        style={{
                          background: colors.input,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          fontFamily: 'monospace',
                        }}
                      />
                    ) : port.type === 'boolean' ? (
                      <label className="flex items-center gap-2 mt-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(port.value)}
                          onChange={(e) => onUpdateInput(node.id, port.id, e.target.checked)}
                          disabled={isConnected}
                          className="accent-blue-500"
                        />
                        <span className="text-sm" style={{ color: colors.text }}>
                          {port.value ? 'True' : 'False'}
                        </span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={port.value ?? ''}
                        onChange={(e) => onUpdateInput(node.id, port.id, e.target.value)}
                        disabled={isConnected}
                        className="w-full px-2 py-1 rounded text-sm mt-0.5 outline-none transition-all disabled:opacity-50"
                        style={{
                          background: colors.input,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Outputs */}
        {node.outputs.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>
              Outputs
            </h4>
            <div className="space-y-2">
              {node.outputs.map(port => (
                <div
                  key={port.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded"
                  style={{ background: colors.input, border: `1px solid ${colors.border}` }}
                >
                  <span className="text-xs font-medium" style={{ color: colors.label }}>
                    {port.name} {port.unit && `(${port.unit})`}
                  </span>
                  <span className="text-sm font-mono font-bold" style={{ color: '#10b981' }}>
                    {typeof port.value === 'number'
                      ? port.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : typeof port.value === 'boolean'
                        ? port.value ? '✓ TRUE' : '✗ FALSE'
                        : String(port.value ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections Info */}
        {nodeConnections.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.label }}>
              Connections ({nodeConnections.length})
            </h4>
            <div className="space-y-1">
              {nodeConnections.map(c => (
                <div key={c.id} className="text-[10px] px-2 py-1 rounded" style={{ background: colors.input, color: colors.label }}>
                  {c.fromNodeId === node.id ? '→ Output' : '← Input'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draw order (per-item: this node) */}
        {onUpdateNodeFront && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.label }}>
              Draw Order
            </h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.front)}
                onChange={(e) => onUpdateNodeFront(node.id, e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-xs" style={{ color: colors.text }}>In front of wires &amp; default items</span>
            </label>
          </div>
        )}

        {/* Node Info */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.label }}>
            Node Info
          </h4>
          <div className="space-y-1 text-xs" style={{ color: colors.label }}>
            <div className="flex justify-between">
              <span>Position</span>
              <span className="font-mono">{Math.round(node.x)}, {Math.round(node.y)}</span>
            </div>
            <div className="flex justify-between">
              <span>Size</span>
              <span className="font-mono">{node.width} × {node.height}</span>
            </div>
            <div className="flex justify-between">
              <span>Computed</span>
              <span className={node.computed ? 'text-green-400' : 'text-yellow-400'}>
                {node.computed ? '✓ Yes' : '⏳ Pending'}
              </span>
            </div>
            {node.error && (
              <div className="flex justify-between">
                <span>Error</span>
                <span className="text-red-400">{node.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${colors.border}` }}>
        {onViewTrace && (
          <button
            className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{ background: '#10b981', color: '#fff' }}
            onClick={() => onViewTrace(node.id)}
            title="View the calculation trace for this node"
          >
            🔎 Trace
          </button>
        )}
        <button
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
          style={{ background: colors.accent, color: '#fff' }}
          onClick={() => onDuplicateNode(node.id)}
        >
          📋 Duplicate
        </button>
        <button
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
          style={{ background: '#ef4444', color: '#fff' }}
          onClick={() => onDeleteNode(node.id)}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
