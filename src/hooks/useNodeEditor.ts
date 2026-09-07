import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CanvasNode, Connection, ConnectingState, UndoAction, Theme, NodeGroup, CanvasShape, ShapeType } from '../types';
import { getNodeDefinition, CATEGORY_COLORS, getAllNodes } from '../nodeDefinitions';
import { computeAllNodes } from '../engine';
import {
  getGroupOfShape,
  groupMemberIds,
  groupShapeIds,
  nextGroupName,
  pruneGroups,
  removeGroupsContaining,
} from '../features/node-groups';
import { createShape, sanitizeShapes } from '../features/canvas-shapes';

const NODE_WIDTH = 200;
const PORT_HEIGHT = 28;
const HEADER_HEIGHT = 36;

function createNode(type: string, x: number, y: number): CanvasNode | null {
  const def = getNodeDefinition(type);
  if (!def) return null;

  const id = uuidv4();
  const inputs = def.inputs.map((p, i) => ({
    ...p,
    id: `${id}-in-${i}`,
    connected: false,
  }));
  const outputs = def.outputs.map((p, i) => ({
    ...p,
    id: `${id}-out-${i}`,
    connected: false,
  }));

  const height = HEADER_HEIGHT + Math.max(inputs.length, outputs.length) * PORT_HEIGHT + 12;

  return {
    id,
    type,
    x,
    y,
    width: NODE_WIDTH,
    height,
    inputs,
    outputs,
    label: def.label,
    category: def.category,
    color: CATEGORY_COLORS[def.category] || '#666',
    collapsed: false,
    selected: false,
    computed: false,
  };
}

