import React from 'react';
import { Theme } from '../types';

/* ─── Mobile bottom sheet ───
   Generic slide-up drawer used for the node library and the properties
   inspector on compact viewports. Regular scrolling stays available inside
   the body (touch-action is NOT disabled here). Safe-area aware. */

const themeStyles: Record<Theme, { bg: string; border: string; text: string; sub: string; grip: string }> = {
  dark:        { bg: '#0f172a', border: '#1e293b', text: '#e2e8f0', sub: '#94a3b8', grip: '#334155' },
  light:       { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b', sub: '#64748b', grip: '#cbd5e1' },
  grasshopper: { bg: '#1a202c', border: '#2d3748', text: '#e2e8f0', sub: '#a0aec0', grip: '#4a5568' },
  autocad:     { bg: '#0a0a0a', border: '#222222', text: '#ffffff', sub: '#888888', grip: '#333333' },
};

interface Props {
  open: boolean;
  title: string;
  icon?: string;
  theme: Theme;
  onClose: () => void;
  /** Max sheet height as a CSS length. Default 72% of the dynamic viewport. */
  maxHeight?: string;
  children: React.ReactNode;
}

export default function MobileSheet({ open, title, icon, theme, onClose, maxHeight = '72dvh', children }: Props) {
  const colors = themeStyles[theme];
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop: tap to dismiss */}
      <div
        className="snd-sheet-backdrop absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={title}
        className="snd-sheet relative flex flex-col overflow-hidden rounded-t-2xl shadow-2xl"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderBottom: 'none',
          maxHeight,
        }}
      >
        {/* Grab handle + header (safe-area aware via inner padding) */}
        <div className="flex-shrink-0" style={{ touchAction: 'none' }}>
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: colors.grip }} />
          </div>
          <div className="flex items-center gap-2 px-4 pb-2">
            {icon && <span className="text-base">{icon}</span>}
            <span className="text-sm font-bold flex-1 min-w-0 truncate" style={{ color: colors.text }}>{title}</span>
            <button
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="w-11 h-11 -my-2 rounded-lg flex items-center justify-center active:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: colors.text }}
            >
              ✕
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${colors.border}` }} />
        </div>
        {/* Body keeps native touch scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
