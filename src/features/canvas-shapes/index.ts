export {
  SHAPE_CATALOG,
  SHAPE_TYPES,
  MIN_SHAPE_SIZE,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_FILL_OPACITY,
  DEFAULT_TEXT_CONTENT,
  DEFAULT_TEXT_FONT_SIZE,
  TEXT_FONT_FAMILIES,
  TEXT_FONT_SIZE_MIN,
  TEXT_FONT_SIZE_MAX,
  getShapeDefinition,
  createShape,
  shapeResizeBox,
  shapeRatioResizeBox,
  shapePolygonPoints,
  sanitizeShapes,
} from './shapes';
export type { ShapeCatalogEntry, ShapeResizeHandle } from './shapes';