export function useNodeEditor() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [connecting, setConnecting] = useState<ConnectingState>({
    isConnecting: false,
    mouseX: 0,
    mouseY: 0,
    offsetX: 0,
    offsetY: 0,
  } as any);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /* ── Node Groups feature: multi-selection + grouping (additive) ── */
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<NodeGroup[]>([]);
  /* ── Shapes feature: canvas shapes + selection (additive) ──
     selectedShapeId = the primary shape (resize handles, properties panel);
     selectedShapeIds = the full shape selection (marquee),
     which may also include whole groups together with nodes. */
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  const [searchQuery, setSearchQuery] = useState('');

  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);

  const saveUndoState = useCallback(() => {
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      shapes: JSON.parse(JSON.stringify(shapes)),
    });
    redoStack.current = [];
    if (undoStack.current.length > 100) undoStack.current.shift();
  }, [nodes, connections, shapes]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const state = undoStack.current.pop()!;
    redoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      shapes: JSON.parse(JSON.stringify(shapes)),
    });
    setNodes(state.nodes);
    setConnections(state.connections);
    // Shapes only exist in entries created after the shapes feature; skip for old ones.
    if (state.shapes) setShapes(state.shapes);
  }, [nodes, connections, shapes]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const state = redoStack.current.pop()!;
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      shapes: JSON.parse(JSON.stringify(shapes)),
    });
    setNodes(state.nodes);
    setConnections(state.connections);
    if (state.shapes) setShapes(state.shapes);
  }, [nodes, connections, shapes]);

  const addNode = useCallback((type: string, x: number, y: number) => {
    const node = createNode(type, x, y);
    if (!node) return;
    saveUndoState();
    setNodes(prev => {
      const updated = [...prev, node];
      return computeAllNodes(updated, connections);
    });
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
  }, [connections, saveUndoState]);

  const deleteNode = useCallback((nodeId: string) => {
    saveUndoState();
    setConnections(prev => prev.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    // Groups consistency: never keep references to deleted nodes.
    setGroups(prev => pruneGroups(prev, [nodeId]));
    setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [saveUndoState, selectedNodeId]);

  const moveNode = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y } : n));
  }, []);

  const updateNodeInput = useCallback((nodeId: string, portId: string, value: any) => {
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          inputs: n.inputs.map(p => p.id === portId ? { ...p, value } : p),
        };
      });
      return computeAllNodes(updated, connections);
    });
  }, [connections]);

  const addConnection = useCallback((fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => {
    // Prevent self-connections
    if (fromNodeId === toNodeId) return;

    // Prevent circular references — check if adding this connection would create a cycle
    // A cycle exists if toNodeId is already an ancestor of fromNodeId in the existing graph
    const wouldCreateCycle = (existingConnections: Connection[]): boolean => {
      // BFS/DFS from fromNodeId following connections forward
      // If we can reach toNodeId, then adding fromNodeId→toNodeId creates a cycle
      const visited = new Set<string>();
      const queue = [fromNodeId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === toNodeId) return true; // Cycle detected!
        if (visited.has(current)) continue;
        visited.add(current);
        // Find all nodes that current connects TO (as source)
        for (const c of existingConnections) {
          if (c.fromNodeId === current && !visited.has(c.toNodeId)) {
            queue.push(c.toNodeId);
          }
        }
      }
      return false;
    };

    saveUndoState();
    setConnections(prev => {
      // Check for circular reference BEFORE adding
      if (wouldCreateCycle(prev)) return prev; // Block the connection

      // Remove existing connections to the same input port
      const filtered = prev.filter(c => c.toPortId !== toPortId);
      const newConn: Connection = {
        id: uuidv4(),
        fromNodeId,
        fromPortId,
        toNodeId,
        toPortId,
      };
      return [...filtered, newConn];
    });

    // Recompute after adding connection
    setTimeout(() => {
      setNodes(prev => {
        setConnections(conns => {
          const computed = computeAllNodes(prev, conns);
          setNodes(computed);
          return conns;
        });
        return prev;
      });
    }, 0);
  }, [saveUndoState]);

  const removeConnection = useCallback((connId: string) => {
    saveUndoState();
    setConnections(prev => {
      const updated = prev.filter(c => c.id !== connId);
      setNodes(ns => computeAllNodes(ns, updated));
      return updated;
    });
  }, [saveUndoState]);

  /** Recolor a wire (cosmetic — no undo entry, like other cosmetic updates).
   *  Pass undefined to drop the override and reset to the theme default. */
  const updateConnectionColor = useCallback((connId: string, color: string | undefined) => {
    setConnections(prev => prev.map(c => {
      if (c.id !== connId) return c;
      if (color === undefined) {
        const { color: _drop, ...rest } = c;
        return rest;
      }
      return { ...c, color };
    }));
  }, []);

  const startConnecting = useCallback((fromNodeId: string, fromPortId: string, isOutput: boolean, mouseX: number, mouseY: number) => {
    setConnecting({
      isConnecting: true,
      fromNodeId,
      fromPortId,
      fromIsOutput: isOutput,
      mouseX,
      mouseY,
    });
  }, []);

  const updateConnecting = useCallback((mouseX: number, mouseY: number) => {
    setConnecting(prev => ({ ...prev, mouseX, mouseY }));
  }, []);

  const finishConnecting = useCallback((toNodeId?: string, toPortId?: string) => {
    if (connecting.isConnecting && connecting.fromNodeId && connecting.fromPortId && toNodeId && toPortId) {
      if (connecting.fromIsOutput) {
        addConnection(connecting.fromNodeId, connecting.fromPortId, toNodeId, toPortId);
      } else {
        addConnection(toNodeId, toPortId, connecting.fromNodeId, connecting.fromPortId);
      }
    }
    setConnecting({ isConnecting: false, mouseX: 0, mouseY: 0 } as any);
  }, [connecting, addConnection]);

  const selectNode = useCallback((nodeId: string | null) => {
    if (nodeId === null) {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedShapeId(null);
      setSelectedShapeIds([]);
      setNodes(prev => prev.some(n => n.selected) ? prev.map(n => ({ ...n, selected: false })) : prev);
      return;
    }
    // Grouping feature: selecting a grouped node selects its whole group.
    // Ungrouped nodes behave exactly as before (single selection).
    const ids = Array.from(new Set(groupMemberIds(groups, nodeId)));
    // Mixed groups: the group's shapes join the selection too (highlight + group actions).
    const shapeIds = groupShapeIds(groups, nodeId);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds(ids);
    setSelectedShapeIds(shapeIds);
    setNodes(prev => prev.map(n => ({ ...n, selected: ids.includes(n.id) })));
  }, [groups]);

  /** Set an explicit multi-selection (marquee). Expands to full group membership. */
  const selectNodes = useCallback((nodeIds: string[]) => {
    const expanded = new Set<string>();
    nodeIds.forEach(id => groupMemberIds(groups, id).forEach(m => expanded.add(m)));
    const ids = Array.from(expanded);
    setSelectedNodeId(ids.length > 0 ? ids[0] : null);
    setSelectedNodeIds(ids);
    setNodes(prev => prev.map(n => ({ ...n, selected: ids.includes(n.id) })));
  }, [groups]);

  /** Create a group around the given nodes AND shapes (≥2 members total).
   *  Returns the new group id. */
  const groupSelection = useCallback((nodeIds: string[], shapeIds: string[]): string | null => {
    const nodes = Array.from(new Set(nodeIds));
    const shapes = Array.from(new Set(shapeIds));
    if (nodes.length + shapes.length < 2) return null;
    const id = uuidv4();
    const group: NodeGroup = {
      id,
      name: nextGroupName(groups),
      nodeIds: nodes,
      shapeIds: shapes.length > 0 ? shapes : undefined,
    };
    setGroups(prev => [...prev, group]);
    return id;
  }, [groups]);

  /** Delete every group containing any of the given nodes or shapes. */
  const ungroupSelection = useCallback((nodeIds: string[], shapeIds: string[]) => {
    if (nodeIds.length === 0 && shapeIds.length === 0) return;
    setGroups(prev => removeGroupsContaining(prev, nodeIds, shapeIds));
  }, []);

  /** Move several nodes (and shapes, for mixed groups) by a delta. */
  const moveNodesBy = useCallback((memberIds: string[], dx: number, dy: number, shapeIds: string[] = []) => {
    if ((memberIds.length === 0 && shapeIds.length === 0) || (dx === 0 && dy === 0)) return;
    if (memberIds.length > 0) {
      const idSet = new Set(memberIds);
      setNodes(prev => prev.map(n => idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
    }
    if (shapeIds.length > 0) {
      const shapeSet = new Set(shapeIds);
      setShapes(prev => prev.map(s => shapeSet.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s));
    }
  }, []);

  /** Per-item draw order for a node (front layer toggle). */
  const setNodeFront = useCallback((nodeId: string, front: boolean) => {
    setNodes(prev => prev.map(n => (n.id === nodeId ? { ...n, front } : n)));
  }, []);

  /** Delete several nodes at once (single undo step), pruning groups. */
  const deleteNodes = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    saveUndoState();
    const idSet = new Set(nodeIds);
    setConnections(prev => prev.filter(c => !idSet.has(c.fromNodeId) && !idSet.has(c.toNodeId)));
    setNodes(prev => prev.filter(n => !idSet.has(n.id)));
    setGroups(prev => pruneGroups(prev, nodeIds));
    setSelectedNodeIds(prev => prev.filter(id => !idSet.has(id)));
    if (selectedNodeId && idSet.has(selectedNodeId)) setSelectedNodeId(null);
  }, [saveUndoState, selectedNodeId]);

  /* ── Shapes feature operations (additive) ──
     Shapes are selection-mutually-exclusive with nodes: selecting a shape
     clears the node selection and vice versa. */

  const selectShape = useCallback((shapeId: string | null) => {
    if (shapeId === null) {
      setSelectedShapeId(null);
      setSelectedShapeIds([]);
      return;
    }
    // A grouped shape selects its whole group (nodes + shapes), mirroring how
    // selecting a grouped node works. Ungrouped shapes stay single-selection.
    const g = getGroupOfShape(groups, shapeId);
    const nodeIds = g ? [...g.nodeIds] : [];
    const shapeIds = g ? [...(g.shapeIds ?? [shapeId])] : [shapeId];
    setSelectedShapeId(shapeId);
    setSelectedShapeIds(shapeIds);
    // Mutually exclusive with the node selection (existing convention).
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setNodes(prev =>
      nodeIds.length > 0
        ? prev.map(n => ({ ...n, selected: nodeIds.includes(n.id) }))
        : prev.some(n => n.selected) ? prev.map(n => ({ ...n, selected: false })) : prev,
    );
  }, [groups]);

  /** Set the exact shape selection (marquee).
   *  clearNodes=false keeps the node selection untouched (combined selection). */
  const setShapeSelection = useCallback((shapeIds: string[], clearNodes: boolean, primaryId?: string) => {
    setSelectedShapeIds(shapeIds);
    setSelectedShapeId(primaryId ?? shapeIds[0] ?? null);
    if (clearNodes) {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setNodes(prev => prev.some(n => n.selected) ? prev.map(n => ({ ...n, selected: false })) : prev);
    }
  }, []);

  const addShape = useCallback((type: ShapeType, x: number, y: number) => {
    const shape = createShape(type, x, y, uuidv4());
    if (!shape) return;
    saveUndoState();
    setShapes(prev => [...prev, shape]);
    selectShape(shape.id);
  }, [saveUndoState, selectShape]);

  const moveShape = useCallback((shapeId: string, x: number, y: number) => {
    setShapes(prev => prev.map(s => (s.id === shapeId ? { ...s, x, y } : s)));
  }, []);

  const updateShape = useCallback((shapeId: string, patch: Partial<CanvasShape>) => {
    setShapes(prev => prev.map(s => (s.id === shapeId ? { ...s, ...patch } : s)));
  }, []);

  const toggleShapeFrozen = useCallback((shapeId: string) => {
    setShapes(prev => prev.map(s => (s.id === shapeId ? { ...s, frozen: !s.frozen } : s)));
  }, []);

  const deleteShape = useCallback((shapeId: string) => {
    saveUndoState();
    setShapes(prev => prev.filter(s => s.id !== shapeId));
    // Groups consistency: never keep references to deleted shapes.
    setGroups(prev => pruneGroups(prev, [], [shapeId]));
    setSelectedShapeId(prev => (prev === shapeId ? null : prev));
    setSelectedShapeIds(prev => prev.filter(id => id !== shapeId));
  }, [saveUndoState]);

  const duplicateNode = useCallback((nodeId: string) => {
    const orig = nodes.find(n => n.id === nodeId);
    if (!orig) return;
    addNode(orig.type, orig.x + 30, orig.y + 30);
  }, [nodes, addNode]);

  // Update an existing node's definition IN PLACE (same node id, position, size
  // and state). Ports are rebuilt from the new definition, but each existing
  // port keeps its id and current value whenever a port with the same name
  // still exists — so connections survive the update. Only connections that
  // reference a port which no longer exists are removed.
  const replaceNodeType = useCallback((nodeId: string, newType: string) => {
    const def = getNodeDefinition(newType);
    if (!def) return;
    const old = nodes.find(n => n.id === nodeId);
    if (!old) return;

    const usedInIds = new Set(old.inputs.map(p => p.id));
    const inputs = def.inputs.map((p, i) => {
      const match = old.inputs.find(op => op.name === p.name);
      if (match) {
        return { ...p, id: match.id, connected: false, value: match.value };
      }
      let id = `${old.id}-in-${i}`;
      let k = 1;
      while (usedInIds.has(id)) { id = `${old.id}-in-${i}-${k++}`; }
      usedInIds.add(id);
      return { ...p, id, connected: false, value: p.value };
    });

    const usedOutIds = new Set(old.outputs.map(p => p.id));
    const outputs = def.outputs.map((p, i) => {
      const match = old.outputs.find(op => op.name === p.name);
      if (match) {
        return { ...p, id: match.id, connected: false };
      }
      let id = `${old.id}-out-${i}`;
      let k = 1;
      while (usedOutIds.has(id)) { id = `${old.id}-out-${i}-${k++}`; }
      usedOutIds.add(id);
      return { ...p, id, connected: false };
    });

    // Drop only connections whose referenced port no longer exists on this node.
    const inputIds = new Set(inputs.map(p => p.id));
    const outputIds = new Set(outputs.map(p => p.id));
    const remainingConnections = connections.filter(c => {
      if (c.fromNodeId === nodeId) return outputIds.has(c.fromPortId);
      if (c.toNodeId === nodeId) return inputIds.has(c.toPortId);
      return true;
    });
    setConnections(remainingConnections);

    setNodes(prev => {
      const updated = prev.map(n => n.id === nodeId ? {
        ...n,
        type: newType,
        inputs,
        outputs,
        label: def.label,
        category: def.category,
        color: CATEGORY_COLORS[def.category] || '#666',
        height: HEADER_HEIGHT + Math.max(inputs.length, outputs.length) * PORT_HEIGHT + 12,
        computed: false,
        error: undefined,
      } : n);
      return computeAllNodes(updated, remainingConnections);
    });
  }, [nodes, connections]);

  const clearAll = useCallback(() => {
    saveUndoState();
    setNodes([]);
    setConnections([]);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setGroups([]);
    setShapes([]);
    setSelectedShapeId(null);
    setSelectedShapeIds([]);
  }, [saveUndoState]);

  const saveProject = useCallback(() => {
    const project = {
      name: 'Untitled Project',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      canvas: { nodes, connections, zoom, panX, panY },
      theme,
      groups,
      shapes,
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.snd.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, connections, zoom, panX, panY, theme, groups, shapes]);

  const loadProject = useCallback((json: string) => {
    try {
      const project = JSON.parse(json);
      setNodes(project.canvas.nodes || []);
      setConnections(project.canvas.connections || []);
      setZoom(project.canvas.zoom || 1);
      setPanX(project.canvas.panX || 0);
      setPanY(project.canvas.panY || 0);
      if (project.theme) setTheme(project.theme);
      // Groups persist as a top-level, optional field (old files simply lack it).
      setGroups(Array.isArray(project.groups) ? project.groups : []);
      // Shapes persist the same way (validated; old files simply lack them).
      // Migration: files saved with the old GLOBAL "shapes on top" switch keep
      // the same look — every loaded shape is marked as front-layer.
      const loadedShapes = sanitizeShapes(project.shapes);
      setShapes(project.shapesOnTop ? loadedShapes.map(s => ({ ...s, front: true })) : loadedShapes);
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedShapeId(null);
      setSelectedShapeIds([]);
    } catch (e) {
      console.error('Failed to load project', e);
    }
  }, []);

  const recompute = useCallback(() => {
    setNodes(prev => computeAllNodes(prev, connections));
  }, [connections]);

  const searchNodes = useCallback((query: string) => {
    const allNodes = getAllNodes();
    if (!query) return allNodes;
    const q = query.toLowerCase();
    return allNodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q)
    );
  }, []);

  const generateReport = useCallback(() => {
    let report = '# Structural Node Designer - Calculation Report\n\n';
    report += `**Date:** ${new Date().toLocaleString()}\n\n`;
    report += `**Nodes:** ${nodes.length} | **Connections:** ${connections.length}\n\n`;
    report += '---\n\n';

    const sortedNodes = computeAllNodes(nodes, connections);
    for (const node of sortedNodes) {
      report += `## ${node.label} (${node.category})\n\n`;
      if (node.inputs.length > 0) {
        report += '**Inputs:**\n\n';
        for (const p of node.inputs) {
          report += `- ${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''}\n`;
        }
        report += '\n';
      }
      if (node.outputs.length > 0) {
        report += '**Outputs:**\n\n';
        for (const p of node.outputs) {
          report += `- ${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''}\n`;
        }
        report += '\n';
      }
      report += '---\n\n';
    }

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calculation-report.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, connections]);

  return {
    nodes,
    connections,
    zoom,
    panX,
    panY,
    connecting,
    selectedNodeId,
    selectedNodeIds,
    groups,
    /* ── Shapes feature (additive) ── */
    shapes,
    selectedShapeId,
    selectedShapeIds,
    selectShape,
    setShapeSelection,
    addShape,
    moveShape,
    updateShape,
    toggleShapeFrozen,
    deleteShape,
    setNodeFront,
    theme,
    searchQuery,
    setZoom,
    setPanX,
    setPanY,
    setTheme,
    setSearchQuery,
    addNode,
    deleteNode,
    deleteNodes,
    moveNode,
    moveNodesBy,
    selectNodes,
    groupSelection,
    ungroupSelection,
    updateNodeInput,
    addConnection,
    removeConnection,
    updateConnectionColor,
    startConnecting,
    updateConnecting,
    finishConnecting,
    selectNode,
    duplicateNode,
    replaceNodeType,
    clearAll,
    saveProject,
    loadProject,
    undo,
    redo,
    recompute,
    searchNodes,
    generateReport,
    setNodes,
  };
}
