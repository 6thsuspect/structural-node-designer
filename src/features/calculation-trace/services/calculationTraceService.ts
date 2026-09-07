/* ────────────────────────────────────────────────────────────────────────────
 * Calculation Trace — service
 *
 * Builds a READ-ONLY trace of how a node's result was produced, using the
 * existing infrastructure only:
 *   • upstream traversal over the existing `Connection[]` list
 *   • ordering via the existing `topologicalSort` (engine.ts)
 *   • cycle flag via the existing `detectCircularReferences` (engine.ts)
 *   • formulas via the existing description / formula representation
 *     (nodeCodegen.ts `extractOutputFormulas`) or a caller-supplied provider
 *     for custom nodes
 *   • values/units read from the engine's already-computed port values
 *
 * This module never writes to the graph and never re-evaluates engineering
 * formulas. It is pure and DOM-free (unit-testable with node:test).
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CanvasNode, Connection } from '../../../types';
import { topologicalSort, detectCircularReferences } from '../../../engine';
import { getNodeDefinition, CATEGORY_ICONS } from '../../../nodeDefinitions';
import { extractOutputFormulas } from '../../../nodeCodegen';
import type {
  BuildTraceOptions,
  CalculationTrace,
  CalculationTraceStep,
  TraceInput,
  TraceStatus,
  TraceStatusKind,
  TraceValue,
} from '../types/calculationTrace.types';

/* ─── Value formatting ──────────────────────────────────────────────────────
 * Mirrors the canvas port formatter (NodeCanvas `fmt`) so trace numbers look
 * exactly like the numbers already shown on the canvas. No new precision
 * rules are introduced.
 * ──────────────────────────────────────────────────────────────────────────── */
