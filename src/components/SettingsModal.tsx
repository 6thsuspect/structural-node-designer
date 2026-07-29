import { useState } from 'react';
import { Theme } from '../types';

interface Props {
  isOpen: boolean;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onClose: () => void;
  onClearAll: () => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; input: string; label: string; accent: string; card: string }> = {
  dark:        { bg:'#1e293b',text:'#e2e8f0',border:'#334155',input:'#0f172a',label:'#94a3b8',accent:'#3b82f6',card:'#0f172a' },
  light:       { bg:'#ffffff',text:'#1e293b',border:'#e2e8f0',input:'#f1f5f9',label:'#64748b',accent:'#3b82f6',card:'#f8fafc' },
  grasshopper: { bg:'#2d3748',text:'#e2e8f0',border:'#4a5568',input:'#1a202c',label:'#a0aec0',accent:'#68d391',card:'#1a202c' },
  autocad:     { bg:'#1a1a1a',text:'#ffffff',border:'#333333',input:'#0a0a0a',label:'#888888',accent:'#00ff00',card:'#0a0a0a' },
};

export default function SettingsModal({ isOpen, theme, onThemeChange, onClose, onClearAll }: Props) {
  const colors = themeStyles[theme];
  const [activeTab, setActiveTab] = useState<'general' | 'theme' | 'about'>('general');

  if (!isOpen) return null;

  const themes = [
    { id: 'dark' as Theme, label: '🌙 Dark', desc: 'Professional dark theme' },
    { id: 'light' as Theme, label: '☀️ Light', desc: 'Bright high-contrast' },
    { id: 'grasshopper' as Theme, label: '🦗 Grasshopper', desc: 'Rhino Grasshopper inspired' },
    { id: 'autocad' as Theme, label: '📐 AutoCAD', desc: 'Classic CAD aesthetic' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md max-h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-bold" style={{ color: colors.text }}>Settings</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: colors.text }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-2 gap-1" style={{ borderBottom: `1px solid ${colors.border}` }}>
          {(['general', 'theme', 'about'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg"
              style={{ background: activeTab === tab ? colors.card : 'transparent', color: activeTab === tab ? colors.text : colors.label, borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : '2px solid transparent' }}>
              {tab === 'general' ? '📋 General' : tab === 'theme' ? '🎨 Theme' : 'ℹ️ About'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: colors.accent }}>Project Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 rounded-lg text-sm text-left hover:bg-white/10 transition-colors" style={{ color: colors.text, border: `1px solid ${colors.border}` }}
                    onClick={onClearAll}>
                    🗑️ Clear All Nodes
                  </button>
                </div>
              </div>
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: colors.accent }}>Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: colors.label }}>
                  <div><strong>Ctrl+Z</strong> — Undo</div>
                  <div><strong>Ctrl+Y</strong> — Redo</div>
                  <div><strong>Ctrl+S</strong> — Save</div>
                  <div><strong>Delete</strong> — Delete node</div>
                  <div><strong>Alt+Drag</strong> — Pan</div>
                  <div><strong>Scroll</strong> — Zoom</div>
                  <div><strong>Esc</strong> — Close menus</div>
                  <div><strong>Right-click</strong> — Context menu</div>
                </div>
              </div>
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: colors.accent }}>Tips</h3>
                <ul className="space-y-1 text-xs" style={{ color: colors.label }}>
                  <li>• Click on a connection wire to get options</li>
                  <li>• Circular connections are automatically prevented</li>
                  <li>• Use ⚡ Quick Formula for fastest custom nodes</li>
                  <li>• Output values appear green, inputs appear blue</li>
                  <li>• Hover over nodes for quick value viewing</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: colors.label }}>Select your preferred visual theme:</p>
              {themes.map(t => (
                <button key={t.id}
                  onClick={() => onThemeChange(t.id)}
                  className="w-full p-3 rounded-lg text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: theme === t.id ? `${colors.accent}20` : colors.card,
                    border: `2px solid ${theme === t.id ? colors.accent : colors.border}`,
                    color: colors.text,
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{t.label}</span>
                    <span className="text-xs" style={{ color: colors.label }}>{t.desc}</span>
                    {theme === t.id && <span className="ml-auto text-xs font-bold" style={{ color: colors.accent }}>✓ Active</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">🏗️</div>
              <h3 className="text-xl font-bold" style={{ color: colors.text }}>Structural Node Designer</h3>
              <p className="text-xs" style={{ color: colors.label }}>Version 1.0</p>
              <p className="text-sm" style={{ color: colors.label }}>
                A Grasshopper-inspired visual programming environment for structural engineering calculations.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-4" style={{ color: colors.label }}>
                <div className="p-2 rounded" style={{ background: colors.card }}>60+ Built-in Nodes</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>Custom Formulas</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>IS 800 / IS 456</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>IRC / IS 875 / IS 1893</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>Live Calculation</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>Circular Ref Prevention</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>4 Themes</div>
                <div className="p-2 rounded" style={{ background: colors.card }}>Connection Menu</div>
              </div>
              <div className="text-[10px] pt-2" style={{ color: colors.label, opacity: 0.5 }}>
                Built with React + TypeScript + Tailwind CSS
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 flex justify-end" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: colors.accent, color: '#fff' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
