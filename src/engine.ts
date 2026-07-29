import { CanvasNode, Connection } from './types';
import { getNodeDefinition } from './nodeDefinitions';

export function topologicalSort(nodes: CanvasNode[], connections: Connection[]): string[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  connections.forEach(c => {
    if (adj[c.fromNodeId]) {
      adj[c.fromNodeId].push(c.toNodeId);
    }
    if (inDegree[c.toNodeId] !== undefined) {
      inDegree[c.toNodeId]++;
    }
  });

  const queue: string[] = [];
  for (const id in inDegree) {
    if (inDegree[id] === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const neighbor of (adj[id] || [])) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== nodes.length) {
    // Circular reference detected - return what we have
    const remaining = nodes.filter(n => !sorted.includes(n.id)).map(n => n.id);
    return [...sorted, ...remaining];
  }

  return sorted;
}

export function detectCircularReferences(nodes: CanvasNode[], connections: Connection[]): boolean {
  const sorted = topologicalSort(nodes, connections);
  return sorted.length !== nodes.length;
}

export function computeAllNodes(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
  const order = topologicalSort(nodes, connections);
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, inputs: n.inputs.map(p => ({ ...p })), outputs: n.outputs.map(p => ({ ...p })) }]));

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Propagate values from connected output ports
    const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
    for (const conn of incomingConnections) {
      const sourceNode = nodeMap.get(conn.fromNodeId);
      if (!sourceNode) continue;
      const sourcePort = sourceNode.outputs.find(p => p.id === conn.fromPortId);
      const targetPort = node.inputs.find(p => p.id === conn.toPortId);
      if (sourcePort && targetPort) {
        targetPort.value = sourcePort.value;
        targetPort.connected = true;
      }
    }

    // Compute the node
    const def = getNodeDefinition(node.type);
    if (def) {
      try {
        const inputValues: Record<string, any> = {};
        node.inputs.forEach(p => {
          inputValues[p.name] = p.value;
        });
        const results = def.compute(inputValues);
        node.outputs.forEach(p => {
          if (results[p.name] !== undefined) {
            p.value = results[p.name];
          }
        });
        node.computed = true;
        node.error = undefined;
      } catch (e: any) {
        node.error = e.message || 'Computation error';
        node.computed = false;
      }
    }
  }

  return Array.from(nodeMap.values());
}