export function formatTraceValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e7) return value.toExponential(2);
    if (abs >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (abs < 0.01) return value.toExponential(2);
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

export function formatTraceValueWithUnit(value: unknown, unit?: string): string {
  const base = formatTraceValue(value);
  if (!base) return '';
  return unit ? `${base} ${unit}` : base;
}

/* ─── Code references ───────────────────────────────────────────────────────
 * Extracted from the node's EXISTING description text only (e.g. "per IS 800").
 * No reference is ever invented.
 * ──────────────────────────────────────────────────────────────────────────── */
const CODE_REF_RE = /\b(?:IS|IRC|IRS|BS|EN|ACI|AASHTO|CSA)\s*-?\s?\d{1,5}(?:-\d+)*(?::\s*\d{4})?\b/gi;

export function extractCodeReference(description?: string): string | undefined {
  if (!description) return undefined;
  const matches = description.match(CODE_REF_RE);
  if (!matches || matches.length === 0) return undefined;
  return Array.from(new Set(matches)).join(', ');
}

/* ─── Status ────────────────────────────────────────────────────────────────
 * Only displays status information the node already produces ("Status" /
 * "Pass" outputs). The kind is a display-only classification for color.
 * ──────────────────────────────────────────────────────────────────────────── */
function classifyStatusLabel(label: string): TraceStatusKind {
  const s = label.toUpperCase();
  if (/(FAIL|FAILED|UNSAFE|EXCEED|NOT\s+OK|PROVIDE|OVERSTRESS)/.test(s)) return 'FAIL';
  if (/(PASS|PASSED|SAFE|\bOK\b|ACCEPT|SATISF)/.test(s)) return 'PASS';
  return 'INFO';
}

function extractStatus(node: CanvasNode): TraceStatus | undefined {
  const statusOut = node.outputs.find(o => o.name === 'Status');
  if (statusOut && typeof statusOut.value === 'string' && statusOut.value.trim()) {
    return { kind: classifyStatusLabel(statusOut.value), label: statusOut.value };
  }
  const passOut = node.outputs.find(o => o.name === 'Pass');
  if (passOut && typeof passOut.value === 'boolean') {
    return { kind: passOut.value ? 'PASS' : 'FAIL', label: passOut.value ? 'PASS' : 'FAIL' };
  }
  return undefined;
}

/* ─── Formulas ──────────────────────────────────────────────────────────────
 * Documented formula = the node's existing description when it contains an
 * "=" (e.g. "Mp = Fy × Zp (IS 800)"). Evaluated formulas are produced by
 * substituting the CURRENT values into the existing formula text — this is
 * display string substitution only, not re-evaluation.
 * ──────────────────────────────────────────────────────────────────────────── */
function documentedFormulaFromDescription(description?: string): string | undefined {
  const d = (description || '').trim();
  return d.includes('=') ? d : undefined;
}

/** Characters that terminate an identifier in the formula tokenizer. */
function isFormulaBreak(c: string): boolean {
  return /[\s+\-*/^(),.=]/.test(c);
}

/** Replace every standalone occurrence of `name` with `val` (boundary-aware). */
function replaceName(out: string, name: string, val: string): string {
  let result = '';
  let i = 0;
  for (;;) {
    const idx = out.indexOf(name, i);
    if (idx === -1) {
      result += out.slice(i);
      break;
    }
    const before = idx === 0 ? '' : out[idx - 1];
    const after = out[idx + name.length] ?? '';
    const okBefore = before === '' || isFormulaBreak(before);
    const okAfter = after === '' || isFormulaBreak(after);
    if (okBefore && okAfter) {
      result += out.slice(i, idx) + (val.startsWith('-') ? `(${val})` : val);
    } else {
      result += out.slice(i, idx + name.length);
    }
    i = idx + name.length;
  }
  return result;
}

/**
 * Substitute current values into a formula string (display only).
 * Longer names first so "Fy" is not mangled when "y" is also a name.
 */
export function substituteFormulaValues(
  formula: string,
  values: Record<string, string>,
  excludeName?: string,
): string {
  if (!formula) return formula;
  const names = Object.keys(values)
    .filter(n => n && n !== excludeName)
    .sort((a, b) => b.length - a.length);
  let out = formula;
  for (const name of names) {
    out = replaceName(out, name, values[name]);
  }
  return out;
}

interface ResolvedFormulas {
  documented?: string;
  expressions?: Record<string, string>;
  source: 'built-in' | 'custom' | 'none';
}

function resolveFormulas(node: CanvasNode, provider?: BuildTraceOptions['formulaProvider']): ResolvedFormulas {
  const def = getNodeDefinition(node.type);
  const documented = documentedFormulaFromDescription(def?.description);

  // 1) Caller-supplied provider (authoritative for custom nodes).
  let custom: { formulas: Record<string, string> } | undefined;
  if (provider) {
    try {
      custom = provider(node);
    } catch {
      custom = undefined; // a broken provider must not break the trace
    }
  }
  if (custom && Object.keys(custom.formulas).length > 0) {
    return { documented, expressions: { ...custom.formulas }, source: 'custom' };
  }

  // 2) Existing built-in extraction from the definition description.
  const builtin = def ? extractOutputFormulas(node, def) : undefined;
  if (builtin && Object.keys(builtin).length > 0) {
    return { documented, expressions: { ...builtin }, source: 'built-in' };
  }

  return { documented, source: 'none' };
}

/* ─── Upstream traversal ────────────────────────────────────────────────────
 * BFS over the EXISTING connection list, following connections backwards
 * (from an input port to the output port feeding it). A visited-set keeps
 * reused nodes (diamonds) at a single step, so the dependency relationship
 * is represented correctly instead of duplicating branches.
 * ──────────────────────────────────────────────────────────────────────────── */
interface Subgraph {
  nodeIds: Set<string>;
  nodes: CanvasNode[];
  connections: Connection[];
}

function collectUpstreamSubgraph(
  allNodes: CanvasNode[],
  allConnections: Connection[],
  rootNodeId: string,
): Subgraph {
  const nodeIds = new Set<string>([rootNodeId]);
  const queue: string[] = [rootNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const c of allConnections) {
      if (c.toNodeId !== current) continue;
      if (!nodeIds.has(c.fromNodeId)) {
        nodeIds.add(c.fromNodeId);
        queue.push(c.fromNodeId);
      }
    }
  }
  return {
    nodeIds,
    nodes: allNodes.filter(n => nodeIds.has(n.id)),
    connections: allConnections.filter(
      c => nodeIds.has(c.fromNodeId) && nodeIds.has(c.toNodeId),
    ),
  };
}

