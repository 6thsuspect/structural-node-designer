export type PortType = 'number' | 'string' | 'boolean' | 'any';

export interface Port {
  id: string;
  name: string;
  type: PortType;
  value?: any;
  connected?: boolean;
  unit?: string;
}

export interface NodeDefinition {
  type: string;
  category: string;
  subcategory?: string;
  label: string;
  description?: string;
  inputs: Omit<Port, 'id' | 'connected'>[];
  outputs: Omit<Port, 'id' | 'connected'>[];
  compute: (inputs: Record<string, any>) => Record<string, any>;
  color?: string;
  icon?: string;
}

export interface CanvasNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputs: Port[];
  outputs: Port[];
  label: string;
  category: string;
  color: string;
  collapsed: boolean;
  selected: boolean;
  computed: boolean;
  error?: string;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface CanvasState {
  nodes: CanvasNode[];
  connections: Connection[];
  zoom: number;
  panX: number;
  panY: number;
}

export type Theme = 'dark' | 'light' | 'grasshopper' | 'autocad';

export interface ProjectFile {
  name: string;
  version: string;
  created: string;
  modified: string;
  canvas: CanvasState;
  theme: Theme;
}

export type CategoryColor = Record<string, string>;

export interface DragState {
  isDragging: boolean;
  nodeId?: string;
  offsetX: number;
  offsetY: number;
}

export interface ConnectingState {
  isConnecting: boolean;
  fromNodeId?: string;
  fromPortId?: string;
  fromIsOutput?: boolean;
  mouseX: number;
  mouseY: number;
}

export interface SelectionBox {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface UndoAction {
  nodes: CanvasNode[];
  connections: Connection[];
}
