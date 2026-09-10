import React, { useState, useMemo, useEffect, useRef } from 'react';
import { NodeDefinition, Theme } from '../types';
import {
  TOOLBOX_TOUCH_DROP_EVENT,
  TAP_MOVE_THRESHOLD,
  type ToolboxTouchDropDetail,
} from '../features/touch-input';
import { getCategories, getNodesByCategory, CATEGORY_COLORS, CATEGORY_ICONS, getAllNodes } from '../nodeDefinitions';
import { SHAPE_CATALOG, type ShapeCatalogEntry } from '../features/canvas-shapes';

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

  /* ── Touch support ──
     Dragging a node/shape onto the canvas uses HTML5 drag & drop, which a
     touchscreen never generates. The finger drag below mirrors that mouse drag
     and finishes in the very same drop (NodeCanvas handles the event through
     its existing handler). The mouse keeps using its untouched native drag;
     `touchAction: 'pan-y'` on the items keeps the list scrollable by finger. */
  const [touchGhost, setTouchGhost] = useState<{ icon: string; label: string; x: number; y: number } | null>(null);
  const touchDragRef = useRef<{
    pointerId: number; startX: number; startY: number;
    nodeType?: string; shapeType?: string; icon: string; label: string; active: boolean;
  } | null>(null);

  const beginTouchDrag = (
    e: React.PointerEvent,
    item: { nodeType?: string; shapeType?: string; icon: string; label: string },
  ) => {
    if (e.pointerType === 'mouse') return; // mouse → native HTML5 drag & drop
    touchDragRef.current = {
      pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      nodeType: item.nodeType, shapeType: item.shapeType, icon: item.icon, label: item.label,
      active: false,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = touchDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        // Vertical movement belongs to the scrollable list (touch-action: pan-y),
        // a sideways movement is the start of a Toolbox → canvas drag.
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) < TAP_MOVE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
        drag.active = true;
      }
      setTouchGhost({ icon: drag.icon, label: drag.label, x: e.clientX, y: e.clientY });
    };
    const onUp = (e: PointerEvent) => {
      const drag = touchDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      touchDragRef.current = null;
      setTouchGhost(null);
      if (!drag.active) return; // a finger tap on a list item does nothing (as with a mouse)
      // Only a release over the canvas adds the item.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !el.closest('[data-canvas]')) return;
      const detail: ToolboxTouchDropDetail = {
        nodeType: drag.nodeType, shapeType: drag.shapeType,
        clientX: e.clientX, clientY: e.clientY,
      };
      window.dispatchEvent(new CustomEvent<ToolboxTouchDropDetail>(TOOLBOX_TOUCH_DROP_EVENT, { detail }));
    };
    const onCancel = (e: PointerEvent) => {
      const drag = touchDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      touchDragRef.current = null;
      setTouchGhost(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, []);

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

  /* ── Shapes feature: shapes appear as a category inside the node list ──
     (search also matches shapes, shown below the node results) */
  const filteredShapes = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    return SHAPE_CATALOG.filter(s => s.label.toLowerCase().includes(q) || s.type.includes(q));
  }, [searchQuery]);

  const handleDragStart = (e: React.DragEvent, nodeDef: NodeDefinition) => {
    e.dataTransfer.setData('nodeType', nodeDef.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  /* ── Shapes feature: drag a shape from the Shapes tab onto the canvas ── */
  const handleShapeDragStart = (e: React.DragEvent, shape: ShapeCatalogEntry) => {
    e.dataTransfer.setData('shapeType', shape.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const renderShapeItem = (shape: ShapeCatalogEntry) => (
    <div
      key={shape.type}
      draggable
      onDragStart={(e) => handleShapeDragStart(e, shape)}
      onPointerDown={(e) => beginTouchDrag(e, { shapeType: shape.type, icon: shape.icon, label: shape.label })}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all group text-sm"
      style={{ color: colors.text, touchAction: 'pan-y' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      title={shape.description}
    >
      <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: colors.accent }}>{shape.icon}</span>
      <span className="truncate flex-1">{shape.label}</span>
      <span className="text-[10px] opacity-40 group-hover:opacity-70 transition-opacity">drag</span>
    </div>
  );

  const renderNodeItem = (nodeDef: NodeDefinition) => (
    <div
      key={nodeDef.type}
      draggable
      onDragStart={(e) => handleDragStart(e, nodeDef)}
      onPointerDown={(e) => beginTouchDrag(e, { nodeType: nodeDef.type, icon: nodeDef.icon || '●', label: nodeDef.label })}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all group text-sm"
      style={{ color: colors.text, touchAction: 'pan-y' }}
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

      {/* Node List (with the Shapes category at the end) */}
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
            {(filteredShapes?.length ?? 0) > 0 && (
              <>
                <div className="px-2 py-1 mt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>
                  Shapes ({filteredShapes!.length})
                </div>
                {filteredShapes!.map(renderShapeItem)}
              </>
            )}
          </div>
        ) : (
          <>
          {categories.map(cat => (
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
          ))}
          {/* Shapes feature: "Shapes" category — drag a shape onto the canvas */}
          <div className="mb-0.5">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors"
              style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}
              onClick={() => setExpandedCategory(expandedCategory === 'Shapes' ? null : 'Shapes')}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="text-sm">◼</span>
              <span className="flex-1 text-left">Shapes</span>
              <span className="text-xs opacity-50">{SHAPE_CATALOG.length}</span>
              <span className="text-xs transition-transform" style={{
                transform: expandedCategory === 'Shapes' ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>▶</span>
            </button>
            {expandedCategory === 'Shapes' && (
              <div className="px-1 py-1">
                {SHAPE_CATALOG.map(renderShapeItem)}
                <p className="px-3 pt-2 pb-1 text-[10px] leading-relaxed" style={{ color: colors.text, opacity: 0.45 }}>
                  Drag onto canvas • click to select • drag corners to resize (Ctrl = fixed ratio)
                  • right-click to freeze, edit size, or set draw order • double-click Text to edit
                </p>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Footer info */}
      <div
        className="px-3 py-2 text-[10px] flex-shrink-0"
        style={{ color: colors.text, opacity: 0.4, borderTop: `1px solid ${colors.border}` }}
      >
        Drag nodes to canvas • {getAllNodes().length} nodes available
      </div>

      {/* Touch support: the drag preview that follows the finger (the mouse
          drag shows the browser's own drag image instead). View only. */}
      {touchGhost && (
        <div
          className="rounded-md shadow-lg"
          style={{
            position: 'fixed', left: touchGhost.x + 14, top: touchGhost.y + 14, zIndex: 9999,
            pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', fontSize: 12, opacity: 0.9,
            background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
          }}
        >
          <span>{touchGhost.icon}</span>
          <span>{touchGhost.label}</span>
        </div>
      )}
    </div>
  );
}
