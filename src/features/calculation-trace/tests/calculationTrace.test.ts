/* ────────────────────────────────────────────────────────────────────────────
 * Calculation Trace — tests
 *
 * Run with: npm test
 * (compiles this feature + its existing dependencies to CJS via the
 *  `typescript` devDependency, then runs Node's built-in test runner —
 *  no new dependencies.)
 *
 * Covers the PRD's required scenarios:
 *  1. single node (Input → Result)          6. unit values unchanged
 *  2. linear chain A→B→C→D                   7. missing formula (no crash)
 *  3. branching A,B→C→D                      8. circular dependency
 *  4. multiple branches A,B→C; C,D→E         9. custom nodes (no crash)
 *  5. formula node (formula/inputs/result)  10. existing functionality
 *     (regression: engine results unchanged)
 * ──────────────────────────────────────────────────────────────────────────── */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CanvasNode, Connection } from '../../../types';
import { getNodeDefinition } from '../../../nodeDefinitions';
import { computeAllNodes, detectCircularReferences } from '../../../engine';
import { createDemoWorkflow } from '../../../demoWorkflow';
import {
  buildCalculationTrace,
  buildTraceMarkdown,
  extractCodeReference,
  formatTraceValue,
  searchTraceSteps,
  substituteFormulaValues,
} from '../services/calculationTraceService';
import type { CalculationTraceStep } from '../types/calculationTrace.types';

/* ─── Test graph helpers (mirror the existing createNode shape) ─── */

let idCounter = 0;

function makeNode(type: string, overrides: Record<string, any> = {}): CanvasNode {
  const def = getNodeDefinition(type);
  if (!def) throw new Error(`unknown node type: ${type}`);
  idCounter += 1;
  const id = `n${idCounter}`;
  const inputs = def.inputs.map((p, i) => ({
    ...p,
    id: `${id}-in-${i}`,
    connected: false,
    value: overrides[p.name] ?? p.value,
  }));
  const outputs = def.outputs.map((p, i) => ({
    ...p,
    id: `${id}-out-${i}`,
    connected: false,
  }));
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    inputs,
    outputs,
    label: def.label,
    category: def.category,
    color: '#000',
    collapsed: false,
    selected: false,
    computed: false,
  };
}

function link(from: CanvasNode, fromOut: string, to: CanvasNode, toIn: string): Connection {
  const fromPort = from.outputs.find(o => o.name === fromOut);
  const toPort = to.inputs.find(p => p.name === toIn);
  if (!fromPort || !toPort) throw new Error(`bad link ${fromOut} → ${toIn}`);
  return {
    id: `${from.id}->${to.id}:${toIn}`,
    fromNodeId: from.id,
    fromPortId: fromPort.id,
    toNodeId: to.id,
    toPortId: toPort.id,
  };
}

function typesInOrder(traceSteps: CalculationTraceStep[]): string[] {
  return traceSteps.map(s => s.nodeType);
}

function indexOf(steps: CalculationTraceStep[], nodeId: string): number {
  return steps.findIndex(s => s.nodeId === nodeId);
}

/* ─── 1. Single node: Input → Result ─── */

test('Test 1 — single node (Input → Result) produces exactly 2 trace steps', () => {
  const a = makeNode('number_input', { Value: 5 });
  const b = makeNode('add', { B: 3 });
  const connections = [link(a, 'Out', b, 'A')];
  const nodes = computeAllNodes([a, b], connections);

  const trace = buildCalculationTrace(nodes, connections, b.id);

  assert.equal(trace.steps.length, 2);
  assert.deepEqual(typesInOrder(trace.steps), ['number_input', 'add']);
  assert.equal(trace.rootStepIndex, 1);

  const addStep = trace.steps[1];
  assert.equal(addStep.isRoot, true);
  assert.equal(addStep.inputs.length, 2);
  const inA = addStep.inputs.find(i => i.name === 'A')!;
  const inB = addStep.inputs.find(i => i.name === 'B')!;
  assert.equal(inA.connected, true);
  assert.equal(inA.sourceNodeName, 'Number');
  assert.equal(inB.connected, false);
  assert.equal(inB.value, 3);

  // Final result is the engine's computed output (5 + 3 = 8).
  assert.equal(trace.finalResult?.name, 'Result');
  assert.equal(trace.finalResult?.value, 8);
});

