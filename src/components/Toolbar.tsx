import React from 'react';
import { Theme } from '../types';

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onLoadDemo: () => void;
  onCreateCustomNode: () => void;
  onQuickFormula: () => void;
  onSettings: () => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; hover: string; accent: string }> = {
  dark: { bg: '#0a0f1e', text: '#e2e8f0', border: '#1e293b', hover: '#1e293b', accent: '#3b82f6' },
  light: { bg: '#f8fafc', text: '#1e293b', border: '#e2e8f0', hover: '#e2e8f0', accent: '#3b82f6' },
  grasshopper: { bg: '#171923', text: '#e2e8f0', border: '#2d3748', hover: '#2d3748', accent: '#68d391' },
  autocad: { bg: '#050505', text: '#ffffff', border: '#222222', hover: '#1a1a1a', accent: '#00ff00' },
};

export default function Toolbar({
  theme, onThemeChange, onSave, onLoad, onClear, onUndo, onRedo, onReport,
  onZoomIn, onZoomOut, onZoomFit, onLoadDemo, onCreateCustomNode, onQuickFormula, onSettings,
}: Props) {
  const colors = themeStyles[theme];

  const Button = ({ children, onClick, title, accent }: { children: React.ReactNode; onClick: () => void; title?: string; accent?: boolean }) => (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95"
      style={{
        background: accent ? colors.accent : 'transparent',
        color: accent ? '#fff' : colors.text,
        border: accent ? 'none' : `1px solid ${colors.border}`,
      }}
      onMouseEnter={(e) => {
        if (!accent) (e.currentTarget as HTMLElement).style.background = colors.hover;
      }}
      onMouseLeave={(e) => {
        if (!accent) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );

  const Separator = () => (
    <div className="w-px h-6 mx-1" style={{ background: colors.border }} />
  );

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 flex-shrink-0"
      style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: colors.accent }}>
          🏗️
        </div>
        <div>
          <div className="text-xs font-bold tracking-tight" style={{ color: colors.text }}>
            Structural Node Designer
          </div>
          <div className="text-[10px]" style={{ color: colors.text, opacity: 0.5 }}>
            Visual Engineering Calculator
          </div>
        </div>
      </div>

      <Separator />

      {/* File */}
      <Button onClick={onSave} title="Save Project (JSON)">💾 Save</Button>
      <Button onClick={onLoad} title="Load Project">📂 Open</Button>
      <Button onClick={onClear} title="Clear All">🗑️ Clear</Button>

      <Separator />

      {/* Edit */}
      <Button onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</Button>
      <Button onClick={onRedo} title="Redo (Ctrl+Y)">↪ Redo</Button>

      <Separator />

      {/* View */}
      <Button onClick={onZoomIn} title="Zoom In">🔍+</Button>
      <Button onClick={onZoomOut} title="Zoom Out">🔍−</Button>
      <Button onClick={onZoomFit} title="Zoom to Fit">⊞ Fit</Button>

      <Separator />

      {/* Theme */}
      <select
        value={theme}
        onChange={(e) => onThemeChange(e.target.value as Theme)}
        className="px-2 py-1 rounded text-xs outline-none cursor-pointer"
        style={{
          background: colors.hover,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        <option value="dark">🌙 Dark</option>
        <option value="light">☀️ Light</option>
        <option value="grasshopper">🦗 Grasshopper</option>
        <option value="autocad">📐 AutoCAD</option>
      </select>

      <Separator />

      <Button onClick={onReport} title="Generate Report">📄 Report</Button>
      <Button onClick={onQuickFormula} title="Quick Formula" accent>⚡ Quick Formula</Button>
      <Button onClick={onCreateCustomNode} title="Advanced Node Editor">✏️ Advanced</Button>
      <Button onClick={onLoadDemo} title="Load Demo Workflow">🚀 Demo</Button>
      <Button onClick={onSettings} title="Settings & Preferences">⚙️ Settings</Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help */}
      <div className="text-[10px] flex items-center gap-3" style={{ color: colors.text, opacity: 0.5 }}>
        <span>Alt+Drag: Pan</span>
        <span>Scroll: Zoom</span>
        <span>Del: Delete</span>
        <span>Drag from toolbox: Add node</span>
      </div>
    </div>
  );
}
