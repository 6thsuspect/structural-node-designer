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

import { TAP_MOVE_THRESHOLD, TOOLBOX_TOUCH_DROP_EVENT, isWithinTapThreshold } from '../touchInput';

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
