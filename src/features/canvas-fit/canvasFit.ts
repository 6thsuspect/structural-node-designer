/* ────────────────────────────────────────────────────────────────────────────
 * Canvas "Zoom to Fit" — pure math
 *
 * Given the bounding box of all nodes and the canvas viewport size, compute
 * the zoom + pan that makes the entire content visible and centered. Pure
 * and DOM-free so it is unit-testable with node:test. The caller (NodeCanvas)
 * owns the viewport measurement and applies the result via the existing
 * onZoomChange/onPanChange props.
 *
 * The resulting zoom respects the app's existing zoom limits (0.1–5, the same
 * range the wheel zoom uses), so the fit never introduces a competing zoom
 * system. When the content is larger than the limits allow, the view is
 * centered on the content at the closest allowed zoom.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CanvasNode } from '../../types';

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitView {
  zoom: number;
  panX: number;
  panY: number;
}

export interface FitOptions {
  minZoom?: number;
  maxZoom?: number;
  /** Margin (canvas units) kept around the content. */
  padding?: number;
}

/** Bounding box of all nodes (padded). Null when there is no content. */
export function computeContentBounds(
  nodes: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>[],
  padding = 32,
): ContentBounds | null {
  if (nodes.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const n of nodes) {
    x1 = Math.min(x1, n.x);
    y1 = Math.min(y1, n.y);
    x2 = Math.max(x2, n.x + n.width);
    y2 = Math.max(y2, n.y + n.height);
  }
  return {
    x: x1 - padding,
    y: y1 - padding,
    width: x2 - x1 + padding * 2,
    height: y2 - y1 + padding * 2,
  };
}

/**
 * Compute the zoom + pan that shows the whole content box, centered in the
 * viewport. Returns null when there is nothing to fit or no viewport.
 */
export function computeFitView(
  bounds: ContentBounds | null,
  viewportWidth: number,
  viewportHeight: number,
  options: FitOptions = {},
): FitView | null {
  // `options.padding` is accepted for API symmetry with computeContentBounds;
  // the bounds arrive already padded.
  const { minZoom = 0.1, maxZoom = 5 } = options;
  if (!bounds) return null;
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;

  const bw = bounds.width > 0 ? bounds.width : 0;
  const bh = bounds.height > 0 ? bounds.height : 0;
  const zoom = Math.max(
    minZoom,
    Math.min(
      maxZoom,
      Math.min(bw > 0 ? viewportWidth / bw : maxZoom, bh > 0 ? viewportHeight / bh : maxZoom),
    ),
  );

  // Center the (padded) content box inside the viewport at the chosen zoom.
  const panX = (viewportWidth - bw * zoom) / 2 - bounds.x * zoom;
  const panY = (viewportHeight - bh * zoom) / 2 - bounds.y * zoom;

  return { zoom, panX, panY };
}