/* ─── Step construction ───────────────────────────────────────────────────── */
function buildStep(
  node: CanvasNode,
  subgraph: Subgraph,
  options?: BuildTraceOptions,
  isRoot = false,
  depth = 0,
): CalculationTraceStep {
  const def = getNodeDefinition(node.type);

  const inputs: TraceInput[] = node.inputs.map(port => {
    const conn = subgraph.connections.find(
      c => c.toNodeId === node.id && c.toPortId === port.id,
    );
    const source = conn ? subgraph.nodes.find(n => n.id === conn.fromNodeId) : undefined;
    return {
      name: port.name,
      value: port.value,
      display: formatTraceValueWithUnit(port.value, port.unit),
      unit: port.unit || undefined,
      connected: Boolean(conn && source),
      sourceNodeId: source?.id,
      sourceNodeName: source?.label,
    };
  });

  const results: TraceValue[] = node.outputs.map(port => ({
    name: port.name,
    value: port.value,
    display: formatTraceValueWithUnit(port.value, port.unit),
    unit: port.unit || undefined,
  }));

  // Headline value for the step (the "Status" string is surfaced separately
  // via `status`): prefer numbers, then booleans, then any non-empty value.
  const meaningful = results.filter(r => r.name !== 'Status');
  const primaryResult =
    meaningful.find(r => typeof r.value === 'number')
    ?? meaningful.find(r => typeof r.value === 'boolean')
    ?? meaningful.find(r => r.value !== undefined && r.value !== null && r.value !== '')
    ?? undefined;

  const { documented, expressions, source } = resolveFormulas(node, options?.formulaProvider);

  let evaluated: Record<string, string> | undefined;
  if (expressions) {
    const substitutions: Record<string, string> = {};
    node.inputs.forEach(p => { substitutions[p.name] = formatTraceValue(p.value); });
    node.outputs.forEach(o => { substitutions[o.name] = formatTraceValue(o.value); });
    evaluated = {};
    for (const [outName, formula] of Object.entries(expressions)) {
      evaluated[outName] = substituteFormulaValues(formula, substitutions, outName);
    }
  }

  const upstreamNodeIds: string[] = [];
  const downstreamNodeIds: string[] = [];
  for (const c of subgraph.connections) {
    if (c.toNodeId === node.id && !upstreamNodeIds.includes(c.fromNodeId)) upstreamNodeIds.push(c.fromNodeId);
    if (c.fromNodeId === node.id && !downstreamNodeIds.includes(c.toNodeId)) downstreamNodeIds.push(c.toNodeId);
  }

  return {
    id: node.id,
    nodeId: node.id,
    nodeName: node.label,
    nodeType: node.type,
    category: node.category,
    icon: def?.icon ?? CATEGORY_ICONS[node.category],
    isRoot,
    depth,
    inputs,
    documentedFormula: documented,
    formulaExpressions: expressions,
    evaluatedFormulas: evaluated,
    formulaSource: source,
    results,
    primaryResult,
    status: extractStatus(node),
    codeReference: extractCodeReference(def?.description),
    upstreamNodeIds,
    downstreamNodeIds,
    nodeError: node.error,
  };
}

