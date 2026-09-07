/* ────────────────────────────────────────────────────────────────────────────
 * Node Groups — pure logic
 *
 * Read-only helpers for the canvas grouping feature. All functions are pure
 * (no React, no DOM) so they are unit-testable with node:test. State lives in
 * the existing useNodeEditor hook; this module only derives answers from it.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CanvasNode, NodeGroup } from '../../types';

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalized axis-aligned box (x1 < x2, y1 < y2). */
export interface BoxRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Bounding box around a group's current member positions (padded).
 *  When `shapes` is supplied, the group's member shapes are included too. */
export function computeGroupBounds(
  group: NodeGroup,
  nodes: CanvasNode[],
  shapes?: Pick<CanvasNode, 'id' | 'x' | 'y' | 'width' | 'height'>[],
  padding = 16,
): GroupBounds | null {
  const ids = new Set(group.nodeIds);
  const shapeIds = new Set(group.shapeIds ?? []);
  const members = [
    ...nodes.filter(n => ids.has(n.id)),
    ...(shapes ?? []).filter(s => shapeIds.has(s.id)),
  ];
  if (members.length === 0) return null;
  const x1 = Math.min(...members.map(n => n.x));
  const y1 = Math.min(...members.map(n => n.y));
  const x2 = Math.max(...members.map(n => n.x + n.width));
  const y2 = Math.max(...members.map(n => n.y + n.height));
  return {
    x: x1 - padding,
    y: y1 - padding,
    width: x2 - x1 + padding * 2,
    height: y2 - y1 + padding * 2,
  };
}

/** The group containing a node, if any. */
export function getGroupOfNode(groups: NodeGroup[], nodeId: string): NodeGroup | undefined {
  return groups.find(g => g.nodeIds.includes(nodeId));
}

/** The group containing a shape, if any (mixed node+shape groups). */
export function getGroupOfShape(groups: NodeGroup[], shapeId: string): NodeGroup | undefined {
  return groups.find(g => (g.shapeIds ?? []).includes(shapeId));
}

/** Shape ids of the group that contains the given node (empty when ungrouped). */
export function groupShapeIds(groups: NodeGroup[], nodeId: string): string[] {
  const g = getGroupOfNode(groups, nodeId);
  return g ? [...(g.shapeIds ?? [])] : [];
}

/** Node ids of the group that contains the given shape (empty when ungrouped). */
export function groupNodeIds(groups: NodeGroup[], shapeId: string): string[] {
  const g = getGroupOfShape(groups, shapeId);
  return g ? [...g.nodeIds] : [];
}

/** Drag set for a node: its whole group when grouped, otherwise just itself. */
export function groupMemberIds(groups: NodeGroup[], nodeId: string): string[] {
  const g = getGroupOfNode(groups, nodeId);
  return g ? [...g.nodeIds] : [nodeId];
}

/**
 * Selection expansion rule: selecting any member of a group selects the whole
 * group (groups that share members expand transitively).
 */
export function expandSelectionWithGroups(groups: NodeGroup[], selectedNodeIds: string[]): string[] {
  const expanded = new Set(selectedNodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of groups) {
      if (g.nodeIds.some(id => expanded.has(id))) {
        for (const id of g.nodeIds) {
          if (!expanded.has(id)) {
            expanded.add(id);
            changed = true;
          }
        }
      }
    }
  }
  return Array.from(expanded);
}

/**
 * The selection a group/ungroup action should act on: the current selection
 * when it already contains the referenced node, otherwise the node plus its
 * group members.
 */
export function effectiveSelection(
  groups: NodeGroup[],
  selectedNodeIds: string[],
  nodeId: string,
): string[] {
  const base = selectedNodeIds.includes(nodeId) ? selectedNodeIds : groupMemberIds(groups, nodeId);
  return expandSelectionWithGroups(groups, base);
}

/** Remove deleted node/shape ids from all groups; drop groups that become empty. */
export function pruneGroups(
  groups: NodeGroup[],
  removedNodeIds: string[],
  removedShapeIds: string[] = [],
): NodeGroup[] {
  const removedNodes = new Set(removedNodeIds);
  const removedShapes = new Set(removedShapeIds);
  return groups
    .map(g => {
      // Keep the shapeIds key absent for groups that never had it (clean objects).
      const next: NodeGroup = { ...g, nodeIds: g.nodeIds.filter(id => !removedNodes.has(id)) };
      if (g.shapeIds) next.shapeIds = g.shapeIds.filter(id => !removedShapes.has(id));
      return next;
    })
    .filter(g => g.nodeIds.length > 0 || (g.shapeIds ?? []).length > 0);
}

/** Delete every group that contains at least one of the given node or shape ids. */
export function removeGroupsContaining(
  groups: NodeGroup[],
  nodeIds: string[],
  shapeIds: string[] = [],
): NodeGroup[] {
  const nodeSet = new Set(nodeIds);
  const shapeSet = new Set(shapeIds);
  return groups.filter(
    g => !g.nodeIds.some(id => nodeSet.has(id)) && !(g.shapeIds ?? []).some(id => shapeSet.has(id)),
  );
}

/** True when at least one of the given nodes or shapes currently belongs to a group. */
export function hasGroupMembership(
  groups: NodeGroup[],
  nodeIds: string[],
  shapeIds: string[] = [],
): boolean {
  return nodeIds.some(id => getGroupOfNode(groups, id) !== undefined)
    || shapeIds.some(id => getGroupOfShape(groups, id) !== undefined);
}

/** Auto name for the next group: "Group 1", "Group 2", … */
export function nextGroupName(groups: NodeGroup[]): string {
  return `Group ${groups.length + 1}`;
}

/** Normalize a possibly-inverted marquee rectangle. */
export function normalizeMarquee(startX: number, startY: number, endX: number, endY: number): BoxRect {
  return {
    x1: Math.min(startX, endX),
    y1: Math.min(startY, endY),
    x2: Math.max(startX, endX),
    y2: Math.max(startY, endY),
  };
}

/** Ids of items (nodes or shapes) whose bounds intersect the box (marquee rule). */
export function nodesInBox(
  nodes: Pick<CanvasNode, 'id' | 'x' | 'y' | 'width' | 'height'>[],
  box: BoxRect,
): string[] {
  return nodes
    .filter(n => n.x < box.x2 && n.x + n.width > box.x1 && n.y < box.y2 && n.y + n.height > box.y1)
    .map(n => n.id);
}
