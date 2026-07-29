// Properties Panel Component
import { CanvasNode, Theme, Connection } from '../types';
import { getNodeDefinition } from '../nodeDefinitions';

interface Props {
  node: CanvasNode | null;
  connections: Connection[];
  theme: Theme;
  onUpdateInput: (nodeId: string, portId: string, value: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; input: string; label: string; accent: string }> = {
  dark: { bg: '#0f172a', text: '#e2e8f0', border: '#1e293b', input: '#1e293b', label: '#94a3b8', accent: '#3b82f6' },
  light: { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0', input: '#f1f5f9', label: '#64748b', accent: '#3b82f6' },
  grasshopper: { bg: '#1a202c', text: '#e2e8f0', border: '#2d3748', input: '#2d3748', label: '#a0aec0', accent: '#68d391' },
  autocad: { bg: '#0a0a0a', text: '#ffffff', border: '#222222', input: '#111111', label: '#888888', accent: '#00ff00' },
};

export default function PropertiesPanel({ node, connections, theme, onUpdateInput, onDeleteNode, onDuplicateNode }: Props) {
  const colors = themeStyles[theme];

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