/* ─── Public entry point ──────────────────────────────────────────────────── */
export function buildCalculationTrace(
  nodes: CanvasNode[],
  connections: Connection[],
  rootNodeId: string,
  options?: BuildTraceOptions,
): CalculationTrace {
  const root = nodes.find(n => n.id === rootNodeId);
  if (!root) {
    throw new Error(`Cannot trace node "${rootNodeId}" — it no longer exists in the project.`);
  }

  const subgraph = collectUpstreamSubgraph(nodes, connections, rootNodeId);

  // Ordering reuses the engine's existing topological sort (Kahn's algorithm)
  // restricted to the trace subgraph.
  const order = topologicalSort(subgraph.nodes, subgraph.connections);

  // Circular dependency: reuse the engine's existing detection. When a cycle
  // exists (possible only via imported project files — the UI blocks cycles),
  // the trace still lists every reachable node but flags where the ordering
  // can no longer be trusted.
  const hasCycle = detectCircularReferences(subgraph.nodes, subgraph.connections);
  let stopNodeName: string | undefined;
  if (hasCycle) {
    // The first node (in the returned order) whose upstream does not precede
    // it marks the point beyond which the ordering can no longer be trusted.
    const position = new Map<string, number>(order.map((id, i) => [id, i]));
    const byId = new Map(subgraph.nodes.map(n => [n.id, n]));
    const stopId = order.find(id =>
      subgraph.connections.some(
        c => c.toNodeId === id && (position.get(c.fromNodeId) ?? -1) > (position.get(id) ?? -1),
      ),
    );
    stopNodeName = (stopId ? byId.get(stopId)?.label : undefined) ?? root.label;
  }

  // Depth = longest-path distance from the root (reverse topological pass).
  const depthOf = new Map<string, number>();
  depthOf.set(root.id, 0);
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (depthOf.has(id)) continue;
    const downstream = subgraph.connections
      .filter(c => c.fromNodeId === id)
      .map(c => depthOf.get(c.toNodeId))
      .filter((d): d is number => d !== undefined);
    depthOf.set(id, downstream.length > 0 ? Math.max(...downstream) + 1 : 0);
  }

  const steps: CalculationTraceStep[] = order.map(id => {
    const node = subgraph.nodes.find(n => n.id === id)!;
    return buildStep(node, subgraph, options, node.id === root.id, depthOf.get(id) ?? 0);
  });

  const rootStepIndex = steps.findIndex(s => s.nodeId === root.id);
  const rootStep = rootStepIndex >= 0 ? steps[rootStepIndex] : undefined;

  return {
    rootNodeId: root.id,
    rootNodeName: root.label,
    finalResult: rootStep?.primaryResult,
    finalStatus: rootStep?.status,
    steps,
    rootStepIndex,
    cycle: { detected: hasCycle, stopNodeName },
    nodeCount: subgraph.nodes.length,
    connectionCount: subgraph.connections.length,
    generatedAt: new Date().toISOString(),
  };
}

