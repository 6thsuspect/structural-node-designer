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
