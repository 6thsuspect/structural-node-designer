import React, { useState, useMemo } from 'react';
import { NodeDefinition, Theme } from '../types';
import { getCategories, getNodesByCategory, CATEGORY_COLORS, CATEGORY_ICONS, getAllNodes } from '../nodeDefinitions';

interface Props {
  theme: Theme;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateCustom?: () => void;
  onQuickFormula?: () => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; hover: string; input: string; accent: string }> = {
  dark: { bg: '#0f172a', text: '#e2e8f0', border: '#1e293b', hover: '#1e293b', input: '#1e293b', accent: '#3b82f6' },
  light: { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0', hover: '#f1f5f9', input: '#f1f5f9', accent: '#3b82f6' },
  grasshopper: { bg: '#1a202c', text: '#e2e8f0', border: '#2d3748', hover: '#2d3748', input: '#2d3748', accent: '#68d391' },
  autocad: { bg: '#0a0a0a', text: '#ffffff', border: '#222222', hover: '#1a1a1a', input: '#111111', accent: '#00ff00' },
};

export default function Toolbox({ theme, searchQuery, onSearchChange, onCreateCustom, onQuickFormula }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Inputs');
  const colors = themeStyles[theme];
  const categories = getCategories();

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    return getAllNodes().filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleDragStart = (e: React.DragEvent, nodeDef: NodeDefinition) => {
    e.dataTransfer.setData('nodeType', nodeDef.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const renderNodeItem = (nodeDef: NodeDefinition) => (
    <div
      key={nodeDef.type}
      draggable
      onDragStart={(e) => handleDragStart(e, nodeDef)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all group text-sm"
      style={{ color: colors.text }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = colors.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
      title={nodeDef.description || nodeDef.label}
    >
      <span className="text-xs w-5 text-center flex-shrink-0">{nodeDef.icon || '●'}</span>
      <span className="truncate flex-1">{nodeDef.label}</span>
      <span className="text-[10px] opacity-40 group-hover:opacity-70 transition-opacity">drag</span>
    </div>
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: colors.bg }}
    >
      {/* Search + quick actions */}
      <div className="px-3 py-2.5 flex-shrink-0 space-y-1.5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <input
          type="text"
          placeholder="🔍 Search nodes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-1.5 rounded-md text-sm outline-none transition-all"
          style={{
            background: colors.input,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        />
        <div className="flex gap-1">
          {onQuickFormula && (
            <button
              onClick={onQuickFormula}
              className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: colors.accent,
                color: '#fff',
              }}
            >
              ⚡ Quick Formula
            </button>
          )}
          {onCreateCustom && (
            <button
              onClick={onCreateCustom}
              className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'transparent',
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              ✏️ Advanced
            </button>
          )}
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredNodes ? (
          <div className="px-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>
              Search Results ({filteredNodes.length})
            </div>
            {filteredNodes.map(renderNodeItem)}
            {filteredNodes.length === 0 && (
              <div className="px-3 py-4 text-center text-sm opacity-50" style={{ color: colors.text }}>
                No nodes found
              </div>
            )}
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} className="mb-0.5">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors"
                style={{
                  color: CATEGORY_COLORS[cat] || colors.text,
                  borderBottom: `1px solid ${colors.border}`,
                }}
                onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = colors.hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span className="text-sm">{CATEGORY_ICONS[cat] || '📦'}</span>
                <span className="flex-1 text-left">{cat}</span>
                <span className="text-xs opacity-50">{getNodesByCategory(cat).length}</span>
                <span className="text-xs transition-transform" style={{
                  transform: expandedCategory === cat ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
              </button>
              {expandedCategory === cat && (
                <div className="px-1 py-1">
                  {getNodesByCategory(cat).map(renderNodeItem)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer info */}
      <div
        className="px-3 py-2 text-[10px] flex-shrink-0"
        style={{ color: colors.text, opacity: 0.4, borderTop: `1px solid ${colors.border}` }}
      >
        Drag nodes to canvas • {getAllNodes().length} nodes available
      </div>
    </div>
  );
}
