/* ────────────────────────────────────────────────────────────────────────────
 * Touch input support — the small, DOM-free pieces of the touch layer.
 *
 * The application keeps its existing mouse behaviour untouched; these helpers
 * only describe the finger-specific bits the DOM handlers need:
 *   • how far a finger may travel and still count as a tap (a mouse "click"),
 *   • the channel the Toolbox uses to hand a finger drop to the canvas
 *     (touchscreens do not generate HTML5 drag & drop events, which is what the
 *     mouse drag from the Toolbox uses).
 *
 * The actual coordinate conversion stays where it already lives — NodeCanvas'
 * screenToCanvas — so finger input uses the exact same canvas transformation
 * as the mouse (same zoom / pan handling, same node and port positions).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Screen-pixel distance a finger may travel and still be treated as a tap
 *  (the touch equivalent of a mouse click). Beyond this the gesture is a drag
 *  and follows the finger — same as holding the mouse button down. */
export const TAP_MOVE_THRESHOLD = 6;

/** How long a finger must be held still before the canvas switches into
 *  multi-select mode (the touch equivalent of Shift+click, which a finger has
 *  no way of pressing). */
export const LONG_PRESS_MS = 500;

/** A held finger is allowed to jitter a little more than a tapping finger
 *  before the hold is treated as a drag (pan / node move) instead. */
export const LONG_PRESS_MOVE_TOLERANCE = 10;

/** Existing view limits (the same 0.1–5 range the mouse wheel zoom uses). */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export interface Point {
  x: number;
  y: number;
}

/**
 * True while a gesture has not travelled far enough to be a drag.
 * Used to keep a plain finger tap on the empty canvas behaving like a plain
 * mouse click (deselect), while a moving finger pans the canvas.
 */
export function isWithinTapThreshold(
  start: Point,
  current: Point,
  threshold: number = TAP_MOVE_THRESHOLD,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) <= threshold;
}

/* ── Two-finger pinch zoom ────────────────────────────────────────────────
   Pinching changes the SAME view state the mouse wheel changes (zoom + pan),
   with the same 0.1–5 limits, so it is not a second zoom system: the canvas
   point under the pinch midpoint stays under the finger, and moving both
   fingers pans the view (exactly how the wheel keeps the point under the
   cursor while zooming). */

export interface PinchViewStart {
  /** View state when the pinch began. */
  zoom: number;
  panX: number;
  panY: number;
  /** Pinch midpoint then, in viewport (svg-relative) pixels. */
  midX: number;
  midY: number;
}

export interface PinchViewCurrent {
  /** Pinch midpoint now, in viewport (svg-relative) pixels. */
  midX: number;
  midY: number;
  /** currentDistance / startDistance (> 0). */
  scale: number;
}

/**
 * The view (zoom + pan) for a pinch in progress.
 * `scale` < 1 = fingers moved together = zoom out; > 1 = zoom in.
 */
export function computePinchView(
  start: PinchViewStart,
  current: PinchViewCurrent,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
): { zoom: number; panX: number; panY: number } {
  const zoom = Math.max(minZoom, Math.min(maxZoom, start.zoom * current.scale));
  if (start.zoom <= 0 || !Number.isFinite(zoom)) return { zoom: start.zoom, panX: start.panX, panY: start.panY };
  const ratio = zoom / start.zoom;
  // Keep the canvas point that was under the start midpoint under the finger.
  return {
    zoom,
    panX: current.midX - (start.midX - start.panX) * ratio,
    panY: current.midY - (start.midY - start.panY) * ratio,
  };
}

/**
 * Window event the Toolbox fires when a finger drag ends over the canvas.
 * The canvas listens for it and runs the *same* drop handler the mouse uses,
 * so nodes/shapes land at the same canvas coordinates with either input.
 */
export const TOOLBOX_TOUCH_DROP_EVENT = 'snd:toolbox-touch-drop';

/** Payload of {@link TOOLBOX_TOUCH_DROP_EVENT}. */
export interface ToolboxTouchDropDetail {
  /** Node definition type (present for node drags). */
  nodeType?: string;
  /** Shape type (present for shape drags). */
  shapeType?: string;
  /** Where the finger was lifted, in client (screen) coordinates. */
  clientX: number;
  clientY: number;
}
