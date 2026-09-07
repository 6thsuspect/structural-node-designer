/* ────────────────────────────────────────────────────────────────────────────
 * Canvas Shapes — pure logic
 *
 * Shape catalog (the "typical shapes" offered in the Toolbox "Shapes" category),
 * shape creation, corner-resize math, polygon geometry, and save-file
 * sanitization. Pure and DOM-free so it is unit-testable with node:test.
 * Rendering and interaction live in NodeCanvas; state lives in useNodeEditor.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CanvasShape, ShapeType } from '../../types';

export type ShapeResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export const MIN_SHAPE_SIZE = 20;

/** Default fill color for new shapes (hex). */
export const DEFAULT_SHAPE_COLOR = '#60a5fa';
/** Default fill opacity for new shapes (0–1). */
export const DEFAULT_SHAPE_FILL_OPACITY = 0.15;
/** Default content for a new text annotation. */
export const DEFAULT_TEXT_CONTENT = 'Text';
/** Default font size (canvas units) for a new text annotation. */
export const DEFAULT_TEXT_FONT_SIZE = 16;
/** Min/max font size allowed for text annotations. */
export const TEXT_FONT_SIZE_MIN = 6;
export const TEXT_FONT_SIZE_MAX = 200;
/** Max characters kept for a text annotation (save-file guard). */
export const TEXT_CONTENT_MAX_LENGTH = 5000;
/** Font families offered for text annotations. */
export const TEXT_FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'System', value: 'system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

export interface ShapeCatalogEntry {
  type: ShapeType;
  label: string;
  icon: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
}

/** The "typical shapes" available in the Toolbox "Shapes" tab. */
export const SHAPE_CATALOG: ShapeCatalogEntry[] = [
  { type: 'rectangle', label: 'Rectangle', icon: '▭', description: 'Rectangle — drag a corner to resize', defaultWidth: 240, defaultHeight: 140 },
  { type: 'square', label: 'Square', icon: '◻', description: 'Square — drag a corner to resize', defaultWidth: 160, defaultHeight: 160 },
  { type: 'circle', label: 'Circle', icon: '◯', description: 'Circle (ellipse when resized) — drag a corner to resize', defaultWidth: 150, defaultHeight: 150 },
  { type: 'triangle', label: 'Triangle', icon: '◬', description: 'Triangle — drag a corner to resize', defaultWidth: 180, defaultHeight: 150 },
  { type: 'diamond', label: 'Diamond', icon: '◈', description: 'Diamond — drag a corner to resize', defaultWidth: 150, defaultHeight: 150 },
  { type: 'hexagon', label: 'Hexagon', icon: '⬡', description: 'Hexagon — drag a corner to resize', defaultWidth: 200, defaultHeight: 150 },
  { type: 'text', label: 'Text', icon: 'T', description: 'Text — double-click to edit; drag corners to resize the box', defaultWidth: 220, defaultHeight: 60 },
];

export const SHAPE_TYPES: ShapeType[] = SHAPE_CATALOG.map(s => s.type);

export function getShapeDefinition(type: ShapeType): ShapeCatalogEntry | undefined {
  return SHAPE_CATALOG.find(s => s.type === type);
}

