/* Node Groups — public entry point (pure helpers; state lives in useNodeEditor). */

export {
  computeGroupBounds,
  getGroupOfNode,
  getGroupOfShape,
  groupMemberIds,
  groupShapeIds,
  groupNodeIds,
  expandSelectionWithGroups,
  effectiveSelection,
  pruneGroups,
  removeGroupsContaining,
  hasGroupMembership,
  nextGroupName,
  normalizeMarquee,
  nodesInBox,
} from './nodeGroups';
export type { GroupBounds, BoxRect } from './nodeGroups';