/* ─── 2. Linear chain A → B → C → D ─── */

test('Test 2 — linear chain A → B → C → D is listed in dependency order', () => {
  const a = makeNode('number_input', { Value: 10 });
  const b = makeNode('add', { B: 1 });          // 11
  const c = makeNode('subtract', { B: 1 });     // 10
  const d = makeNode('round', { Decimals: 1 }); // 10
  const connections = [
    link(a, 'Out', b, 'A'),
    link(b, 'Result', c, 'A'),
    link(c, 'Result', d, 'Value'),
  ];
  const nodes = computeAllNodes([a, b, c, d], connections);

  const trace = buildCalculationTrace(nodes, connections, d.id);

  assert.equal(trace.steps.length, 4);
  assert.deepEqual(
    trace.steps.map(s => s.nodeId),
    [a.id, b.id, c.id, d.id],
  );
  // Depths from the root: d=0, c=1, b=2, a=3.
  assert.equal(trace.steps[3].depth, 0);
  assert.equal(trace.steps[2].depth, 1);
  assert.equal(trace.steps[1].depth, 2);
  assert.equal(trace.steps[0].depth, 3);
});

/* ─── 3. Branching A ─┐→ C → D ; B ─┘ ─── */

test('Test 3 — branching (A,B → C → D) keeps each node once with correct dependencies', () => {
  const a = makeNode('number_input', { Value: 2 });
  const b = makeNode('number_input', { Value: 3 });
  const c = makeNode('add');
  const d = makeNode('subtract', { B: 1 });
  const connections = [
    link(a, 'Out', c, 'A'),
    link(b, 'Out', c, 'B'),
    link(c, 'Result', d, 'A'),
  ];
  const nodes = computeAllNodes([a, b, c, d], connections);

  const trace = buildCalculationTrace(nodes, connections, d.id);

  // All four nodes present…
  assert.equal(trace.steps.length, 4);
  // …and C appears exactly once (no duplicated branch).
  assert.equal(trace.steps.filter(s => s.nodeId === c.id).length, 1);

  // C depends on BOTH A and B.
  const cStep = trace.steps.find(s => s.nodeId === c.id)!;
  assert.deepEqual(cStep.upstreamNodeIds.sort(), [a.id, b.id].sort());
  const inA = cStep.inputs.find(i => i.name === 'A')!;
  const inB = cStep.inputs.find(i => i.name === 'B')!;
  assert.equal(inA.sourceNodeId, a.id);
  assert.equal(inB.sourceNodeId, b.id);

  // Ordering: A and B before C, C before D.
  assert.ok(indexOf(trace.steps, a.id) < indexOf(trace.steps, c.id));
  assert.ok(indexOf(trace.steps, b.id) < indexOf(trace.steps, c.id));
  assert.ok(indexOf(trace.steps, c.id) < indexOf(trace.steps, d.id));
});

/* ─── 4. Multiple branches A → C ; B → C ; C → E ; D → E ─── */

