/* ────────────────────────────────────────────────────────────────────────────
 * Canvas "Zoom to Fit" — tests (run via `npm test`)
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CanvasNode } from '../../../types';
import { computeContentBounds, computeFitView } from '../canvasFit';

function node(id: string, x: number, y: number, w = 200, h = 100): CanvasNode {
  return {
    id,
    type: 'number_input',
    x,
    y,
    width: w,
    height: h,
    inputs: [],
    outputs: [],
    label: id,
    category: 'Inputs',
    color: '#000',
    collapsed: false,
    selected: false,
    computed: false,
  };
}

/** Assert that the content's center maps to the viewport's center. */
function assertCentered(view: { zoom: number; panX: number; panY: number }, cx: number, cy: number, vw: number, vh: number, eps = 0.01) {
  assert.ok(Math.abs(view.panX + cx * view.zoom - vw / 2) < eps, `center x: ${view.panX + cx * view.zoom} ≈ ${vw / 2}`);
  assert.ok(Math.abs(view.panY + cy * view.zoom - vh / 2) < eps, `center y: ${view.panY + cy * view.zoom} ≈ ${vh / 2}`);
}

test('computeContentBounds: null for empty, padded union otherwise', () => {
  assert.equal(computeContentBounds([]), null);
  const bounds = computeContentBounds([node('a', 0, 0), node('b', 100, 50)], 32)!;
  // union: (0,0)-(300,150); padded by 32 on each side
  assert.deepEqual(bounds, { x: -32, y: -32, width: 364, height: 214 });
});

test('fit: small content is centered and zoomed in (clamped at maxZoom)', () => {
  // 40×20 node → padded box 104×84; natural zoom ≈ 7.1 > 5 → clamped.
  const bounds = computeContentBounds([node('a', 0, 0, 40, 20)], 32)!;
  const view = computeFitView(bounds, 800, 600)!;
  assert.equal(view.zoom, 5, 'tiny content clamps to max zoom');
  assertCentered(view, 20, 10, 800, 600);
});

test('fit: content exactly sized for the viewport → zoom 1 equivalent', () => {
  // Content 700x400 (no padding) in an 800x600 viewport → zoom = min(800/700, 600/400) = 1.142…
  const view = computeFitView({ x: 100, y: 50, width: 700, height: 400 }, 800, 600)!;
  assert.ok(Math.abs(view.zoom - 800 / 700) < 1e-9);
  assertCentered(view, 100 + 350, 50 + 200, 800, 600);
});

test('fit: distant nodes far apart still get fitted (zoom clamped to minZoom)', () => {
  const nodes = [node('a', 0, 0), node('b', 10000, 5000)];
  const bounds = computeContentBounds(nodes, 32)!;
  const view = computeFitView(bounds, 800, 600)!;
  // Natural zoom ≈ 800/10464 ≈ 0.076 < minZoom → clamped to 0.1.
  assert.equal(view.zoom, 0.1);
  // Even when clamped, the content CENTER is placed in the viewport center.
  const cx = (0 + 10000 + 200) / 2;
  const cy = (0 + 5000 + 100) / 2;
  assertCentered(view, cx, cy, 800, 600);
});

test('fit: negative quadrant content is fitted correctly', () => {
  const bounds = computeContentBounds([node('a', -500, -300)], 32)!;
  const view = computeFitView(bounds, 800, 600)!;
  assertCentered(view, -400, -250, 800, 600);
});

test('fit: null when no content or no viewport', () => {
  assert.equal(computeFitView(null, 800, 600), null);
  assert.equal(computeFitView({ x: 0, y: 0, width: 10, height: 10 }, 0, 600), null);
  assert.equal(computeFitView({ x: 0, y: 0, width: 10, height: 10 }, 800, -5), null);
});

test('fit: degenerate zero-size content does not produce NaN', () => {
  const view = computeFitView({ x: 0, y: 0, width: 0, height: 0 }, 800, 600)!;
  assert.ok(Number.isFinite(view.zoom) && Number.isFinite(view.panX) && Number.isFinite(view.panY));
  assert.equal(view.zoom, 5, 'zero-size content uses max zoom');
});

test('fit: respects custom min/max zoom options', () => {
  // Natural zoom 800/20000 = 0.04 < 0.05 → clamped up to the relaxed min.
  const wide = computeFitView({ x: 0, y: 0, width: 20000, height: 1000 }, 800, 600, { minZoom: 0.05 })!;
  assert.equal(wide.zoom, 0.05, 'wider content uses the relaxed min zoom');
  // Tiny content with a lowered max zoom → clamped down.
  const tiny = computeFitView({ x: 0, y: 0, width: 10, height: 10 }, 800, 600, { maxZoom: 3 })!;
  assert.equal(tiny.zoom, 3, 'tiny content clamps to the custom max zoom');
});