/* ─── Search ──────────────────────────────────────────────────────────────── */
export function searchTraceSteps(trace: CalculationTrace, query: string): CalculationTraceStep[] {
  const q = query.trim().toLowerCase();
  if (!q) return trace.steps;
  return trace.steps.filter(step => {
    const haystack = [
      step.nodeName,
      step.nodeType,
      step.category,
      step.documentedFormula,
      step.codeReference,
      step.status?.label,
      ...Object.keys(step.formulaExpressions ?? {}),
      ...Object.values(step.formulaExpressions ?? {}),
      ...step.inputs.map(i => i.name),
      ...step.results.map(r => r.name),
    ]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/* ─── Export (Markdown) ─────────────────────────────────────────────────────
 * Reuses the same Blob/Markdown pattern as the existing report generator.
 * ──────────────────────────────────────────────────────────────────────────── */
export interface TraceExportMeta {
  projectName?: string;
  now?: Date;
}

export function buildTraceMarkdown(trace: CalculationTrace, meta: TraceExportMeta = {}): string {
  const now = meta.now ?? new Date();
  const lines: string[] = [];
  lines.push('# CALCULATION TRACE');
  lines.push('');
  lines.push(`**Project:** ${meta.projectName ?? 'Structural Node Designer'}`);
  lines.push(`**Calculation:** ${trace.rootNodeName}`);
  lines.push(`**Date:** ${now.toLocaleString()}`);
  lines.push(`**Revision:** 1.0`);
  lines.push(`**Scope:** ${trace.nodeCount} node(s), ${trace.connectionCount} connection(s)`);
  lines.push('');

  lines.push('## Final Result');
  lines.push('');
  if (trace.finalStatus) {
    lines.push(`**${trace.finalStatus.label}**`);
    lines.push('');
  }
  if (trace.finalResult) {
    lines.push(`${trace.finalResult.name} = ${trace.finalResult.display}`);
    lines.push('');
  }
  if (!trace.finalStatus && !trace.finalResult) {
    lines.push('_No result value._');
    lines.push('');
  }

  if (trace.cycle.detected) {
    lines.push('> ⚠ **Circular dependency detected.** The trace cannot be continued beyond ' +
      `**${trace.cycle.stopNodeName ?? trace.rootNodeName}**.`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  const byId = new Map(trace.steps.map(s => [s.nodeId, s]));
  const nameOf = (id: string) => byId.get(id)?.nodeName ?? id;

  trace.steps.forEach((step, idx) => {
    lines.push(`### ${idx + 1}. ${step.nodeName} ${step.isRoot ? '— *selected*' : ''}`);
    lines.push('');
    lines.push(`_${step.category} • ${step.nodeType}_`);
    lines.push('');

    if (step.inputs.length > 0) {
      lines.push('**Inputs**');
      lines.push('');
      for (const input of step.inputs) {
        const source = input.connected && input.sourceNodeName
          ? ` ← from *${input.sourceNodeName}*`
          : ' (input)';
        lines.push(`- ${input.name}: ${input.display || '—'}${source}`);
      }
      lines.push('');
    }

    if (step.documentedFormula) {
      lines.push('**Formula**');
      lines.push('');
      lines.push(step.documentedFormula);
      lines.push('');
    }
    if (step.evaluatedFormulas) {
      lines.push('**Evaluated**');
      lines.push('');
      for (const [name, formula] of Object.entries(step.evaluatedFormulas)) {
        lines.push(`${name} = ${formula}`);
      }
      lines.push('');
    }
    if (!step.documentedFormula && !step.evaluatedFormulas) {
      lines.push('**Formula**');
      lines.push('');
      lines.push(step.formulaSource === 'custom' ? 'Not available (custom node)' : 'Not available');
      lines.push('');
    }

    if (step.results.length > 0) {
      lines.push('**Result**');
      lines.push('');
      for (const r of step.results) {
        lines.push(`${r.name} = ${r.display || '—'}`);
      }
      lines.push('');
    }

    if (step.status) {
      lines.push(`**Status:** ${step.status.label}`);
      lines.push('');
    }
    if (step.codeReference) {
      lines.push(`**Reference:** ${step.codeReference}`);
      lines.push('');
    }
    if (step.nodeError) {
      lines.push(`**Error:** ${step.nodeError}`);
      lines.push('');
    }

    if (step.upstreamNodeIds.length > 0 || step.downstreamNodeIds.length > 0) {
      lines.push(`**Dependencies:** ${
        [
          step.upstreamNodeIds.length > 0
            ? `supplied by ${step.upstreamNodeIds.map(nameOf).join(', ')}`
            : '',
          step.downstreamNodeIds.length > 0
            ? `feeds ${step.downstreamNodeIds.map(nameOf).join(', ')}`
            : '',
        ].filter(Boolean).join(' • ')
      }`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  lines.push(`_Generated by Structural Node Designer — Calculation Trace, ${now.toISOString()}_`);
  return lines.join('\n');
}
