import { NodeDefinition } from './types';

export const CATEGORY_COLORS: Record<string, string> = {
  'Inputs': '#4CAF50',
  'Outputs': '#FF9800',
  'Math': '#2196F3',
  'Logic': '#9C27B0',
  'Excel': '#217346',
  'Structural': '#F44336',
  'Steel': '#607D8B',
  'RCC': '#795548',
  'Bridge': '#E91E63',
  'Loads': '#FF5722',
  'Materials': '#009688',
  'Section': '#3F51B5',
  'Custom': '#00BCD4',
};

export const CATEGORY_ICONS: Record<string, string> = {
  'Inputs': '📥',
  'Outputs': '📤',
  'Math': '🔢',
  'Logic': '🔀',
  'Excel': '📊',
  'Structural': '🏗️',
  'Steel': '⚙️',
  'RCC': '🧱',
  'Bridge': '🌉',
  'Loads': '⚡',
  'Materials': '🧪',
  'Section': '📐',
  'Custom': '✏️',
};

export const nodeDefinitions: NodeDefinition[] = [
  // ============ INPUT NODES ============
  {
    type: 'number_input',
    category: 'Inputs',
    label: 'Number',
    description: 'A numeric input value',
    inputs: [{ name: 'Value', type: 'number', value: 0, unit: '' }],
    outputs: [{ name: 'Out', type: 'number' }],
    compute: (inputs) => ({ Out: Number(inputs.Value) || 0 }),
    icon: '🔢',
  },
  {
    type: 'width_input',
    category: 'Inputs',
    label: 'Width',
    description: 'Width dimension input',
    inputs: [{ name: 'Width', type: 'number', value: 300, unit: 'mm' }],
    outputs: [{ name: 'W', type: 'number' }],
    compute: (inputs) => ({ W: Number(inputs.Width) || 0 }),
    icon: '↔️',
  },
  {
    type: 'depth_input',
    category: 'Inputs',
    label: 'Depth',
    description: 'Depth dimension input',
    inputs: [{ name: 'Depth', type: 'number', value: 500, unit: 'mm' }],
    outputs: [{ name: 'D', type: 'number' }],
    compute: (inputs) => ({ D: Number(inputs.Depth) || 0 }),
    icon: '↕️',
  },
  {
    type: 'thickness_input',
    category: 'Inputs',
    label: 'Thickness',
    description: 'Thickness input',
    inputs: [{ name: 'Thickness', type: 'number', value: 10, unit: 'mm' }],
    outputs: [{ name: 't', type: 'number' }],
    compute: (inputs) => ({ t: Number(inputs.Thickness) || 0 }),
    icon: '📏',
  },
  {
    type: 'length_input',
    category: 'Inputs',
    label: 'Length',
    description: 'Length input',
    inputs: [{ name: 'Length', type: 'number', value: 6000, unit: 'mm' }],
    outputs: [{ name: 'L', type: 'number' }],
    compute: (inputs) => ({ L: Number(inputs.Length) || 0 }),
    icon: '📐',
  },
  {
    type: 'fy_input',
    category: 'Inputs',
    label: 'Yield Strength (Fy)',
    description: 'Yield strength of steel',
    inputs: [{ name: 'Fy', type: 'number', value: 250, unit: 'MPa' }],
    outputs: [{ name: 'Fy', type: 'number' }],
    compute: (inputs) => ({ Fy: Number(inputs.Fy) || 0 }),
    icon: '💪',
  },
  {
    type: 'fu_input',
    category: 'Inputs',
    label: 'Ultimate Strength (Fu)',
    description: 'Ultimate tensile strength',
    inputs: [{ name: 'Fu', type: 'number', value: 410, unit: 'MPa' }],
    outputs: [{ name: 'Fu', type: 'number' }],
    compute: (inputs) => ({ Fu: Number(inputs.Fu) || 0 }),
    icon: '🔩',
  },
  {
    type: 'load_input',
    category: 'Inputs',
    label: 'Load',
    description: 'Applied load',
    inputs: [{ name: 'Load', type: 'number', value: 100, unit: 'kN' }],
    outputs: [{ name: 'P', type: 'number' }],
    compute: (inputs) => ({ P: Number(inputs.Load) || 0 }),
    icon: '⬇️',
  },
  {
    type: 'moment_input',
    category: 'Inputs',
    label: 'Moment',
    description: 'Applied moment',
    inputs: [{ name: 'Moment', type: 'number', value: 50, unit: 'kNm' }],
    outputs: [{ name: 'M', type: 'number' }],
    compute: (inputs) => ({ M: Number(inputs.Moment) || 0 }),
    icon: '🔄',
  },
  {
    type: 'shear_input',
    category: 'Inputs',
    label: 'Shear Force',
    description: 'Applied shear force',
    inputs: [{ name: 'Shear', type: 'number', value: 75, unit: 'kN' }],
    outputs: [{ name: 'V', type: 'number' }],
    compute: (inputs) => ({ V: Number(inputs.Shear) || 0 }),
    icon: '↗️',
  },
  {
    type: 'elastic_modulus_input',
    category: 'Inputs',
    label: 'Elastic Modulus (E)',
    description: "Young's Modulus",
    inputs: [{ name: 'E', type: 'number', value: 200000, unit: 'MPa' }],
    outputs: [{ name: 'E', type: 'number' }],
    compute: (inputs) => ({ E: Number(inputs.E) || 0 }),
    icon: '📈',
  },
  {
    type: 'concrete_grade_input',
    category: 'Inputs',
    label: 'Concrete Grade',
    description: 'Characteristic strength of concrete',
    inputs: [{ name: 'fck', type: 'number', value: 30, unit: 'MPa' }],
    outputs: [{ name: 'fck', type: 'number' }],
    compute: (inputs) => ({ fck: Number(inputs.fck) || 0 }),
    icon: '🧱',
  },
  {
    type: 'bolt_dia_input',
    category: 'Inputs',
    label: 'Bolt Diameter',
    description: 'Bolt diameter input',
    inputs: [{ name: 'Dia', type: 'number', value: 20, unit: 'mm' }],
    outputs: [{ name: 'd', type: 'number' }],
    compute: (inputs) => ({ d: Number(inputs.Dia) || 0 }),
    icon: '🔩',
  },

  // ============ MATH NODES ============
  {
    type: 'add',
    category: 'Math',
    label: 'Add',
    description: 'Addition: A + B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: (Number(inputs.A) || 0) + (Number(inputs.B) || 0) }),
    icon: '➕',
  },
  {
    type: 'subtract',
    category: 'Math',
    label: 'Subtract',
    description: 'Subtraction: A - B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: (Number(inputs.A) || 0) - (Number(inputs.B) || 0) }),
    icon: '➖',
  },
  {
    type: 'multiply',
    category: 'Math',
    label: 'Multiply',
    description: 'Multiplication: A × B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: (Number(inputs.A) || 0) * (Number(inputs.B) || 0) }),
    icon: '✖️',
  },
  {
    type: 'divide',
    category: 'Math',
    label: 'Divide',
    description: 'Division: A / B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 1 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => {
      const b = Number(inputs.B) || 0;
      return { Result: b !== 0 ? (Number(inputs.A) || 0) / b : 0 };
    },
    icon: '➗',
  },
  {
    type: 'power',
    category: 'Math',
    label: 'Power',
    description: 'Power: A^B',
    inputs: [
      { name: 'Base', type: 'number', value: 0 },
      { name: 'Exp', type: 'number', value: 2 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.pow(Number(inputs.Base) || 0, Number(inputs.Exp) || 0) }),
    icon: 'xⁿ',
  },
  {
    type: 'sqrt',
    category: 'Math',
    label: 'Square Root',
    description: '√A',
    inputs: [{ name: 'A', type: 'number', value: 0 }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.sqrt(Math.abs(Number(inputs.A) || 0)) }),
    icon: '√',
  },
  {
    type: 'abs',
    category: 'Math',
    label: 'Absolute',
    description: '|A|',
    inputs: [{ name: 'A', type: 'number', value: 0 }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.abs(Number(inputs.A) || 0) }),
    icon: '|x|',
  },
  {
    type: 'max',
    category: 'Math',
    label: 'Maximum',
    description: 'max(A, B)',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.max(Number(inputs.A) || 0, Number(inputs.B) || 0) }),
    icon: '📈',
  },
  {
    type: 'min',
    category: 'Math',
    label: 'Minimum',
    description: 'min(A, B)',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.min(Number(inputs.A) || 0, Number(inputs.B) || 0) }),
    icon: '📉',
  },
  {
    type: 'round',
    category: 'Math',
    label: 'Round',
    description: 'Round to N decimals',
    inputs: [
      { name: 'Value', type: 'number', value: 0 },
      { name: 'Decimals', type: 'number', value: 2 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => {
      const d = Math.pow(10, Number(inputs.Decimals) || 0);
      return { Result: Math.round((Number(inputs.Value) || 0) * d) / d };
    },
    icon: '🔄',
  },
  {
    type: 'sin',
    category: 'Math',
    label: 'Sine',
    description: 'sin(A) - angle in degrees',
    inputs: [{ name: 'Angle', type: 'number', value: 0, unit: 'deg' }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.sin((Number(inputs.Angle) || 0) * Math.PI / 180) }),
    icon: '∿',
  },
  {
    type: 'cos',
    category: 'Math',
    label: 'Cosine',
    description: 'cos(A) - angle in degrees',
    inputs: [{ name: 'Angle', type: 'number', value: 0, unit: 'deg' }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.cos((Number(inputs.Angle) || 0) * Math.PI / 180) }),
    icon: '∿',
  },
  {
    type: 'tan',
    category: 'Math',
    label: 'Tangent',
    description: 'tan(A) - angle in degrees',
    inputs: [{ name: 'Angle', type: 'number', value: 0, unit: 'deg' }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.tan((Number(inputs.Angle) || 0) * Math.PI / 180) }),
    icon: '∿',
  },
  {
    type: 'log',
    category: 'Math',
    label: 'Logarithm',
    description: 'Natural log ln(A)',
    inputs: [{ name: 'A', type: 'number', value: 1 }],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: Math.log(Math.abs(Number(inputs.A)) || 1) }),
    icon: 'log',
  },
  {
    type: 'average',
    category: 'Math',
    label: 'Average',
    description: '(A + B) / 2',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: ((Number(inputs.A) || 0) + (Number(inputs.B) || 0)) / 2 }),
    icon: 'x̄',
  },
  {
    type: 'pi',
    category: 'Math',
    label: 'Pi (π)',
    description: 'Mathematical constant π',
    inputs: [],
    outputs: [{ name: 'π', type: 'number' }],
    compute: () => ({ 'π': Math.PI }),
    icon: 'π',
  },

  // ============ LOGIC NODES ============
  {
    type: 'if_node',
    category: 'Logic',
    label: 'IF',
    description: 'If condition then A else B',
    inputs: [
      { name: 'Condition', type: 'boolean', value: true },
      { name: 'Then', type: 'number', value: 1 },
      { name: 'Else', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: inputs.Condition ? inputs.Then : inputs.Else }),
    icon: '❓',
  },
  {
    type: 'and_node',
    category: 'Logic',
    label: 'AND',
    description: 'Logical AND',
    inputs: [
      { name: 'A', type: 'boolean', value: false },
      { name: 'B', type: 'boolean', value: false },
    ],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: Boolean(inputs.A) && Boolean(inputs.B) }),
    icon: '∧',
  },
  {
    type: 'or_node',
    category: 'Logic',
    label: 'OR',
    description: 'Logical OR',
    inputs: [
      { name: 'A', type: 'boolean', value: false },
      { name: 'B', type: 'boolean', value: false },
    ],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: Boolean(inputs.A) || Boolean(inputs.B) }),
    icon: '∨',
  },
  {
    type: 'not_node',
    category: 'Logic',
    label: 'NOT',
    description: 'Logical NOT',
    inputs: [{ name: 'A', type: 'boolean', value: false }],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: !Boolean(inputs.A) }),
    icon: '¬',
  },
  {
    type: 'greater',
    category: 'Logic',
    label: 'Greater Than',
    description: 'A > B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: (Number(inputs.A) || 0) > (Number(inputs.B) || 0) }),
    icon: '>',
  },
  {
    type: 'less',
    category: 'Logic',
    label: 'Less Than',
    description: 'A < B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: (Number(inputs.A) || 0) < (Number(inputs.B) || 0) }),
    icon: '<',
  },
  {
    type: 'equal',
    category: 'Logic',
    label: 'Equal',
    description: 'A == B',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'boolean' }],
    compute: (inputs) => ({ Result: Number(inputs.A) === Number(inputs.B) }),
    icon: '=',
  },
  {
    type: 'compare_check',
    category: 'Logic',
    label: 'Design Check',
    description: 'Check if Demand ≤ Capacity',
    inputs: [
      { name: 'Demand', type: 'number', value: 0 },
      { name: 'Capacity', type: 'number', value: 0 },
    ],
    outputs: [
      { name: 'Pass', type: 'boolean' },
      { name: 'Ratio', type: 'number' },
      { name: 'Status', type: 'string' },
    ],
    compute: (inputs) => {
      const d = Number(inputs.Demand) || 0;
      const c = Number(inputs.Capacity) || 0;
      const ratio = c !== 0 ? d / c : 999;
      return { Pass: ratio <= 1, Ratio: Math.round(ratio * 1000) / 1000, Status: ratio <= 1 ? 'PASS ✓' : 'FAIL ✗' };
    },
    icon: '✅',
  },

  // ============ SECTION PROPERTIES ============
  {
    type: 'rect_area',
    category: 'Section',
    label: 'Rectangle Area',
    description: 'A = B × D',
    inputs: [
      { name: 'B', type: 'number', value: 300, unit: 'mm' },
      { name: 'D', type: 'number', value: 500, unit: 'mm' },
    ],
    outputs: [{ name: 'Area', type: 'number' }],
    compute: (inputs) => ({ Area: (Number(inputs.B) || 0) * (Number(inputs.D) || 0) }),
    icon: '▬',
  },
  {
    type: 'rect_moi',
    category: 'Section',
    label: 'Rectangle Ix',
    description: 'Ix = BD³/12',
    inputs: [
      { name: 'B', type: 'number', value: 300, unit: 'mm' },
      { name: 'D', type: 'number', value: 500, unit: 'mm' },
    ],
    outputs: [
      { name: 'Ix', type: 'number' },
      { name: 'Zx', type: 'number' },
    ],
    compute: (inputs) => {
      const b = Number(inputs.B) || 0;
      const d = Number(inputs.D) || 0;
      const ix = (b * Math.pow(d, 3)) / 12;
      const zx = d !== 0 ? ix / (d / 2) : 0;
      return { Ix: ix, Zx: zx };
    },
    icon: '📐',
  },
  {
    type: 'circle_area',
    category: 'Section',
    label: 'Circle Area',
    description: 'A = πD²/4',
    inputs: [{ name: 'D', type: 'number', value: 300, unit: 'mm' }],
    outputs: [
      { name: 'Area', type: 'number' },
      { name: 'Ix', type: 'number' },
    ],
    compute: (inputs) => {
      const d = Number(inputs.D) || 0;
      return {
        Area: (Math.PI * d * d) / 4,
        Ix: (Math.PI * Math.pow(d, 4)) / 64,
      };
    },
    icon: '⭕',
  },
  {
    type: 'i_section',
    category: 'Section',
    label: 'I-Section Props',
    description: 'Properties of I-Section',
    inputs: [
      { name: 'D', type: 'number', value: 500, unit: 'mm' },
      { name: 'B', type: 'number', value: 200, unit: 'mm' },
      { name: 'tw', type: 'number', value: 10, unit: 'mm' },
      { name: 'tf', type: 'number', value: 16, unit: 'mm' },
    ],
    outputs: [
      { name: 'Area', type: 'number' },
      { name: 'Ix', type: 'number' },
      { name: 'Zx', type: 'number' },
      { name: 'Zpx', type: 'number' },
    ],
    compute: (inputs) => {
      const D = Number(inputs.D) || 0;
      const B = Number(inputs.B) || 0;
      const tw = Number(inputs.tw) || 0;
      const tf = Number(inputs.tf) || 0;
      const dw = D - 2 * tf;
      const area = 2 * B * tf + dw * tw;
      const ix = (B * Math.pow(D, 3) / 12) - ((B - tw) * Math.pow(dw, 3) / 12);
      const zx = D !== 0 ? ix / (D / 2) : 0;
      const zpx = B * tf * (D - tf) + tw * dw * dw / 4;
      return { Area: Math.round(area), Ix: Math.round(ix), Zx: Math.round(zx), Zpx: Math.round(zpx) };
    },
    icon: '🏗️',
  },
  {
    type: 'radius_gyration',
    category: 'Section',
    label: 'Radius of Gyration',
    description: 'r = √(I/A)',
    inputs: [
      { name: 'I', type: 'number', value: 0, unit: 'mm⁴' },
      { name: 'A', type: 'number', value: 0, unit: 'mm²' },
    ],
    outputs: [{ name: 'r', type: 'number' }],
    compute: (inputs) => {
      const i = Number(inputs.I) || 0;
      const a = Number(inputs.A) || 0;
      return { r: a !== 0 ? Math.sqrt(i / a) : 0 };
    },
    icon: 'r',
  },

  // ============ STEEL DESIGN ============
  {
    type: 'plastic_moment',
    category: 'Steel',
    label: 'Plastic Moment',
    description: 'Mp = Fy × Zp (IS 800)',
    inputs: [
      { name: 'Fy', type: 'number', value: 250, unit: 'MPa' },
      { name: 'Zp', type: 'number', value: 0, unit: 'mm³' },
      { name: 'γm0', type: 'number', value: 1.1 },
    ],
    outputs: [
      { name: 'Mp', type: 'number' },
      { name: 'Md', type: 'number' },
    ],
    compute: (inputs) => {
      const fy = Number(inputs.Fy) || 0;
      const zp = Number(inputs.Zp) || 0;
      const gm = Number(inputs['γm0']) || 1.1;
      const mp = fy * zp;
      const md = mp / gm;
      return { Mp: Math.round(mp), Md: Math.round(md) };
    },
    icon: 'Mp',
  },
  {
    type: 'shear_capacity',
    category: 'Steel',
    label: 'Shear Capacity',
    description: 'Vd = Fy×Av/(√3×γm0) per IS 800',
    inputs: [
      { name: 'Fy', type: 'number', value: 250, unit: 'MPa' },
      { name: 'D', type: 'number', value: 500, unit: 'mm' },
      { name: 'tw', type: 'number', value: 10, unit: 'mm' },
      { name: 'γm0', type: 'number', value: 1.1 },
    ],
    outputs: [
      { name: 'Av', type: 'number' },
      { name: 'Vd', type: 'number' },
    ],
    compute: (inputs) => {
      const fy = Number(inputs.Fy) || 0;
      const d = Number(inputs.D) || 0;
      const tw = Number(inputs.tw) || 0;
      const gm = Number(inputs['γm0']) || 1.1;
      const av = d * tw;
      const vd = (fy * av) / (Math.sqrt(3) * gm);
      return { Av: Math.round(av), Vd: Math.round(vd) };
    },
    icon: '✂️',
  },
  {
    type: 'tension_capacity',
    category: 'Steel',
    label: 'Tension Capacity',
    description: 'Td = Fy×Ag/γm0 per IS 800',
    inputs: [
      { name: 'Fy', type: 'number', value: 250, unit: 'MPa' },
      { name: 'Ag', type: 'number', value: 0, unit: 'mm²' },
      { name: 'γm0', type: 'number', value: 1.1 },
    ],
    outputs: [{ name: 'Td', type: 'number' }],
    compute: (inputs) => {
      const fy = Number(inputs.Fy) || 0;
      const ag = Number(inputs.Ag) || 0;
      const gm = Number(inputs['γm0']) || 1.1;
      return { Td: Math.round((fy * ag) / gm) };
    },
    icon: '↕️',
  },
  {
    type: 'bolt_capacity',
    category: 'Steel',
    label: 'Bolt Shear Capacity',
    description: 'Bolt shear per IS 800',
    inputs: [
      { name: 'fu', type: 'number', value: 400, unit: 'MPa' },
      { name: 'Anb', type: 'number', value: 245, unit: 'mm²' },
      { name: 'nn', type: 'number', value: 1 },
      { name: 'γmb', type: 'number', value: 1.25 },
    ],
    outputs: [{ name: 'Vdsb', type: 'number' }],
    compute: (inputs) => {
      const fu = Number(inputs.fu) || 0;
      const anb = Number(inputs.Anb) || 0;
      const nn = Number(inputs.nn) || 1;
      const gmb = Number(inputs['γmb']) || 1.25;
      return { Vdsb: Math.round((fu * anb * nn) / (Math.sqrt(3) * gmb)) };
    },
    icon: '🔩',
  },
  {
    type: 'slenderness',
    category: 'Steel',
    label: 'Slenderness Ratio',
    description: 'λ = L/r',
    inputs: [
      { name: 'L', type: 'number', value: 6000, unit: 'mm' },
      { name: 'r', type: 'number', value: 50, unit: 'mm' },
    ],
    outputs: [
      { name: 'λ', type: 'number' },
      { name: 'Status', type: 'string' },
    ],
    compute: (inputs) => {
      const l = Number(inputs.L) || 0;
      const r = Number(inputs.r) || 1;
      const lambda = l / r;
      return { 'λ': Math.round(lambda * 10) / 10, Status: lambda <= 180 ? 'OK' : 'EXCEEDS 180' };
    },
    icon: 'λ',
  },
  {
    type: 'section_class',
    category: 'Steel',
    label: 'Section Classification',
    description: 'IS 800 Table 2',
    inputs: [
      { name: 'b/tf', type: 'number', value: 10 },
      { name: 'ε', type: 'number', value: 1 },
    ],
    outputs: [
      { name: 'Class', type: 'string' },
    ],
    compute: (inputs) => {
      const bt = Number(inputs['b/tf']) || 0;
      const eps = Number(inputs['ε']) || 1;
      if (bt <= 9.4 * eps) return { Class: 'Plastic (Class 1)' };
      if (bt <= 10.5 * eps) return { Class: 'Compact (Class 2)' };
      if (bt <= 15.7 * eps) return { Class: 'Semi-Compact (Class 3)' };
      return { Class: 'Slender (Class 4)' };
    },
    icon: '📋',
  },

  // ============ RCC NODES ============
  {
    type: 'rcc_flexure',
    category: 'RCC',
    label: 'RCC Flexural Capacity',
    description: 'Mu = 0.87fy·Ast·(d - 0.42xu)',
    inputs: [
      { name: 'fck', type: 'number', value: 30, unit: 'MPa' },
      { name: 'fy', type: 'number', value: 500, unit: 'MPa' },
      { name: 'b', type: 'number', value: 300, unit: 'mm' },
      { name: 'd', type: 'number', value: 450, unit: 'mm' },
      { name: 'Ast', type: 'number', value: 1200, unit: 'mm²' },
    ],
    outputs: [
      { name: 'xu', type: 'number' },
      { name: 'Mu', type: 'number' },
    ],
    compute: (inputs) => {
      const fck = Number(inputs.fck) || 0;
      const fy = Number(inputs.fy) || 0;
      const b = Number(inputs.b) || 0;
      const d = Number(inputs.d) || 0;
      const ast = Number(inputs.Ast) || 0;
      const xu = (0.87 * fy * ast) / (0.36 * fck * b);
      const mu = 0.87 * fy * ast * (d - 0.42 * xu);
      return { xu: Math.round(xu * 10) / 10, Mu: Math.round(mu / 1e6 * 100) / 100 };
    },
    icon: '🧱',
  },
  {
    type: 'rcc_shear',
    category: 'RCC',
    label: 'RCC Shear Check',
    description: 'Shear strength per IS 456',
    inputs: [
      { name: 'Vu', type: 'number', value: 100, unit: 'kN' },
      { name: 'b', type: 'number', value: 300, unit: 'mm' },
      { name: 'd', type: 'number', value: 450, unit: 'mm' },
      { name: 'τc', type: 'number', value: 0.48, unit: 'MPa' },
    ],
    outputs: [
      { name: 'τv', type: 'number' },
      { name: 'Status', type: 'string' },
    ],
    compute: (inputs) => {
      const vu = Number(inputs.Vu) || 0;
      const b = Number(inputs.b) || 0;
      const d = Number(inputs.d) || 0;
      const tc = Number(inputs['τc']) || 0;
      const tv = (b * d) !== 0 ? (vu * 1000) / (b * d) : 0;
      return { 'τv': Math.round(tv * 100) / 100, Status: tv <= tc ? 'SAFE' : 'PROVIDE STIRRUPS' };
    },
    icon: '✂️',
  },
  {
    type: 'development_length',
    category: 'RCC',
    label: 'Development Length',
    description: 'Ld = φσs/(4τbd)',
    inputs: [
      { name: 'φ', type: 'number', value: 16, unit: 'mm' },
      { name: 'σs', type: 'number', value: 435, unit: 'MPa' },
      { name: 'τbd', type: 'number', value: 1.5, unit: 'MPa' },
    ],
    outputs: [{ name: 'Ld', type: 'number' }],
    compute: (inputs) => {
      const phi = Number(inputs['φ']) || 0;
      const sigma = Number(inputs['σs']) || 0;
      const tau = Number(inputs['τbd']) || 1;
      return { Ld: Math.round((phi * sigma) / (4 * tau)) };
    },
    icon: '📏',
  },

  // ============ LOADS ============
  {
    type: 'load_combination',
    category: 'Loads',
    label: 'Load Combination',
    description: 'γDL × DL + γLL × LL',
    inputs: [
      { name: 'DL', type: 'number', value: 0, unit: 'kN' },
      { name: 'LL', type: 'number', value: 0, unit: 'kN' },
      { name: 'γDL', type: 'number', value: 1.5 },
      { name: 'γLL', type: 'number', value: 1.5 },
    ],
    outputs: [{ name: 'Pu', type: 'number' }],
    compute: (inputs) => {
      const dl = Number(inputs.DL) || 0;
      const ll = Number(inputs.LL) || 0;
      const gdl = Number(inputs['γDL']) || 0;
      const gll = Number(inputs['γLL']) || 0;
      return { Pu: dl * gdl + ll * gll };
    },
    icon: '⚡',
  },
  {
    type: 'self_weight',
    category: 'Loads',
    label: 'Self Weight',
    description: 'W = γ × A × L',
    inputs: [
      { name: 'γ', type: 'number', value: 78.5, unit: 'kN/m³' },
      { name: 'Area', type: 'number', value: 0, unit: 'mm²' },
      { name: 'Length', type: 'number', value: 0, unit: 'mm' },
    ],
    outputs: [{ name: 'W', type: 'number' }],
    compute: (inputs) => {
      const gamma = Number(inputs['γ']) || 0;
      const area = Number(inputs.Area) || 0;
      const length = Number(inputs.Length) || 0;
      return { W: Math.round(gamma * area * length * 1e-9 * 100) / 100 };
    },
    icon: '⚖️',
  },
  {
    type: 'wind_load',
    category: 'Loads',
    label: 'Wind Pressure',
    description: 'pz = 0.6Vz² per IS 875-3',
    inputs: [
      { name: 'Vb', type: 'number', value: 44, unit: 'm/s' },
      { name: 'k1', type: 'number', value: 1.0 },
      { name: 'k2', type: 'number', value: 1.0 },
      { name: 'k3', type: 'number', value: 1.0 },
    ],
    outputs: [
      { name: 'Vz', type: 'number' },
      { name: 'pz', type: 'number' },
    ],
    compute: (inputs) => {
      const vb = Number(inputs.Vb) || 0;
      const k1 = Number(inputs.k1) || 1;
      const k2 = Number(inputs.k2) || 1;
      const k3 = Number(inputs.k3) || 1;
      const vz = vb * k1 * k2 * k3;
      const pz = 0.6 * vz * vz;
      return { Vz: Math.round(vz * 10) / 10, pz: Math.round(pz) };
    },
    icon: '🌬️',
  },
  {
    type: 'seismic_base_shear',
    category: 'Loads',
    label: 'Seismic Base Shear',
    description: 'Vb = Ah × W per IS 1893',
    inputs: [
      { name: 'Z', type: 'number', value: 0.24 },
      { name: 'I', type: 'number', value: 1.5 },
      { name: 'R', type: 'number', value: 5 },
      { name: 'Sa/g', type: 'number', value: 2.5 },
      { name: 'W', type: 'number', value: 1000, unit: 'kN' },
    ],
    outputs: [
      { name: 'Ah', type: 'number' },
      { name: 'Vb', type: 'number' },
    ],
    compute: (inputs) => {
      const z = Number(inputs.Z) || 0;
      const i = Number(inputs.I) || 1;
      const r = Number(inputs.R) || 1;
      const sa = Number(inputs['Sa/g']) || 0;
      const w = Number(inputs.W) || 0;
      const ah = (z * i * sa) / (2 * r);
      return { Ah: Math.round(ah * 1000) / 1000, Vb: Math.round(ah * w * 10) / 10 };
    },
    icon: '🌊',
  },

  // ============ BRIDGE ============
  {
    type: 'impact_factor',
    category: 'Bridge',
    label: 'Impact Factor (IRC)',
    description: 'CDA for IRC Class A/70R',
    inputs: [
      { name: 'Span', type: 'number', value: 20, unit: 'm' },
      { name: 'Loading', type: 'string', value: 'ClassA' },
    ],
    outputs: [{ name: 'IF', type: 'number' }],
    compute: (inputs) => {
      const span = Number(inputs.Span) || 0;
      const loading = inputs.Loading;
      let impact: number;
      if (loading === '70R' || loading === 'ClassAA') {
        impact = span <= 9 ? 0.25 : (span > 9 && span <= 40 ? 0.25 : 0.1);
        if (span > 12) impact = 15.4 / (span + 38);
      } else {
        impact = span <= 3 ? 0.5 : 4.5 / (6 + span);
      }
      return { IF: Math.round(impact * 1000) / 1000 };
    },
    icon: '🌉',
  },

  // ============ MATERIALS ============
  {
    type: 'steel_material',
    category: 'Materials',
    label: 'Steel Properties',
    description: 'Standard steel material',
    inputs: [
      { name: 'Grade', type: 'string', value: 'Fe250' },
    ],
    outputs: [
      { name: 'Fy', type: 'number' },
      { name: 'Fu', type: 'number' },
      { name: 'E', type: 'number' },
      { name: 'ε', type: 'number' },
    ],
    compute: (inputs) => {
      const grade = inputs.Grade;
      const grades: Record<string, { fy: number; fu: number }> = {
        'Fe250': { fy: 250, fu: 410 },
        'Fe350': { fy: 350, fu: 490 },
        'Fe410': { fy: 410, fu: 540 },
        'Fe450': { fy: 450, fu: 570 },
        'Fe550': { fy: 550, fu: 650 },
      };
      const g = grades[grade] || grades['Fe250'];
      return { Fy: g.fy, Fu: g.fu, E: 200000, 'ε': Math.sqrt(250 / g.fy) };
    },
    icon: '⚙️',
  },
  {
    type: 'concrete_material',
    category: 'Materials',
    label: 'Concrete Properties',
    description: 'Standard concrete material per IS 456',
    inputs: [
      { name: 'Grade', type: 'string', value: 'M30' },
    ],
    outputs: [
      { name: 'fck', type: 'number' },
      { name: 'Ec', type: 'number' },
    ],
    compute: (inputs) => {
      const grade = inputs.Grade;
      const fck = parseInt(grade.replace('M', '')) || 30;
      return { fck: fck, Ec: Math.round(5000 * Math.sqrt(fck)) };
    },
    icon: '🧱',
  },

  // ============ OUTPUT NODES ============
  {
    type: 'display',
    category: 'Outputs',
    label: 'Display',
    description: 'Display a value',
    inputs: [
      { name: 'Value', type: 'any', value: 0 },
      { name: 'Label', type: 'string', value: 'Result' },
      { name: 'Unit', type: 'string', value: '' },
    ],
    outputs: [],
    compute: (_inputs) => ({}),
    icon: '📺',
  },
  {
    type: 'pass_fail',
    category: 'Outputs',
    label: 'Pass/Fail Display',
    description: 'Visual pass/fail indicator',
    inputs: [
      { name: 'Check', type: 'boolean', value: false },
      { name: 'Label', type: 'string', value: 'Design Check' },
    ],
    outputs: [],
    compute: (_inputs) => ({}),
    icon: '🚦',
  },

  // ============ EXCEL NODES ============
  {
    type: 'cell_reference',
    category: 'Excel',
    label: 'Cell Reference',
    description: 'Reference a value by cell address (A1, B2, etc.)',
    inputs: [
      { name: 'Value', type: 'number', value: 0, unit: '' },
      { name: 'Cell', type: 'string', value: 'A1' },
    ],
    outputs: [{ name: 'Out', type: 'number' }],
    compute: (inputs) => ({ Out: Number(inputs.Value) || 0 }),
    icon: '📌',
  },
  {
    type: 'sum_range',
    category: 'Excel',
    label: 'SUM',
    description: 'Sum all input values',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
      { name: 'C', type: 'number', value: 0 },
      { name: 'D', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Sum', type: 'number' }],
    compute: (inputs) => ({ Sum: Object.values(inputs).reduce((a: number, b: any) => a + (Number(b) || 0), 0) }),
    icon: 'Σ',
  },
  {
    type: 'count_range',
    category: 'Excel',
    label: 'COUNT',
    description: 'Count non-zero values',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
      { name: 'C', type: 'number', value: 0 },
      { name: 'D', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Count', type: 'number' }],
    compute: (inputs) => ({ Count: Object.values(inputs).filter(v => Number(v) !== 0).length }),
    icon: '#',
  },
  {
    type: 'average_range',
    category: 'Excel',
    label: 'AVERAGE',
    description: 'Average of input values',
    inputs: [
      { name: 'A', type: 'number', value: 0 },
      { name: 'B', type: 'number', value: 0 },
      { name: 'C', type: 'number', value: 0 },
      { name: 'D', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Avg', type: 'number' }],
    compute: (inputs) => {
      const vals = Object.values(inputs).map(v => Number(v) || 0).filter(v => v !== 0);
      return { Avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    },
    icon: 'x̄',
  },
  {
    type: 'if_excel',
    category: 'Excel',
    label: 'IF (Excel)',
    description: 'IF condition with value check',
    inputs: [
      { name: 'Condition', type: 'boolean', value: true },
      { name: 'Value_True', type: 'number', value: 1 },
      { name: 'Value_False', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: inputs.Condition ? Number(inputs.Value_True) : Number(inputs.Value_False) }),
    icon: 'IFn',
  },
  {
    type: 'vlookup_approx',
    category: 'Excel',
    label: 'Lookup Table',
    description: 'Lookup value from a table (approximate VLOOKUP)',
    inputs: [
      { name: 'Search', type: 'number', value: 0 },
      { name: 'Col1', type: 'number', value: 0 },
      { name: 'Val1', type: 'number', value: 0 },
      { name: 'Col2', type: 'number', value: 100 },
      { name: 'Val2', type: 'number', value: 200 },
      { name: 'Col3', type: 'number', value: 200 },
      { name: 'Val3', type: 'number', value: 400 },
    ],
    outputs: [{ name: 'Found', type: 'number' }],
    compute: (inputs) => {
      const search = Number(inputs.Search) || 0;
      const cols = [Number(inputs.Col1), Number(inputs.Col2), Number(inputs.Col3)];
      const vals = [Number(inputs.Val1), Number(inputs.Val2), Number(inputs.Val3)];
      // Find closest column value ≤ search
      let result = vals[0];
      for (let i = cols.length - 1; i >= 0; i--) {
        if (search >= cols[i]) { result = vals[i]; break; }
      }
      return { Found: result };
    },
    icon: '📊',
  },
  {
    type: 'sumifs_node',
    category: 'Excel',
    label: 'SUMIFS',
    description: 'Conditional sum: add A if Condition is true',
    inputs: [
      { name: 'Values', type: 'number', value: 0 },
      { name: 'Condition', type: 'boolean', value: true },
      { name: 'Fallback', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'Result', type: 'number' }],
    compute: (inputs) => ({ Result: inputs.Condition ? Number(inputs.Values) : Number(inputs.Fallback) }),
    icon: 'Σf',
  },
];

// Custom nodes storage
const customNodes: NodeDefinition[] = [];

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeDefinitions.find(n => n.type === type) || customNodes.find(n => n.type === type);
}

export function getCategories(): string[] {
  const cats = new Set([...nodeDefinitions, ...customNodes].map(n => n.category));
  return Array.from(cats);
}

export function getNodesByCategory(category: string): NodeDefinition[] {
  return [...nodeDefinitions, ...customNodes].filter(n => n.category === category);
}

export function getAllNodes(): NodeDefinition[] {
  return [...nodeDefinitions, ...customNodes];
}

export function registerCustomNode(node: NodeDefinition): void {
  // Remove existing if updating
  const existingIdx = customNodes.findIndex(n => n.type === node.type);
  if (existingIdx >= 0) {
    customNodes[existingIdx] = node;
  } else {
    customNodes.push(node);
  }
}

export function removeCustomNode(type: string): void {
  const idx = customNodes.findIndex(n => n.type === type);
  if (idx >= 0) {
    customNodes.splice(idx, 1);
  }
}

export function getCustomNodes(): NodeDefinition[] {
  return [...customNodes];
}

export function clearCustomNodes(): void {
  customNodes.length = 0;
}
