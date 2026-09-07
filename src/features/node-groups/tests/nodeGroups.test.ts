/* ────────────────────────────────────────────────────────────────────────────
 * Node Groups — tests (run via `npm test`)
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CanvasNode, NodeGroup } from '../../../types';
import {
  computeGroupBounds,
  effectiveSelection,
  expandSelectionWithGroups,
  getGroupOfNode,
  getGroupOfShape,
  groupMemberIds,
  groupNodeIds,
  groupShapeIds,
  hasGroupMembership,
  nextGroupName,
  nodesInBox,
  normalizeMarquee,
  pruneGroups,
  removeGroupsContaining,
} from '../nodeGroups';

/* ─── Helpers ─── */

function node(id: string, x = 0, y = 0, w = 200, h = 100): CanvasNode {
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

const G1: NodeGroup = { id: 'g1', name: 'Group 1', nodeIds: ['a', 'b'] };
const G2: NodeGroup = { id: 'g2', name: 'Group 2', nodeIds: ['c'] };

test('computeGroupBounds returns padded union of member bounds', () => {
  const nodes = [node('a', 10, 20), node('b', 300, 400, 250, 120)];
  const bounds = computeGroupBounds({ ...G1, nodeIds: ['a', 'b'] }, nodes)!; // default padding 16
  // a: (10,20,200x100) → right 210, bottom 120; b: (300,400,250x120) → right 550, bottom 520
  assert.deepEqual(bounds, { x: -6, y: 4, width: 572, height: 532 });
});

test('computeGroupBounds ignores deleted/unknown members and handles empty groups', () => {
  const nodes = [node('a', 0, 0)];
  assert.equal(computeGroupBounds({ ...G1, nodeIds: ['missing'] }, nodes), null);
  assert.deepEqual(computeGroupBounds(G1, [node('a', 0, 0)]), { x: -16, y: -16, width: 232, height: 132 });
});

test('getGroupOfNode / groupMemberIds', () => {
  const groups = [G1, G2];
  assert.equal(getGroupOfNode(groups, 'a')?.id, 'g1');
  assert.equal(getGroupOfNode(groups, 'z'), undefined);
  assert.deepEqual(groupMemberIds(groups, 'a'), ['a', 'b']);
  assert.deepEqual(groupMemberIds(groups, 'z'), ['z']);
});

test('expandSelectionWithGroups pulls in whole groups (transitively)', () => {
  assert.deepEqual(new Set(expandSelectionWithGroups([G1], ['b'])), new Set(['b', 'a']));
  assert.deepEqual(new Set(expandSelectionWithGroups([G1, G2], ['b', 'c'])), new Set(['b', 'c', 'a']));
  // Shared membership expands both groups.
  const shared: NodeGroup[] = [
    { id: 'g1', name: 'G', nodeIds: ['a', 'x'] },
    { id: 'g2', name: 'G2', nodeIds: ['x', 'y'] },
  ];
  assert.deepEqual(new Set(expandSelectionWithGroups(shared, ['a'])), new Set(['a', 'x', 'y']));
  // Ungrouped selection is untouched.
  assert.deepEqual(expandSelectionWithGroups([G1], ['c', 'd']), ['c', 'd']);
});

test('effectiveSelection: selected node → current selection; unselected → node + group', () => {
  const groups = [G1, G2];
  assert.deepEqual(new Set(effectiveSelection(groups, ['a', 'b', 'c'], 'a')), new Set(['a', 'b', 'c']));
  assert.deepEqual(effectiveSelection(groups, ['a', 'b', 'c'], 'z'), ['z']);
  assert.deepEqual(new Set(effectiveSelection(groups, ['d'], 'b')), new Set(['a', 'b']));
});

test('pruneGroups removes deleted ids and empty groups', () => {
  assert.deepEqual(pruneGroups([G1, G2], ['a']), [
    { id: 'g1', name: 'Group 1', nodeIds: ['b'] },
    G2,
  ]);
  assert.deepEqual(pruneGroups([G1, G2], ['a', 'b', 'c']), []);
  assert.deepEqual(pruneGroups([G1], ['unrelated']), [G1]);
});

test('removeGroupsContaining deletes any group touched by the given ids', () => {
  assert.deepEqual(removeGroupsContaining([G1, G2], ['b']), [G2]);
  assert.deepEqual(removeGroupsContaining([G1, G2], ['a', 'c']), []);
  assert.deepEqual(removeGroupsContaining([G1, G2], ['none']), [G1, G2]);
});

test('hasGroupMembership', () => {
  assert.equal(hasGroupMembership([G1, G2], ['z']), false);
  assert.equal(hasGroupMembership([G1, G2], ['z', 'c']), true);
});

test('nextGroupName increments', () => {
  assert.equal(nextGroupName([]), 'Group 1');
  assert.equal(nextGroupName([G1]), 'Group 2');
  assert.equal(nextGroupName([G1, G2]), 'Group 3');
});

test('normalizeMarquee + nodesInBox use intersection semantics', () => {
  // Inverted marquee normalizes.
  assert.deepEqual(normalizeMarquee(300, 500, 100, 200), { x1: 100, y1: 200, x2: 300, y2: 500 });

  const a = node('a', 0, 0, 100, 100);
  const b = node('b', 250, 250, 100, 100);
  const c = node('c', 600, 600, 100, 100);
  const box = normalizeMarquee(80, 80, 320, 320);
  // a and b intersect the box (partially), c does not.
  assert.deepEqual(nodesInBox([a, b, c], box), ['a', 'b']);
  // A box that only touches an edge (no overlap) selects nothing.
  assert.deepEqual(nodesInBox([a], normalizeMarquee(100, 100, 300, 300)), []);
  assert.deepEqual(nodesInBox([], box), []);
});

/* ─── Mixed node + shape groups (shapes feature) ─── */

function shape(id: string, x = 0, y = 0, w = 100, h = 100): { id: string; x: number; y: number; width: number; height: number } {
  return { id, x, y, width: w, height: h };
}

test('computeGroupBounds includes member shapes when provided', () => {
  const group: NodeGroup = { id: 'g1', name: 'Group 1', nodeIds: ['a'], shapeIds: ['s1'] };
  const nodes = [node('a', 0, 0, 100, 100)];
  const shapes = [shape('s1', 300, 0, 100, 100)];
  // Without shapes: just the node (+16 padding).
  assert.deepEqual(computeGroupBounds(group, nodes), { x: -16, y: -16, width: 132, height: 132 });
  // With shapes: union of node AND shape (+16 padding).
  assert.deepEqual(computeGroupBounds(group, nodes, shapes), { x: -16, y: -16, width: 432, height: 132 });
  // A shape-only group gets bounds from its shape when shapes are provided…
  const shapeOnly: NodeGroup = { id: 'g2', name: 'Group 2', nodeIds: [], shapeIds: ['s1'] };
  assert.deepEqual(computeGroupBounds(shapeOnly, nodes, shapes), { x: 284, y: -16, width: 132, height: 132 });
  // …but not when no shapes are supplied at all.
  assert.equal(computeGroupBounds(shapeOnly, nodes), null);
});

test('group shape queries: groupShapeIds / groupNodeIds / getGroupOfShape', () => {
  const groups = [
    { id: 'g1', name: 'Group 1', nodeIds: ['a', 'b'], shapeIds: ['s1', 's2'] },
    { id: 'g2', name: 'Group 2', nodeIds: ['c'] },
  ];
  assert.deepEqual(groupShapeIds(groups, 'a'), ['s1', 's2']);
  assert.deepEqual(groupShapeIds(groups, 'c'), []);
  assert.deepEqual(groupShapeIds(groups, 'zzz'), []);
  assert.deepEqual(groupNodeIds(groups, 's1'), ['a', 'b']);
  assert.deepEqual(groupNodeIds(groups, 'zzz'), []);
  assert.equal(getGroupOfShape(groups, 's2')?.id, 'g1');
  assert.equal(getGroupOfShape(groups, 'zzz'), undefined);
});

test('pruneGroups removes shape ids and keeps shape-only groups alive', () => {
  const groups = [
    { id: 'g1', name: 'G1', nodeIds: ['a'], shapeIds: ['s1', 's2'] },
    { id: 'g2', name: 'G2', nodeIds: [], shapeIds: ['s3'] },
    { id: 'g3', name: 'G3', nodeIds: ['b'], shapeIds: ['s4'] },
  ];
  // Pruning a shape from g1 keeps g1 alive (it still has a node).
  const pruned = pruneGroups(groups, [], ['s2']);
  assert.deepEqual(pruned.find(g => g.id === 'g1')!.shapeIds, ['s1']);
  // Pruning the last member of a group drops the group (node-only or shape-only).
  assert.equal(pruneGroups(groups, ['b'], ['s4']).some(g => g.id === 'g3'), false);
  assert.equal(pruneGroups(groups, [], ['s3']).some(g => g.id === 'g2'), false);
  // Old groups without shapeIds are untouched.
  assert.deepEqual(pruneGroups([{ id: 'g4', name: 'G4', nodeIds: ['x'] }], ['y']), [{ id: 'g4', name: 'G4', nodeIds: ['x'] }]);
});

test('removeGroupsContaining / hasGroupMembership consider shape membership', () => {
  const groups = [
    { id: 'g1', name: 'G1', nodeIds: ['a'], shapeIds: ['s1'] },
    { id: 'g2', name: 'G2', nodeIds: ['b'] },
  ];
  // Removing by shape id drops only the group containing that shape.
  assert.deepEqual(removeGroupsContaining(groups, [], ['s1']).map(g => g.id), ['g2']);
  // Removing by node id drops only the group containing that node.
  assert.deepEqual(removeGroupsContaining(groups, ['b']).map(g => g.id), ['g1']);
  // Membership detection.
  assert.equal(hasGroupMembership(groups, [], ['s1']), true);
  assert.equal(hasGroupMembership(groups, ['b']), true);
  assert.equal(hasGroupMembership(groups, [], []), false);
  assert.equal(hasGroupMembership(groups, [], ['zzz']), false);
});
