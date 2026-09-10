/* ────────────────────────────────────────────────────────────────────────────
 * Touch / pointer interactions — pure math
 *
 * DOM-free helpers shared by the NodeCanvas pointer-interaction layer (and
 * unit-testable with node:test, like the other features). All screen-space
 * quantities are CSS pixels; all canvas quantities are world units.
 *
 * Gesture rules implemented on top of these helpers (documented for the whole
 * touch layer — see docs/MOBILE_TOUCH.md):
 *
 *   Gesture                | Action
 *   -----------------------|------------------------------------------
 *   Tap node               | Select
 *   Drag node              | Move node (after 8 px threshold)
 *   Tap empty canvas       | Clear selection (or place pending node)
 *   Drag empty canvas      | Pan
 *   Drag port              | Create connection (preview while dragging)
 *   Tap port               | Nothing (never an accidental connection)
 *   Pinch                  | Zoom around the pinch midpoint
 *   Two-finger move        | Pan + zoom combined
 *   Long-press node/shape  | Context menu
 *   Long-press wire        | Wire menu
 *   Long-press canvas      | Selection menu (with selection) or marquee
 *   Double-tap Text shape  | Inline text edit
 * ──────────────────────────────────────────────────────────────────────────── */

/* ─── Zoom limits — identical to the existing wheel-zoom / fit limits ─── */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

/** Pan/zoom view state (the app's existing zoom/panX/panY triple). */
export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

/** A tracked pointer position, in CSS pixels relative to the viewport. */
export interface PointerPos {
  x: number;
  y: number;
}

/** Clamp a zoom level to the app's limits. */
export function clampZoom(zoom: number, min: number = MIN_ZOOM, max: number = MAX_ZOOM): number {
  return Math.max(min, Math.min(max, zoom));
}

/** Euclidean distance between two pointers (pinch span). */
export function pointerDistance(a: PointerPos, b: PointerPos): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/** Midpoint between two pointers — the pinch anchor. */
export function pointerMidpoint(a: PointerPos, b: PointerPos): PointerPos {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** State captured when a pinch starts (two pointers). */
export interface PinchGesture {
  startDist: number;
  startMid: PointerPos;
  startView: ViewTransform;
}

/**
 * Begin a pinch from the first two currently-tracked pointers.
 * Returns null when fewer than two pointers are tracked.
 */
export function beginPinch(startView: ViewTransform, a: PointerPos, b: PointerPos): PinchGesture | null {
  const dist = pointerDistance(a, b);
  if (dist <= 0) return null;
  return { startDist: dist, startMid: pointerMidpoint(a, b), startView };
}

/**
 * Compute the view after the pointers moved, keeping the world point under
 * the STARTING midpoint pinned to the CURRENT midpoint. This makes the zoom
 * happen around the user's fingers (never the screen center) and lets the
 * same gesture pan (midpoint translation) and zoom (distance ratio) at once.
 */
export function updatePinchView(
  gesture: PinchGesture,
  a: PointerPos,
  b: PointerPos,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
): ViewTransform {
  const dist = pointerDistance(a, b);
  const mid = pointerMidpoint(a, b);
  const ratio = dist > 0 ? dist / gesture.startDist : 1;
  const zoom = clampZoom(gesture.startView.zoom * ratio, minZoom, maxZoom);
  const scale = zoom / gesture.startView.zoom;
  return {
    zoom,
    panX: mid.x - (gesture.startMid.x - gesture.startView.panX) * scale,
    panY: mid.y - (gesture.startMid.y - gesture.startView.panY) * scale,
  };
}

/* ─── Tap / drag discrimination ─── */

/** Max movement (CSS px) that still counts as a tap, not a drag. */
export const TAP_SLOP_PX = 8;
/** Long-press duration (ms) before a context menu opens. */
export const LONG_PRESS_MS = 550;
/** Max ms between two taps for a double-tap. */
export const DOUBLE_TAP_MS = 350;
/** Max movement (CSS px) between two taps for a double-tap. */
export const DOUBLE_TAP_SLOP_PX = 30;

/** True when the pointer moved less than the tap slop (i.e. it was a tap). */
export function isTap(
  startX: number,
  startY: number,
  x: number,
  y: number,
  slop: number = TAP_SLOP_PX,
): boolean {
  return Math.hypot(x - startX, y - startY) <= slop;
}

/** A completed tap, remembered to detect the next double-tap. */
export interface TapRecord {
  x: number;
  y: number;
  time: number;
}

/** True when `t` continues the double-tap started by `prev`. */
export function isDoubleTap(prev: TapRecord | null, t: TapRecord): boolean {
  if (!prev) return false;
  if (t.time - prev.time > DOUBLE_TAP_MS) return false;
  return Math.hypot(t.x - prev.x, t.y - prev.y) <= DOUBLE_TAP_SLOP_PX;
}

/* ─── Connection target validation (touch + preview highlighting) ─── */

/**
 * Is `targetPort` a valid release target for a connection started at
 * `fromPort`? Valid means: another node AND the opposite port direction
 * (output→input or input→output). Self-connections and same-direction wires
 * are invalid — the drag is cancelled on release instead of creating junk.
 */
export function isValidConnectTarget(
  fromNodeId: string,
  fromIsOutput: boolean,
  targetNodeId: string,
  targetIsOutput: boolean,
): boolean {
  return fromNodeId !== targetNodeId && fromIsOutput !== targetIsOutput;
}

/**
 * Pick the two oldest pointers from a tracked-pointer map (insertion order).
 * Returns null unless at least two pointers are tracked.
 */
export function twoPointers(map: Map<number, PointerPos>): [PointerPos, PointerPos] | null {
  const it = map.values();
  const first = it.next();
  if (first.done) return null;
  const second = it.next();
  if (second.done) return null;
  return [first.value, second.value];
}
