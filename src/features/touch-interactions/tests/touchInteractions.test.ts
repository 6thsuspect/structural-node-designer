/* ────────────────────────────────────────────────────────────────────────────
 * Touch / pointer interactions — tests (run via `npm test`)
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  beginPinch,
  clampZoom,
  isDoubleTap,
  isTap,
  isValidConnectTarget,
  pointerDistance,
  pointerMidpoint,
  twoPointers,
  updatePinchView,
  DOUBLE_TAP_MS,
  MIN_ZOOM,
  MAX_ZOOM,
  TAP_SLOP_PX,
} from '../touchInteractions';

const VIEW = { zoom: 1, panX: 0, panY: 0 };

test('clampZoom respects app zoom limits', () => {
  assert.equal(clampZoom(0.5), 0.5);
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(2, 0.5, 2), 2);
});

test('pointerDistance / pointerMidpoint', () => {
  assert.equal(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(pointerMidpoint({ x: 100, y: 200 }, { x: 200, y: 400 }), { x: 150, y: 300 });
});

test('pinch zoom keeps the world point under the starting midpoint', () => {
  // Fingers at (400,300) and (600,300) → midpoint (500,300), span 200.
  const g = beginPinch(VIEW, { x: 400, y: 300 }, { x: 600, y: 300 })!;
  assert.ok(g);

  // Pinch OUT to double the span, midpoint unchanged → zoom 2, same world point at midpoint.
  const v = updatePinchView(g, { x: 300, y: 300 }, { x: 700, y: 300 });
  assert.equal(v.zoom, 2);
  // World point at screen (500,300) was (500 - 0)/1 = 500; after: (500 - panX)/2 = 500 → panX = -500.
  assert.equal((500 - v.panX) / v.zoom, 500);
  assert.equal((300 - v.panY) / v.zoom, 300);
});

test('pinch zooms around the pinch midpoint, NOT the screen center', () => {
  // View already panned; midpoint off-center at (800, 200), horizontal span 200.
  const start = { zoom: 1, panX: -100, panY: 50 };
  const g = beginPinch(start, { x: 700, y: 200 }, { x: 900, y: 200 })!;
  const v = updatePinchView(g, { x: 650, y: 200 }, { x: 950, y: 200 }); // span 200→300
  assert.ok(Math.abs(v.zoom - 1.5) < 1e-9);
  // The world coordinate under the (unchanged) midpoint (800,200) must be identical.
  const worldBefore = { x: (800 - start.panX) / start.zoom, y: (200 - start.panY) / start.zoom };
  const worldAfter = { x: (800 - v.panX) / v.zoom, y: (200 - v.panY) / v.zoom };
  assert.ok(Math.abs(worldBefore.x - worldAfter.x) < 1e-9);
  assert.ok(Math.abs(worldBefore.y - worldAfter.y) < 1e-9);
});

test('two-finger move pans (midpoint translation) without zooming', () => {
  const g = beginPinch(VIEW, { x: 400, y: 300 }, { x: 600, y: 300 })!;
  const v = updatePinchView(g, { x: 450, y: 320 }, { x: 650, y: 320 });
  assert.equal(v.zoom, 1); // span unchanged
  assert.equal(v.panX, 50);
  assert.equal(v.panY, 20);
});

test('pinch combines pan and zoom in one gesture', () => {
  const g = beginPinch(VIEW, { x: 400, y: 300 }, { x: 600, y: 300 })!;
  // Double the span AND move the midpoint.
  const v = updatePinchView(g, { x: 400, y: 300 }, { x: 800, y: 300 });
  assert.equal(v.zoom, 2);
  assert.equal(v.panX, -400); // world 600 (old mid) now sits at new mid 600 → panX = 600 - 600*2... verified below
  const worldAtNewMid = { x: (600 - v.panX) / v.zoom, y: (300 - v.panY) / v.zoom };
  assert.deepEqual(worldAtNewMid, { x: 500, y: 300 }); // old midpoint's world position
});

test('pinch zoom is clamped to the app limits', () => {
  const g = beginPinch({ zoom: 4.5, panX: 0, panY: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })!;
  const v = updatePinchView(g, { x: -10000, y: 0 }, { x: 10000, y: 0 });
  assert.equal(v.zoom, MAX_ZOOM);
  const g2 = beginPinch({ zoom: 0.12, panX: 0, panY: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })!;
  const v2 = updatePinchView(g2, { x: 49, y: 0 }, { x: 51, y: 0 });
  assert.equal(v2.zoom, MIN_ZOOM);
});

test('beginPinch rejects zero span', () => {
  assert.equal(beginPinch(VIEW, { x: 10, y: 10 }, { x: 10, y: 10 }), null);
});

test('isTap distinguishes taps from drags using the slop threshold', () => {
  assert.equal(isTap(100, 100, 108, 100), true);   // exactly at slop → still a tap
  assert.equal(isTap(100, 100, 100 + TAP_SLOP_PX + 0.1, 100), false);
  assert.equal(isTap(100, 100, 104, 106), true);   // diagonal hypot(4,6)≈7.21 within slop
  assert.equal(isTap(100, 100, 106, 106), false);  // diagonal hypot(6,6)≈8.49 beyond slop
  assert.equal(isTap(0, 0, 30, 40, 50), true);     // custom threshold
});

test('isDoubleTap needs two taps, close in time and space', () => {
  const first = { x: 100, y: 100, time: 1000 };
  assert.equal(isDoubleTap(null, first), false);
  assert.equal(isDoubleTap(first, { x: 110, y: 105, time: 1000 + DOUBLE_TAP_MS - 1 }), true);
  assert.equal(isDoubleTap(first, { x: 110, y: 105, time: 1000 + DOUBLE_TAP_MS + 1 }), false); // too slow
  assert.equal(isDoubleTap(first, { x: 200, y: 105, time: 1200 }), false); // too far
});

test('isValidConnectTarget: opposite direction on another node only', () => {
  assert.equal(isValidConnectTarget('a', true, 'b', false), true);   // output → input
  assert.equal(isValidConnectTarget('a', false, 'b', true), true);   // input → output (reverse drag)
  assert.equal(isValidConnectTarget('a', true, 'a', false), false);  // self-connection
  assert.equal(isValidConnectTarget('a', true, 'b', true), false);   // output → output
  assert.equal(isValidConnectTarget('a', false, 'b', false), false); // input → input
});

test('twoPointers returns the two oldest tracked pointers', () => {
  const map = new Map();
  assert.equal(twoPointers(map), null);
  map.set(7, { x: 1, y: 1 });
  assert.equal(twoPointers(map), null);
  map.set(3, { x: 2, y: 2 });
  map.set(9, { x: 3, y: 3 });
  const [a, b] = twoPointers(map)!;
  assert.deepEqual(a, { x: 1, y: 1 });
  assert.deepEqual(b, { x: 2, y: 2 });
});