test('Test 4 — multiple branches include every relevant dependency', () => {
  const a = makeNode('number_input', { Value: 1 });
  const b = makeNode('number_input', { Value: 2 });
  const d = makeNode('number_input', { Value: 4 });
  const c = makeNode('add');
  const e = makeNode('add');
  const connections = [
    link(a, 'Out', c, 'A'),
    link(b, 'Out', c, 'B'),
    link(c, 'Result', e, 'A'),
    link(d, 'Out', e, 'B'),
  ];
  const nodes = computeAllNodes([a, b, c, d, e], connections);

  const trace = buildCalculationTrace(nodes, connections, e.id);

  assert.equal(trace.steps.length, 5);
  for (const n of [a, b, c, d, e]) {
    assert.ok(trace.steps.some(s => s.nodeId === n.id), `missing ${n.type}`);
  }
  // All of E's upstream nodes precede it; C precedes E as well.
  for (const n of [a, b, c, d]) {
    assert.ok(indexOf(trace.steps, n.id) < indexOf(trace.steps, e.id), `${n.type} must precede E`);
  }
  // E sees C and D as direct upstreams.
  const eStep = trace.steps.find(s => s.nodeId === e.id)!;
  assert.deepEqual(eStep.upstreamNodeIds.sort(), [c.id, d.id].sort());
});

/* ─── 5. Formula node: formula, inputs and result displayed ─── */

test('Test 5 — formula node shows formula, inputs (with units) and result', () => {
  const node = makeNode('plastic_moment', { Fy: 250, Zp: 500000, 'γm0': 1.1 });
  const nodes = computeAllNodes([node], []);
  const trace = buildCalculationTrace(nodes, [], node.id);
  const step = trace.steps[0];

  // Documented formula comes from the existing node description.
  assert.equal(step.documentedFormula, 'Mp = Fy × Zp (IS 800)');

  // Existing formula representation (parser syntax).
  assert.equal(step.formulaSource, 'built-in');
  assert.equal(step.formulaExpressions?.['Mp'], 'Fy*Zp');

  // Evaluated formula substitutes the current values (display only).
  assert.equal(step.evaluatedFormulas?.['Mp'], '250*500,000');

  // Inputs keep their existing units.
  const fy = step.inputs.find(i => i.name === 'Fy')!;
  assert.equal(fy.unit, 'MPa');
  assert.equal(fy.display, '250 MPa');

  // Results match the engine's computation exactly.
  const mp = step.results.find(r => r.name === 'Mp')!;
  const md = step.results.find(r => r.name === 'Md')!;
  assert.equal(mp.value, 125000000);
  assert.equal(md.value, Math.round(125000000 / 1.1));

  // Code reference is taken from the existing description, never invented.
  assert.equal(step.codeReference, 'IS 800');
});

/* ─── 6. Unit values remain unchanged ─── */

test('Test 6 — units are displayed exactly as stored (no conversion introduced)', () => {
  const w = makeNode('width_input', { Width: 300 });
  const area = makeNode('rect_area', { D: 500 });
  const connections = [link(w, 'W', area, 'B')];
  const nodes = computeAllNodes([w, area], connections);

  const trace = buildCalculationTrace(nodes, connections, area.id);
  const areaStep = trace.steps.find(s => s.nodeId === area.id)!;

  const b = areaStep.inputs.find(i => i.name === 'B')!;
  assert.equal(b.unit, 'mm');
  assert.equal(b.display, '300 mm'); // not converted, not scaled
  assert.equal(b.value, 300);

  const d = areaStep.inputs.find(i => i.name === 'D')!;
  assert.equal(d.unit, 'mm');
  assert.equal(d.display, '500 mm');

  // Output unit stays exactly what the port defines (Area defines none).
  const out = areaStep.results.find(r => r.name === 'Area')!;
  assert.equal(out.unit, undefined);
  assert.equal(out.value, 150000);
});

/* ─── 7. Missing formula → "Not available", no crash ─── */

test('Test 7 — nodes without formulas do not crash the trace', () => {
  // Built-in node whose description contains no formula.
  const display = makeNode('display');
  const source = makeNode('number_input', { Value: 42 });
  const connections = [link(source, 'Out', display, 'Value')];
  const nodes = computeAllNodes([source, display], connections);

  const trace = buildCalculationTrace(nodes, connections, display.id);
  const displayStep = trace.steps.find(s => s.nodeId === display.id)!;
  assert.equal(displayStep.formulaSource, 'none');
  assert.equal(displayStep.documentedFormula, undefined);
  assert.equal(displayStep.evaluatedFormulas, undefined);
  // Still a valid trace: both steps present, no result outputs on display.
  assert.equal(trace.steps.length, 2);
  assert.equal(displayStep.results.length, 0);
});

