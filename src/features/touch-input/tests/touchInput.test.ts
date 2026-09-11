/* ────────────────────────────────────────────────────────────────────────────
 * Touch input support — tests (run via `npm test`)
 *
 * These cover the DOM-free pieces of the touch layer: tap-vs-drag detection
 * (a finger tap must keep behaving like a mouse click) and the drop channel
 * the Toolbox uses for finger drags. Mouse behaviour itself lives in the
 * components and is unchanged.
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TAP_MOVE_THRESHOLD,
  MAX_ZOOM,
  MIN_ZOOM,
  TOOLBOX_TOUCH_DROP_EVENT,
  computePinchView,
  isWithinTapThreshold,
} from '../touchInput';

test('isWithinTapThreshold: still a tap while the finger stays put', () => {
  const start = { x: 120, y: 80 };
  assert.equal(isWithinTapThreshold(start, { x: 120, y: 80 }), true);
  assert.equal(isWithinTapThreshold(start, { x: 122, y: 81 }), true);
  // exactly on the threshold counts as a tap (<=)
  assert.equal(isWithinTapThreshold(start, { x: 120 + TAP_MOVE_THRESHOLD, y: 80 }), true);
});

test('isWithinTapThreshold: a moved finger is a drag, not a tap', () => {
  const start = { x: 120, y: 80 };
  assert.equal(isWithinTapThreshold(start, { x: 120 + TAP_MOVE_THRESHOLD + 1, y: 80 }), false);
  assert.equal(isWithinTapThreshold(start, { x: 120, y: 80 - 40 }), false);
  // distance is euclidean, so a diagonal jitter is measured correctly
  assert.equal(isWithinTapThreshold(start, { x: 125, y: 85 }), false);
  assert.equal(isWithinTapThreshold(start, { x: 124, y: 84 }), true);
});

test('isWithinTapThreshold: threshold is configurable', () => {
  const start = { x: 0, y: 0 };
  assert.equal(isWithinTapThreshold(start, { x: 10, y: 0 }, 12), true);
  assert.equal(isWithinTapThreshold(start, { x: 10, y: 0 }, 5), false);
});

test('TOOLBOX_TOUCH_DROP_EVENT: stable channel name', () => {
  assert.equal(TOOLBOX_TOUCH_DROP_EVENT, 'snd:toolbox-touch-drop');
});

/* ── Two-finger pinch zoom ────────────────────────────────────────────────
 * The pinch drives the existing view state (zoom + pan), so the tests pin down
 * the two properties the canvas relies on: the canvas point under the pinch
 * midpoint stays under the finger, and the existing 0.1–5 zoom limits hold.
 * ──────────────────────────────────────────────────────────────────────── */

/** Canvas coordinate that sits under a viewport point for a given view. */
function canvasPointUnder(view: { zoom: number; panX: number; panY: number }, px: number, py: number) {
  return { x: (px - view.panX) / view.zoom, y: (py - view.panY) / view.zoom };
}

test('computePinchView: fingers moving apart zoom IN around the pinch midpoint', () => {
  const start = { zoom: 1, panX: 0, panY: 0, midX: 400, midY: 300 };
  const before = canvasPointUnder(start, start.midX, start.midY); // 400, 300

  const view = computePinchView(start, { midX: 400, midY: 300, scale: 2 });

  assert.equal(view.zoom, 2);
  // the point under the fingers is unchanged, so the view stays anchored there
  const after = canvasPointUnder(view, 400, 300);
  assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9, JSON.stringify(after));
});

test('computePinchView: fingers moving together zoom OUT around the pinch midpoint', () => {
  const start = { zoom: 2, panX: -150, panY: 40, midX: 250, midY: 180 };
  const before = canvasPointUnder(start, start.midX, start.midY);

  const view = computePinchView(start, { midX: 250, midY: 180, scale: 0.25 });

  assert.equal(view.zoom, 0.5);
  const after = canvasPointUnder(view, 250, 180);
  assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9, JSON.stringify(after));
});

test('computePinchView: moving both fingers together pans (scale 1) without zooming', () => {
  const start = { zoom: 1.5, panX: 100, panY: -50, midX: 300, midY: 200 };
  const view = computePinchView(start, { midX: 350, midY: 240, scale: 1 });

  assert.equal(view.zoom, 1.5);
  assert.equal(view.panX, 150);
  assert.equal(view.panY, -10);
});

test('computePinchView: respects the existing 0.1–5 zoom limits', () => {
  const start = { zoom: 4, panX: 10, panY: 20, midX: 400, midY: 300 };
  const zoomedIn = computePinchView(start, { midX: 400, midY: 300, scale: 3 });
  assert.equal(zoomedIn.zoom, 5); // capped at the app's maximum

  const zoomedOut = computePinchView({ ...start, zoom: 0.2 }, { midX: 400, midY: 300, scale: 0.1 });
  assert.equal(zoomedOut.zoom, MIN_ZOOM); // floored at the app's minimum
  assert.equal(MAX_ZOOM, 5);

  // even at the limit the view still follows the fingers (like a two-finger drag)
  const panned = computePinchView({ ...start, zoom: 5 }, { midX: 420, midY: 300, scale: 2 });
  assert.equal(panned.zoom, 5);
  assert.equal(panned.panX, start.panX + 20);
});

test('computePinchView: a degenerate start view is left alone', () => {
  const start = { zoom: 0, panX: 5, panY: 6, midX: 100, midY: 100 };
  const view = computePinchView(start, { midX: 120, midY: 100, scale: 2 });
  assert.deepEqual(view, { zoom: 0, panX: 5, panY: 6 });
});
