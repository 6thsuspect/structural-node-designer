import React, { useState } from 'react';
import { Theme } from '../types';
import { DEMO_PROJECTS, type DemoProject } from '../demoProjects';

/* ─── Mobile toolbar ───
   Compact bottom toolbar for compact viewports (phone/tablet). It reuses the
   exact same commands as the desktop Toolbar (undo/redo/zoom/fit/save/…)
   through the callbacks passed by App — no second implementation of any
   command, no removed desktop functionality. Less-used commands live under
   the "⋯ More" popup. Safe-area aware (env(safe-area-inset-bottom)). */

const themeStyles: Record<Theme, { bg: string; border: string; text: string; hover: string; accent: string }> = {
  dark:        { bg: '#0a0f1e', border: '#1e293b', text: '#e2e8f0', hover: '#1e293b', accent: '#3b82f6' },
  light:       { bg: '#f8fafc', border: '#e2e8f0', text: '#1e293b', hover: '#e2e8f0', accent: '#3b82f6' },
  grasshopper: { bg: '#171923', border: '#2d3748', text: '#e2e8f0', hover: '#2d3748', accent: '#68d391' },
  autocad:     { bg: '#050505', border: '#222222', text: '#ffffff', hover: '#1a1a1a', accent: '#00ff00' },
};

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
  onLoadDemo: (demo: DemoProject) => void;
  onCreateCustomNode: () => void;
  onQuickFormula: () => void;
  onSettings: () => void;
  onAbout: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onOpenLibrary: () => void;
  onToggleProperties: () => void;
  propertiesOpen: boolean;
}

export default function MobileToolbar({
  theme, onThemeChange, onSave, onLoad, onClear, onUndo, onRedo, onReport,
  onZoomIn, onZoomOut, onZoomFit, onLoadDemo, onCreateCustomNode, onQuickFormula,
  onSettings, onAbout, snapEnabled, onToggleSnap, onOpenLibrary, onToggleProperties, propertiesOpen,
}: Props) {
  const colors = themeStyles[theme];
  const [moreOpen, setMoreOpen] = useState(false);

  const TButton = ({ icon, label, onClick, accent, active }: { icon: string; label: string; onClick: () => void; accent?: boolean; active?: boolean }) => (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] h-11 px-1.5 rounded-lg transition-all active:scale-90"
      style={{
        background: accent ? colors.accent : active ? colors.hover : 'transparent',
        color: accent ? '#fff' : colors.text,
        opacity: active && !accent ? 1 : 0.92,
      }}
    >
      <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 8.5, lineHeight: 1, fontWeight: 600, opacity: 0.75 }}>{label}</span>
    </button>
  );

  const Sep = () => <div className="w-px h-8 mx-0.5 flex-shrink-0" style={{ background: colors.border }} />;

  const MenuItem = ({ icon, label, onClick, danger, right }: { icon: string; label: string; onClick: () => void; danger?: boolean; right?: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="w-full min-h-[44px] px-4 flex items-center gap-3 text-left text-sm transition-colors active:bg-white/10"
      style={{ color: danger ? '#ef4444' : colors.text }}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {right}
    </button>
  );

  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-30 flex-shrink-0"
      style={{
        background: colors.bg,
        borderTop: `1px solid ${colors.border}`,
        // Respect notched/home-indicator devices (safe areas).
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── More popup (opens upward, above the toolbar) ── */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute right-2 bottom-full z-50 mb-2 min-w-[240px] max-h-[60dvh] overflow-y-auto rounded-xl shadow-2xl overflow-hidden py-1"
            style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
          >
            <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.text, opacity: 0.5 }}>
              More
            </div>
            <MenuItem icon="💾" label="Save Project" onClick={() => { onSave(); setMoreOpen(false); }} />
            <MenuItem icon="📂" label="Open Project" onClick={() => { onLoad(); setMoreOpen(false); }} />
            <MenuItem icon="📄" label="Generate Report" onClick={() => { onReport(); setMoreOpen(false); }} />
            <MenuItem icon="⚡" label="Quick Formula" onClick={() => { onQuickFormula(); setMoreOpen(false); }} />
            <MenuItem icon="✏️" label="Advanced Node" onClick={() => { onCreateCustomNode(); setMoreOpen(false); }} />
            <MenuItem
              icon="🧲" label="Alignment Snap"
              onClick={() => { onToggleSnap(); }}
              right={<span className="text-xs font-bold" style={{ color: snapEnabled ? colors.accent : colors.text, opacity: snapEnabled ? 1 : 0.5 }}>{snapEnabled ? 'ON' : 'OFF'}</span>}
            />
            <div className="my-1 border-t" style={{ borderColor: colors.border }} />
            {/* Theme picker (same options as the desktop toolbar select) */}
            <div className="px-4 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text, opacity: 0.5 }}>Theme</div>
              <div className="grid grid-cols-4 gap-1">
                {(['dark', 'light', 'grasshopper', 'autocad'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className="h-9 rounded-md text-[10px] font-medium transition-all active:scale-95"
                    style={{
                      background: theme === t ? colors.accent : 'transparent',
                      color: theme === t ? '#fff' : colors.text,
                      border: `1px solid ${theme === t ? colors.accent : colors.border}`,
                    }}
                  >
                    {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : t === 'grasshopper' ? '🦗' : '📐'}
                  </button>
                ))}
              </div>
            </div>
            <div className="my-1 border-t" style={{ borderColor: colors.border }} />
            <div className="px-4 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.text, opacity: 0.5 }}>Demo projects</div>
              {DEMO_PROJECTS.map(d => (
                <button
                  key={d.fileName}
                  onClick={() => { setMoreOpen(false); onLoadDemo(d); }}
                  className="w-full min-h-[40px] px-2 -mx-2 rounded-lg text-left text-xs transition-colors active:bg-white/10"
                  style={{ color: colors.text }}
                >
                  🚀 {d.name}
                </button>
              ))}
            </div>
            <div className="my-1 border-t" style={{ borderColor: colors.border }} />
            <MenuItem icon="⚙️" label="Settings" onClick={() => { onSettings(); setMoreOpen(false); }} />
            <MenuItem icon="👨‍💻" label="About Me" onClick={() => { onAbout(); setMoreOpen(false); }} />
            <MenuItem icon="🗑️" label="Clear Canvas" onClick={() => { setMoreOpen(false); onClear(); }} danger />
          </div>
        </>
      )}

      {/* ── Main tool row ── */}
      <div className="flex items-center px-1.5 pt-1.5 pb-1.5 gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <TButton icon="＋" label="Add" onClick={onOpenLibrary} accent />
        <TButton icon="⚡" label="Formula" onClick={onQuickFormula} />
        <Sep />
        <TButton icon="🔍−" label="Zoom out" onClick={onZoomOut} />
        <TButton icon="🔍+" label="Zoom in" onClick={onZoomIn} />
        <TButton icon="⊞" label="Fit" onClick={onZoomFit} />
        <Sep />
        <TButton icon="↶" label="Undo" onClick={onUndo} />
        <TButton icon="↷" label="Redo" onClick={onRedo} />
        <Sep />
        <TButton icon="📋" label="Props" onClick={onToggleProperties} active={propertiesOpen} />
        <TButton icon="⋯" label="More" onClick={() => setMoreOpen(v => !v)} active={moreOpen} />
      </div>
    </div>
  );
}