/* ─── 8. Circular dependency → flagged via the existing engine detection ─── */

test('Test 8 — circular dependency is detected (engine mechanism) without crashing', () => {
  const n1 = makeNode('add');
  const n2 = makeNode('add');
  const root = makeNode('round', { Decimals: 1 });
  const connections = [
    link(n1, 'Result', n2, 'A'),
    link(n2, 'Result', n1, 'A'), // cycle n1 ↔ n2
    link(n1, 'Result', root, 'Value'),
  ];
  const nodes = computeAllNodes([n1, n2, root], connections);

  // Sanity: the engine's own detector agrees a cycle exists here.
  assert.equal(detectCircularReferences(nodes, connections), true);

  const trace = buildCalculationTrace(nodes, connections, root.id);
  assert.equal(trace.cycle.detected, true);
  assert.ok(typeof trace.cycle.stopNodeName === 'string' && trace.cycle.stopNodeName.length > 0);
  // The trace still lists every reachable node instead of failing.
  assert.equal(trace.steps.length, 3);
});

/* ─── 9. Custom nodes (with and without a formula provider) ─── */

function fakeCustomNode(overrides?: { value?: number; outValue?: number }): CanvasNode {
  return {
    id: 'custom-1',
    type: 'custom_mystery',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    inputs: [{ id: 'custom-1-in-0', name: 'A', type: 'number', value: overrides?.value ?? 4 }],
    outputs: [{ id: 'custom-1-out-0', name: 'Out', type: 'number', value: overrides?.outValue ?? 8 }],
    label: 'Mystery Custom Node',
    category: 'Custom',
    color: '#00BCD4',
    collapsed: false,
    selected: false,
    computed: true,
  };
}

test('Test 9a — custom node without a provider: no crash, formula "not available"', () => {
  const node = fakeCustomNode();
  const trace = buildCalculationTrace([node], [], node.id);
  const step = trace.steps[0];
  assert.equal(step.formulaSource, 'none');
  assert.equal(step.documentedFormula, undefined);
  assert.equal(step.nodeName, 'Mystery Custom Node');
  assert.equal(trace.steps.length, 1);
});

test('Test 9b — custom node WITH a provider: formulas shown and evaluated', () => {
  const node = fakeCustomNode();
  const trace = buildCalculationTrace([node], [], node.id, {
    formulaProvider: (n) =>
      n.type === 'custom_mystery' ? { formulas: { Out: 'A * 2' }, source: 'custom' } : undefined,
  });
  const step = trace.steps[0];
  assert.equal(step.formulaSource, 'custom');
  assert.equal(step.formulaExpressions?.['Out'], 'A * 2');
  assert.equal(step.evaluatedFormulas?.['Out'], '4 * 2');
});

/* ─── 10. Regression: existing calculations are unchanged by the trace ─── */

test('Test 10 — building traces never changes existing calculation results', () => {
  const { nodes, connections } = createDemoWorkflow();
  const before = JSON.stringify(nodes);

  // Trace several different roots (checks, capacities, section props).
  const roots = nodes.filter(n =>
    ['compare_check', 'plastic_moment', 'shear_capacity', 'i_section'].includes(n.type),
  );
  assert.ok(roots.length >= 3, 'demo workflow should contain traceable engineering nodes');
  for (const root of roots) {
    const trace = buildCalculationTrace(nodes, connections, root.id);
    assert.ok(trace.steps.length >= 1);
    assert.equal(trace.rootNodeName, root.label);
  }

  // The graph is byte-identical after tracing (read-only guarantee).
  assert.equal(JSON.stringify(nodes), before);

  // And the engine still produces exactly the same results on recompute.
  const recomputed = computeAllNodes(nodes, connections);
  assert.equal(JSON.stringify(recomputed), before);
});

/* ─── Additional unit-level coverage ─── */

