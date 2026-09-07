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
  /** Draw order (shapes feature): true = render in front of wires and default items. */
  front?: boolean;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  /** Custom wire color (CSS color). Absent = theme default wire color. */
  color?: string;
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
  /** Shapes feature: present on every new undo entry (old files lack it). */
  shapes?: CanvasShape[];
}

/** A named set of node ids that move together (canvas grouping feature).
 *  `shapeIds` (shapes feature) extends a group with canvas shapes. */
export interface NodeGroup {
  id: string;
  name: string;
  nodeIds: string[];
  /** Shapes that belong to this group (mixed node+shape groups). */
  shapeIds?: string[];
}

/* ── Shapes feature (additive) ── */

/** Shape types available in the Toolbox "Shapes" tab. */
export type ShapeType = 'rectangle' | 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'text';

/** A freeform drawing shape on the canvas (independent of calculation nodes). */
export interface CanvasShape {
  id: string;
  type: ShapeType;
  /** Top-left of the bounding box, in canvas coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Frozen = the shape's SIZE is locked (resize handles/inputs disabled; moving is still allowed). */
  frozen: boolean;
  /** Fill color (hex). Defaults to DEFAULT_SHAPE_COLOR. */
  color?: string;
  /** Fill opacity 0–1. Defaults to DEFAULT_SHAPE_FILL_OPACITY. */
  fillOpacity?: number;
  /** Draw order: true = render in front of wires and default items. */
  front?: boolean;
  /* ── Text annotations (only meaningful for type 'text') ── */
  /** Text content. */
  text?: string;
  /** Font size in canvas units. Defaults to DEFAULT_TEXT_FONT_SIZE. */
  fontSize?: number;
  /** Font color (hex). Falls back to the theme text color at render time. */
  fontColor?: string;
  /** Font family CSS stack. Falls back to the system stack. */
  fontFamily?: string;
  /** Bold toggle. */
  fontWeight?: 'normal' | 'bold';
  /** Italic toggle. */
  fontStyle?: 'normal' | 'italic';
  /** Underline toggle. */
  underline?: boolean;
  /** Horizontal text alignment inside the box. */
  textAlign?: 'left' | 'center' | 'right';
}
