/* ────────────────────────────────────────────────────────────────────────────
 * Canvas Shapes — tests (run via `npm test`)
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SHAPE_CATALOG,
  SHAPE_TYPES,
  MIN_SHAPE_SIZE,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_FILL_OPACITY,
  DEFAULT_TEXT_CONTENT,
  DEFAULT_TEXT_FONT_SIZE,
  TEXT_FONT_SIZE_MAX,
  getShapeDefinition,
  createShape,
  shapeResizeBox,
  shapeRatioResizeBox,
  shapePolygonPoints,
  sanitizeShapes,
} from '../shapes';

const box = { x: 100, y: 50, width: 200, height: 100 }; // right=300, bottom=150

test('catalog: seven typical shapes with valid defaults', () => {
  assert.equal(SHAPE_CATALOG.length, 7);
  assert.deepEqual(
    SHAPE_TYPES,
    ['rectangle', 'square', 'circle', 'triangle', 'diamond', 'hexagon', 'text'],
  );
  for (const entry of SHAPE_CATALOG) {
    assert.ok(entry.defaultWidth >= MIN_SHAPE_SIZE, `${entry.type} default width`);
    assert.ok(entry.defaultHeight >= MIN_SHAPE_SIZE, `${entry.type} default height`);
  }
  assert.equal(getShapeDefinition('square')?.label, 'Square');
  assert.equal(getShapeDefinition('nope' as never), undefined);
});

test('createShape: catalog defaults, unfrozen, custom id honored', () => {
  const s = createShape('rectangle', 10, 20, 'fixed-id')!;
  const def = getShapeDefinition('rectangle')!;
  assert.deepEqual(s, {
    id: 'fixed-id',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: def.defaultWidth,
    height: def.defaultHeight,
    frozen: false,
    color: DEFAULT_SHAPE_COLOR,
    fillOpacity: DEFAULT_SHAPE_FILL_OPACITY,
    front: false,
  });
  const auto = createShape('circle', 0, 0)!;
  assert.ok(auto.id.length > 0);
  assert.equal(createShape('nope' as never, 0, 0), null);
});

test('shapeRatioResizeBox: keeps the aspect ratio around the opposite corner', () => {
  // box 200×100 → ratio 2 (right=300, bottom=150).
  assert.deepEqual(shapeRatioResizeBox(box, 'se', 350, 200, 2), { x: 100, y: 50, width: 300, height: 150 });
  assert.deepEqual(shapeRatioResizeBox(box, 'nw', 0, -100, 2), { x: -200, y: -100, width: 500, height: 250 });
  assert.deepEqual(shapeRatioResizeBox(box, 'ne', 200, 0, 2), { x: 100, y: 0, width: 300, height: 150 });
  assert.deepEqual(shapeRatioResizeBox(box, 'sw', 200, 200, 2), { x: 0, y: 50, width: 300, height: 150 });
  // Shrinking is ratio-preserving too (the drag direction decides the anchor side).
  assert.deepEqual(shapeRatioResizeBox(box, 'se', 200, 100, 2), { x: 100, y: 50, width: 100, height: 50 });
});

test('shapeRatioResizeBox: honors the min-size clamp and a degenerate ratio', () => {
  // Tiny drag → both dimensions clamp to MIN_SHAPE_SIZE (ratio may break there).
  assert.deepEqual(shapeRatioResizeBox(box, 'se', 105, 52, 2), { x: 100, y: 50, width: 20, height: 20 });
  // ratio ≤ 0 is treated as 1:1 instead of producing NaN/Infinity.
  const degenerate = shapeRatioResizeBox(box, 'se', 400, 250, 0);
  assert.ok(Number.isFinite(degenerate.width) && Number.isFinite(degenerate.height));
  assert.equal(degenerate.width, degenerate.height);
});

test('sanitizeShapes: fills color/fillOpacity/front defaults, validates color', () => {
  const clean = sanitizeShapes([
    { id: 'a', type: 'circle', x: 1, y: 2, width: 30, height: 40 }, // old file: no color fields
    { id: 'b', type: 'square', x: 0, y: 0, width: 10, height: 10, color: '#ff0000', fillOpacity: 0.4, front: true },
    { id: 'c', type: 'square', x: 0, y: 0, width: 10, height: 10, color: 'not-a-color', fillOpacity: 5 },
  ]);
  assert.equal(clean[0].color, DEFAULT_SHAPE_COLOR);
  assert.equal(clean[0].fillOpacity, DEFAULT_SHAPE_FILL_OPACITY);
  assert.equal(clean[0].front, false);
  assert.deepEqual(
    { color: clean[1].color, fillOpacity: clean[1].fillOpacity, front: clean[1].front },
    { color: '#ff0000', fillOpacity: 0.4, front: true },
  );
  // Invalid color falls back; out-of-range opacity clamps to 0–1.
  assert.equal(clean[2].color, DEFAULT_SHAPE_COLOR);
  assert.equal(clean[2].fillOpacity, 1);
});

test('shapeResizeBox: dragging a corner moves only its edge', () => {
  // SE corner dragged out → left/top fixed, box grows.
  assert.deepEqual(shapeResizeBox(box, 'se', 400, 250), { x: 100, y: 50, width: 300, height: 200 });
  // NW corner dragged out → right/bottom fixed, box grows around the opposite corner.
  assert.deepEqual(shapeResizeBox(box, 'nw', 0, 0), { x: 0, y: 0, width: 300, height: 150 });
  // NE corner: right edge + top edge move.
  assert.deepEqual(shapeResizeBox(box, 'ne', 350, 10), { x: 100, y: 10, width: 250, height: 140 });
  // SW corner: left edge + bottom edge move.
  assert.deepEqual(shapeResizeBox(box, 'sw', 80, 180), { x: 80, y: 50, width: 220, height: 130 });
});

test('shapeResizeBox: clamps to MIN_SHAPE_SIZE in both dimensions', () => {
  // Drag SE corner to the LEFT of the shape → width can't drop below 20.
  assert.deepEqual(shapeResizeBox(box, 'se', 50, 90), { x: 100, y: 50, width: 20, height: 40 });
  // Drag NW corner far past the opposite edge → clamped, no negative sizes.
  assert.deepEqual(shapeResizeBox(box, 'nw', 500, 500), { x: 280, y: 130, width: 20, height: 20 });
  // Custom min size is honored.
  assert.deepEqual(shapeResizeBox(box, 'se', 0, 0, 60), { x: 100, y: 50, width: 60, height: 60 });
});

test('shapePolygonPoints: triangle / diamond / hexagon geometry', () => {
  assert.equal(shapePolygonPoints('triangle', 0, 0, 100, 100), '0,100 50,0 100,100');
  assert.equal(shapePolygonPoints('diamond', 0, 0, 100, 100), '50,0 100,50 50,100 0,50');
  assert.equal(
    shapePolygonPoints('hexagon', 0, 0, 100, 100),
    '25,0 75,0 100,50 75,100 25,100 0,50',
  );
  // Non-polygon shapes have no points.
  assert.equal(shapePolygonPoints('rectangle', 0, 0, 10, 10), null);
  assert.equal(shapePolygonPoints('circle', 0, 0, 10, 10), null);
  assert.equal(shapePolygonPoints('text', 0, 0, 10, 10), null);
});

test('sanitizeShapes: drops invalid entries, coerces valid ones', () => {
  const clean = sanitizeShapes([
    { id: 'a', type: 'circle', x: 1, y: 2, width: 30, height: 40, frozen: true },
    { id: 'b', type: 'square', x: -5, y: 0, width: 0, height: -3, frozen: false },
    { type: 'triangle', x: '10', y: '20', width: '30', height: '40' }, // strings coerce
    { id: 'bad', type: 'star', x: 0, y: 0, width: 10, height: 10 },  // unknown type
    { id: 'bad', type: 'circle', x: NaN, y: 0, width: 10, height: 10 }, // non-finite
    'not-an-object',
    null,
  ]);
  assert.equal(clean.length, 3);
  assert.deepEqual(clean[0], {
    id: 'a', type: 'circle', x: 1, y: 2, width: 30, height: 40, frozen: true,
    color: DEFAULT_SHAPE_COLOR, fillOpacity: DEFAULT_SHAPE_FILL_OPACITY, front: false,
  });
  assert.deepEqual(clean[1], {
    id: 'b', type: 'square', x: -5, y: 0, width: 1, height: 1, frozen: false,
    color: DEFAULT_SHAPE_COLOR, fillOpacity: DEFAULT_SHAPE_FILL_OPACITY, front: false,
  });
  assert.equal(clean[2].type, 'triangle');
  assert.ok(clean[2].id.startsWith('shape-'));
  assert.equal(sanitizeShapes(undefined).length, 0);
  assert.equal(sanitizeShapes('nope').length, 0);
});

test('createShape: text annotations carry content + format defaults', () => {
  const s = createShape('text', 5, 6, 'text-id')!;
  assert.equal(s.text, DEFAULT_TEXT_CONTENT);
  assert.equal(s.fontSize, DEFAULT_TEXT_FONT_SIZE);
  assert.equal(s.textAlign, 'left');
  assert.equal(s.fontWeight, 'normal');
  assert.equal(s.fontStyle, 'normal');
  assert.equal(s.underline, false);
  assert.equal(getShapeDefinition('text')?.label, 'Text');
  // Geometric shapes omit the text fields entirely.
  const r = createShape('rectangle', 0, 0)!;
  assert.equal('text' in r, false);
});

test('sanitizeShapes: text fields are preserved and validated', () => {
  const clean = sanitizeShapes([
    { id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 60, text: 'Hello', fontSize: 24, fontColor: '#ff0000', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontStyle: 'italic', underline: true, textAlign: 'center' },
    { id: 't2', type: 'text', x: 0, y: 0, width: 200, height: 60, text: 123, fontSize: 9999, fontColor: 'nope', textAlign: 'justify', fontWeight: 'heavy' },
  ]);
  assert.equal(clean[0].text, 'Hello');
  assert.equal(clean[0].fontSize, 24);
  assert.equal(clean[0].fontColor, '#ff0000');
  assert.equal(clean[0].fontFamily, 'Georgia, serif');
  assert.equal(clean[0].fontWeight, 'bold');
  assert.equal(clean[0].underline, true);
  assert.equal(clean[0].textAlign, 'center');
  // Invalid values fall back to defaults (bad color → undefined = theme text).
  assert.equal(clean[1].text, DEFAULT_TEXT_CONTENT);
  assert.equal(clean[1].fontSize, TEXT_FONT_SIZE_MAX);
  assert.equal(clean[1].fontColor, undefined);
  assert.equal(clean[1].textAlign, 'left');
  assert.equal(clean[1].fontWeight, 'normal');
});
