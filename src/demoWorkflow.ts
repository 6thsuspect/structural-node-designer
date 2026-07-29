import { v4 as uuidv4 } from 'uuid';
import { CanvasNode, Connection } from './types';
import { getNodeDefinition, CATEGORY_COLORS } from './nodeDefinitions';
import { computeAllNodes } from './engine';

const PORT_HEIGHT = 28;
const HEADER_HEIGHT = 36;
const NODE_WIDTH = 200;

function makeNode(type: string, x: number, y: number, inputOverrides?: Record<string, any>): CanvasNode | null {
  const def = getNodeDefinition(type);
  if (!def) return null;

  const id = uuidv4();
  const inputs = def.inputs.map((p, i) => ({
    ...p,
    id: `${id}-in-${i}`,
    connected: false,
    value: inputOverrides?.[p.name] ?? p.value,
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

export function createDemoWorkflow(): { nodes: CanvasNode[]; connections: Connection[] } {
  // Steel beam design workflow
  const steelMat = makeNode('steel_material', 50, 50, { Grade: 'Fe250' });
  const iSection = makeNode('i_section', 50, 250, { D: 500, B: 200, tw: 10, tf: 16 });
  const loadInput = makeNode('load_input', 50, 550, { Load: 150 });
  const momentInput = makeNode('moment_input', 50, 700, { Moment: 200 });
  const lengthInput = makeNode('length_input', 50, 850, { Length: 6000 });

  const plasticMoment = makeNode('plastic_moment', 350, 200, { 'γm0': 1.1 });
  const shearCap = makeNode('shear_capacity', 350, 450, { 'γm0': 1.1 });
  const slenderness = makeNode('slenderness', 350, 700);

  const momentCheck = makeNode('compare_check', 650, 200);
  const shearCheck = makeNode('compare_check', 650, 450);

  const display1 = makeNode('display', 950, 200, { Label: 'Moment Check', Unit: '' });
  const display2 = makeNode('display', 950, 450, { Label: 'Shear Check', Unit: '' });
  const display3 = makeNode('display', 950, 700, { Label: 'Slenderness', Unit: '' });

  const allNodes = [steelMat, iSection, loadInput, momentInput, lengthInput, plasticMoment, shearCap, slenderness, momentCheck, shearCheck, display1, display2, display3].filter(Boolean) as CanvasNode[];

  if (allNodes.length < 13) return { nodes: [], connections: [] };

  const connections: Connection[] = [];

  const connect = (fromIdx: number, fromPort: number, toIdx: number, toPort: number) => {
    connections.push({
      id: uuidv4(),
      fromNodeId: allNodes[fromIdx].id,
      fromPortId: allNodes[fromIdx].outputs[fromPort].id,
      toNodeId: allNodes[toIdx].id,
      toPortId: allNodes[toIdx].inputs[toPort].id,
    });
  };

  // Steel Material Fy → Plastic Moment Fy
  connect(0, 0, 5, 0); // Fy
  // I-Section Zpx → Plastic Moment Zp
  connect(1, 3, 5, 1); // Zpx → Zp
  // Steel Material Fy → Shear Capacity Fy
  connect(0, 0, 6, 0); // Fy
  // I-Section D → Shear Capacity D
  // We can't connect D directly since i_section outputs Area, Ix, Zx, Zpx
  // So we use direct input values for shear capacity

  // Moment Input → Moment Check Demand
  connect(3, 0, 8, 0); // M → Demand
  // Plastic Moment Md → Moment Check Capacity
  connect(5, 1, 8, 1); // Md → Capacity

  // Load Input → Shear Check Demand
  connect(2, 0, 9, 0); // P → Demand
  // Shear Capacity Vd → Shear Check Capacity
  connect(6, 1, 9, 1); // Vd → Capacity

  // Moment Check Ratio → Display 1
  connect(8, 1, 10, 0); // Ratio → Value
  // Shear Check Ratio → Display 2
  connect(9, 1, 11, 0); // Ratio → Value

  // I-Section Area + Length → Slenderness (approximate using radius of gyration)
  // Length Input → Slenderness L
  connect(4, 0, 7, 0); // L → L

  // Slenderness λ → Display 3
  connect(7, 0, 12, 0); // λ → Value

  const computed = computeAllNodes(allNodes, connections);
  return { nodes: computed, connections };
}