function newShapeId(): string {
  return `shape-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Create a shape of the given type at (x, y) with the catalog default size. */
export function createShape(type: ShapeType, x: number, y: number, id?: string): CanvasShape | null {
  const def = getShapeDefinition(type);
  if (!def) return null;
  return {
    id: id ?? newShapeId(),
    type,
    x,
    y,
    width: def.defaultWidth,
    height: def.defaultHeight,
    frozen: false,
    color: DEFAULT_SHAPE_COLOR,
    fillOpacity: DEFAULT_SHAPE_FILL_OPACITY,
    front: false,
    // Text annotations carry content + formatting (other shapes omit these).
    ...(type === 'text'
      ? {
          text: DEFAULT_TEXT_CONTENT,
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          textAlign: 'left' as const,
          fontWeight: 'normal' as const,
          fontStyle: 'normal' as const,
          underline: false,
        }
      : {}),
  };
}

/**
 * New bounding box when a corner handle is dragged to (px, py) WHILE HOLDING
 * CTRL: the shape keeps its aspect ratio (width/height at drag start) around
 * the opposite corner. Same min-size guarantee as shapeResizeBox (the ratio
 * may break slightly at the clamp boundary).
 */
export function shapeRatioResizeBox(
  shape: Pick<CanvasShape, 'x' | 'y' | 'width' | 'height'>,
  handle: ShapeResizeHandle,
  px: number,
  py: number,
  ratio: number,
  minSize: number = MIN_SHAPE_SIZE,
): { x: number; y: number; width: number; height: number } {
  const r = ratio > 0 ? ratio : 1;
  const right = shape.x + shape.width;
  const bottom = shape.y + shape.height;
  // The opposite corner is the fixed anchor.
  const anchorX = handle === 'nw' || handle === 'sw' ? right : shape.x;
  const anchorY = handle === 'nw' || handle === 'ne' ? bottom : shape.y;

  const dx = Math.abs(px - anchorX);
  const dy = Math.abs(py - anchorY);
  let w = Math.max(dx, dy * r);
  let h = w / r;
  w = Math.max(w, minSize);
  h = Math.max(h, minSize);

  const x = handle === 'nw' || handle === 'sw' ? anchorX - w : anchorX;
  const y = handle === 'nw' || handle === 'ne' ? anchorY - h : anchorY;
  return { x, y, width: w, height: h };
}

/**
 * New bounding box after dragging one of the shape's corner handles to
 * (px, py). The opposite corner stays fixed; the result never goes below
 * `minSize` in either dimension.
 */
export function shapeResizeBox(
  shape: Pick<CanvasShape, 'x' | 'y' | 'width' | 'height'>,
  handle: ShapeResizeHandle,
  px: number,
  py: number,
  minSize: number = MIN_SHAPE_SIZE,
): { x: number; y: number; width: number; height: number } {
  let left = shape.x;
  let right = shape.x + shape.width;
  let top = shape.y;
  let bottom = shape.y + shape.height;

  if (handle === 'nw' || handle === 'sw') left = Math.min(px, right - minSize);
  else if (handle === 'ne' || handle === 'se') right = Math.max(px, left + minSize);

  if (handle === 'nw' || handle === 'ne') top = Math.min(py, bottom - minSize);
  else if (handle === 'se' || handle === 'sw') bottom = Math.max(py, top + minSize);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** SVG `points` attribute for the polygon-based shapes, fitted to the box. */
export function shapePolygonPoints(
  type: ShapeType,
  x: number,
  y: number,
  width: number,
  height: number,
): string | null {
  const cx = x + width / 2;
  const cy = y + height / 2;
  switch (type) {
    case 'triangle':
      return `${x},${y + height} ${cx},${y} ${x + width},${y + height}`;
    case 'diamond':
      return `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
    case 'hexagon':
      return [
        `${x + width * 0.25},${y}`,
        `${x + width * 0.75},${y}`,
        `${x + width},${cy}`,
        `${x + width * 0.75},${y + height}`,
        `${x + width * 0.25},${y + height}`,
        `${x},${cy}`,
      ].join(' ');
    default:
      return null; // rectangle / square / circle / text are not polygons
  }
}

/**
 * Validate a saved (untrusted) shapes array into clean CanvasShape values.
 * Bad entries are dropped instead of breaking project load.
 */
export function sanitizeShapes(raw: unknown): CanvasShape[] {
  if (!Array.isArray(raw)) return [];
  const out: CanvasShape[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.type !== 'string' || !SHAPE_TYPES.includes(o.type as ShapeType)) continue;
    const x = Number(o.x);
    const y = Number(o.y);
    const w = Number(o.width);
    const h = Number(o.height);
    if (![x, y, w, h].every(Number.isFinite)) continue;
    // Fill color/opacity: accept finite values only, fall back to defaults
    // (old project files predate these fields).
    const color = typeof o.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.color)
      ? o.color
      : DEFAULT_SHAPE_COLOR;
    const fillOpacityRaw = Number(o.fillOpacity);
    const fillOpacity = Number.isFinite(fillOpacityRaw)
      ? Math.min(1, Math.max(0, fillOpacityRaw))
      : DEFAULT_SHAPE_FILL_OPACITY;
    const base = {
      id: typeof o.id === 'string' && o.id ? o.id : newShapeId(),
      type: o.type as ShapeType,
      x,
      y,
      width: Math.max(w, 1),
      height: Math.max(h, 1),
      frozen: Boolean(o.frozen),
      color,
      fillOpacity,
      front: Boolean(o.front),
    };
    // Text annotations: validate + preserve content and formatting.
    if (o.type === 'text') {
      const fontSizeRaw = Number(o.fontSize);
      const fontColor = typeof o.fontColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.fontColor)
        ? o.fontColor
        : undefined;
      const fontFamily = typeof o.fontFamily === 'string' && o.fontFamily.length <= 200
        ? o.fontFamily
        : undefined;
      out.push({
        ...base,
        text: typeof o.text === 'string' ? o.text.slice(0, TEXT_CONTENT_MAX_LENGTH) : DEFAULT_TEXT_CONTENT,
        fontSize: Number.isFinite(fontSizeRaw)
          ? Math.min(TEXT_FONT_SIZE_MAX, Math.max(TEXT_FONT_SIZE_MIN, fontSizeRaw))
          : DEFAULT_TEXT_FONT_SIZE,
        fontColor,
        fontFamily,
        fontWeight: o.fontWeight === 'bold' ? 'bold' : 'normal',
        fontStyle: o.fontStyle === 'italic' ? 'italic' : 'normal',
        underline: Boolean(o.underline),
        textAlign: o.textAlign === 'center' || o.textAlign === 'right' ? o.textAlign : 'left',
      });
    } else {
      out.push(base);
    }
  }
  return out;
}