test('formatTraceValue mirrors the canvas formatter', () => {
  assert.equal(formatTraceValue(true), 'TRUE');
  assert.equal(formatTraceValue(false), 'FALSE');
  assert.equal(formatTraceValue(0), '0');
  assert.equal(formatTraceValue(1234.5), '1,234.5');
  assert.equal(formatTraceValue(0.001), (0.001).toExponential(2));
  assert.equal(formatTraceValue(1e8), (1e8).toExponential(2));
  assert.equal(formatTraceValue('SAFE'), 'SAFE');
});

test('extractCodeReference only extracts references already present', () => {
  assert.equal(extractCodeReference('Mp = Fy × Zp (IS 800)'), 'IS 800');
  assert.equal(extractCodeReference('Shear strength per IS 456'), 'IS 456');
  assert.equal(extractCodeReference('pz = 0.6Vz² per IS 875-3'), 'IS 875-3');
  assert.equal(extractCodeReference('Display a value'), undefined);
  assert.equal(extractCodeReference(undefined), undefined);
});

test('substituteFormulaValues replaces whole identifiers only', () => {
  assert.equal(substituteFormulaValues('Fy * Zp', { Fy: '250', Zp: '100' }), '250 * 100');
  assert.equal(substituteFormulaValues('bfy', { fy: '1' }), 'bfy'); // no partial matches
  assert.equal(substituteFormulaValues('A - B', { A: '7', B: '-5' }), '7 - (-5)'); // negatives wrapped
  assert.equal(substituteFormulaValues('A / B', { A: '245.6', B: '165000' }), '245.6 / 165000');
});

test('searchTraceSteps matches name, type, formula, input/output names, reference', () => {
  const node = makeNode('plastic_moment', { Fy: 250, Zp: 500000 });
  const trace = buildCalculationTrace(computeAllNodes([node], []), [], node.id);
  const step = trace.steps[0];

  assert.ok(searchTraceSteps(trace, 'moment').includes(step));       // node name
  assert.ok(searchTraceSteps(trace, 'plastic_moment').includes(step)); // node type
  assert.ok(searchTraceSteps(trace, 'fy*zp').includes(step));       // formula
  assert.ok(searchTraceSteps(trace, 'γm0').includes(step));          // input name
  assert.ok(searchTraceSteps(trace, 'md').includes(step));           // output name
  assert.ok(searchTraceSteps(trace, 'is 800').includes(step));       // code reference
  assert.equal(searchTraceSteps(trace, 'zzz-not-found').length, 0);
  assert.equal(searchTraceSteps(trace, '   ').length, 1);            // empty query → all
});

test('buildTraceMarkdown produces a print-friendly document', () => {
  const a = makeNode('number_input', { Value: 2 });
  const b = makeNode('add', { B: 3 });
  const connections = [link(a, 'Out', b, 'A')];
  const nodes = computeAllNodes([a, b], connections);
  const trace = buildCalculationTrace(nodes, connections, b.id);
  const md = buildTraceMarkdown(trace, {
    projectName: 'Test Project',
    now: new Date('2026-01-02T03:04:05Z'),
  });

  assert.ok(md.startsWith('# CALCULATION TRACE'));
  assert.ok(md.includes('**Project:** Test Project'));
  assert.ok(md.includes('## Final Result'));
  assert.ok(md.includes('### 1. '));
  assert.ok(md.includes('Number'));
  assert.ok(md.includes('Add'));
  assert.ok(md.includes('Result = 5'));
  assert.ok(md.includes('_Generated by Structural Node Designer'));
});

test('isolated node (no upstream) yields a single-step trace without error', () => {
  const node = makeNode('number_input', { Value: 9 });
  const computed = computeAllNodes([node], []);
  const trace = buildCalculationTrace(computed, [], node.id);
  assert.equal(trace.steps.length, 1);
  assert.equal(trace.cycle.detected, false);
  assert.equal(trace.finalResult?.value, 9);
});
