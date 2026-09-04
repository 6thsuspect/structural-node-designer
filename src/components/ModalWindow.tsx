import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragState {
  type: 'move' | 'resize';
  dir?: string;
  startX: number;
  startY: number;
  startRect: Rect;
}

interface ModalWindowProps {
  icon?: string;
  title: string;
  subtitle?: ReactNode;
  overlay: string;
  bg: string;
  border: string;
  text: string;
  onClose: () => void;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  scrollBody?: boolean;
  zIndex?: number;
  /** When set, the window's size and position are remembered between opens. */
  persistKey?: string;
  children: ReactNode;
  footer?: ReactNode;
}

function computeInitialRect(w: number, h: number): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(8, Math.round((vh - h) / 2)),
    w: Math.min(w, vw - 16),
    h: Math.min(h, vh - 16),
  };
}

// Keep a rect at least partially visible inside the current viewport.
function clampToViewport(r: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(r.x, -r.w + 120), vw - 120),
    y: Math.min(Math.max(r.y, 0), vh - 56),
    w: Math.min(r.w, vw - 16),
    h: Math.min(r.h, vh - 16),
  };
}

function loadPersisted(key: string): Rect | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      Number.isFinite(p.x) && Number.isFinite(p.y) &&
      Number.isFinite(p.w) && Number.isFinite(p.h) &&
      p.w > 100 && p.h > 100
    ) {
      return { x: p.x, y: p.y, w: p.w, h: p.h };
    }
  } catch {
    /* ignore corrupt/absent data */
  }
  return null;
}

const HANDLE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function handleStyle(dir: string): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    zIndex: 20,
    touchAction: 'none',
  };
  switch (dir) {
    case 'n': return { ...base, top: 0, left: 24, right: 24, height: 5, cursor: 'ns-resize' };
    case 's': return { ...base, bottom: 0, left: 24, right: 24, height: 5, cursor: 'ns-resize' };
    case 'e': return { ...base, right: 0, top: 24, bottom: 24, width: 5, cursor: 'ew-resize' };
    case 'w': return { ...base, left: 0, top: 24, bottom: 24, width: 5, cursor: 'ew-resize' };
    case 'ne': return { ...base, top: 0, right: 0, width: 12, height: 12, cursor: 'nesw-resize' };
    case 'nw': return { ...base, top: 0, left: 0, width: 12, height: 12, cursor: 'nwse-resize' };
    case 'se': return { ...base, bottom: 0, right: 0, width: 16, height: 16, cursor: 'nwse-resize', borderRadius: '0 0 12px 0' };
    case 'sw': return { ...base, bottom: 0, left: 0, width: 12, height: 12, cursor: 'nesw-resize' };
    default: return base;
  }
}

function cursorFor(dir?: string): string {
  if (dir === 'n' || dir === 's') return 'ns-resize';
  if (dir === 'e' || dir === 'w') return 'ew-resize';
  if (dir === 'ne' || dir === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

/**
 * A draggable, resizable modal window.
 * - Drag the title bar to move it anywhere within the window.
 * - Drag any edge or corner to reshape it to any size.
 * - The window is clamped so it can never be lost off-screen.
 * - When `persistKey` is provided, size/position are saved and restored.
 */
export default function ModalWindow({
  icon,
  title,
  subtitle,
  overlay,
  bg,
  border,
  text,
  onClose,
  initialWidth = 720,
  initialHeight = 560,
  minWidth = 360,
  minHeight = 240,
  scrollBody = true,
  zIndex = 50,
  persistKey,
  children,
  footer,
}: ModalWindowProps) {
  const [rect, setRect] = useState<Rect>(() => {
    if (persistKey) {
      const saved = loadPersisted(persistKey);
      if (saved) return clampToViewport(saved);
    }
    return computeInitialRect(initialWidth, initialHeight);
  });
  const dragRef = useRef<DragState | null>(null);
  const lastInteractRef = useRef(0);
  const rectRef = useRef(rect);
  useEffect(() => { rectRef.current = rect; }, [rect]);

  // Debounced persistence while the window is being moved/resized.
  useEffect(() => {
    if (!persistKey) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(persistKey, JSON.stringify(rect)); } catch { /* ignore */ }
    }, 150);
    return () => clearTimeout(t);
  }, [rect, persistKey]);

  // Authoritative save on unmount (window closed).
  useEffect(() => {
    return () => {
      if (persistKey) {
        try { localStorage.setItem(persistKey, JSON.stringify(rectRef.current)); } catch { /* ignore */ }
      }
    };
  }, [persistKey]);

  const resizeRect = (d: DragState, dx: number, dy: number): Rect => {
    const s = d.startRect;
    const dir = d.dir || 'se';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w = s.w;
    let h = s.h;
    if (dir.includes('e')) w = s.w + dx;
    if (dir.includes('s')) h = s.h + dy;
    if (dir.includes('w')) w = s.w - dx;
    if (dir.includes('n')) h = s.h - dy;
    w = Math.max(minWidth, Math.min(w, vw - 16));
    h = Math.max(minHeight, Math.min(h, vh - 16));
    let x = s.x;
    let y = s.y;
    if (dir.includes('w')) x = s.x + (s.w - w);
    if (dir.includes('n')) y = s.y + (s.h - h);
    return { x, y, w, h };
  };

  // Global mouse listeners for drag / resize. They always read from dragRef,
  // so they are attached once and simply no-op while no interaction is active.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.type === 'move') {
        setRect(clampToViewport({ x: d.startRect.x + dx, y: d.startRect.y + dy, w: d.startRect.w, h: d.startRect.h }));
      } else {
        setRect(resizeRect(d, dx, dy));
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        lastInteractRef.current = Date.now();
        dragRef.current = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWidth, minHeight]);

  // Keep the window on-screen if the browser viewport changes.
  useEffect(() => {
    const onResize = () => setRect((r) => clampToViewport(r));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const begin = (e: ReactMouseEvent, type: 'move' | 'resize', dir?: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { type, dir, startX: e.clientX, startY: e.clientY, startRect: rect };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'move' ? 'move' : cursorFor(dir);
  };

  const handleOverlayClick = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return;
    // Ignore the click that immediately follows a drag/resize release.
    if (Date.now() - lastInteractRef.current < 300) return;
    onClose();
  };

  return (
    <div className="fixed inset-0" style={{ background: overlay, zIndex }} onClick={handleOverlayClick}>
      <div
        className="fixed rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, background: bg, border: `1px solid ${border}` }}
      >
        {/* Title bar — drag handle */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0 select-none"
          style={{ borderBottom: `1px solid ${border}`, cursor: 'move' }}
          title="Drag to move • drag edges to resize"
          onMouseDown={(e) => begin(e, 'move')}
        >
          {icon && <span className="text-2xl">{icon}</span>}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate" style={{ color: text }}>{title}</h2>
            {subtitle && <div className="text-xs mt-0.5">{subtitle}</div>}
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: text }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{ overflow: scrollBody ? 'auto' : 'hidden', scrollbarWidth: 'thin' }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && <div className="flex-shrink-0">{footer}</div>}

        {/* Resize handles */}
        {HANDLE_DIRS.map((dir) => (
          <div key={dir} onMouseDown={(e) => begin(e, 'resize', dir)} style={handleStyle(dir)} />
        ))}
      </div>
    </div>
  );
}
