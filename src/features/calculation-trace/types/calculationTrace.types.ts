/* ────────────────────────────────────────────────────────────────────────────
 * Calculation Trace — read-only types
 *
 * These types describe a READ-ONLY projection of the existing node graph.
 * They intentionally reuse the existing value model: every number/unit shown
 * in a trace comes from `CanvasNode.inputs[].value/unit` and
 * `CanvasNode.outputs[].value/unit`, which are already the engine's results.
 * Nothing here changes how the engine computes anything.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CanvasNode } from '../../../types';

/** Display verbosity for a trace step. */
export type TraceLevel = 'basic' | 'detailed' | 'audit';

/** Classification of an existing status string, used only for display color. */
export type TraceStatusKind = 'PASS' | 'FAIL' | 'WARNING' | 'INFO';

export interface TraceStatus {
  kind: TraceStatusKind;
  /** The status string exactly as produced by the node (never altered). */
  label: string;
}

/** A single port value, formatted for display. */
export interface TraceValue {
  /** Port name, e.g. "Vd". */
  name: string;
  /** Raw engine value (unchanged). */
  value: unknown;
  /** Formatted value + unit, e.g. "327,249 N". */
  display: string;
  /** Existing port unit (designator) — never converted. */
  unit?: string;
}

/** An input port as seen by the traced node. */
export interface TraceInput {
  name: string;
  value: unknown;
  display: string;
  unit?: string;
  /** True when the value is fed by an upstream node. */
  connected: boolean;
  sourceNodeId?: string;
  sourceNodeName?: string;
}

/** Where a step's formula text came from. */
export type TraceFormulaSource = 'built-in' | 'custom' | 'none';

export interface CalculationTraceStep {
  /** Stable id — the node's id. */
  id: string;
  nodeId: string;
  /** The node's label (as shown on the canvas). */
  nodeName: string;
  nodeType: string;
  category: string;
  /** Display icon from the existing node definition (when available). */
  icon?: string;
  /** True when this step is the selected (root) node. */
  isRoot: boolean;
  /** Longest-path distance from the root (root = 0). */
  depth: number;

  inputs: TraceInput[];
  /** The node's documented formula text (from its existing description). */
  documentedFormula?: string;
  /** Output name → formula (existing formula representation). */
  formulaExpressions?: Record<string, string>;
  /** Output name → formula with the current values substituted in (display only). */
  evaluatedFormulas?: Record<string, string>;
  formulaSource: TraceFormulaSource;

  results: TraceValue[];
  /** First meaningful output (status output excluded) — used as the "final result". */
  primaryResult?: TraceValue;

  /** Existing status produced by the node (e.g. "PASS ✓", "SAFE"). */
  status?: TraceStatus;
  /** Code reference extracted from the node's existing description (if any). */
  codeReference?: string;

  /** Upstream/downstream neighbors *within this trace* (audit view). */
  upstreamNodeIds: string[];
  downstreamNodeIds: string[];

  /** Engine error on the node itself, if any (displayed, never fixed). */
  nodeError?: string;
}

export interface CalculationTrace {
  rootNodeId: string;
  rootNodeName: string;
  /** Final result of the root node (its first meaningful output). */
  finalResult?: TraceValue;
  /** Final status of the root node (when it produces one). */
  finalStatus?: TraceStatus;
  /** Steps in dependency (topological) order — upstream first, root last. */
  steps: CalculationTraceStep[];
  rootStepIndex: number;
  /** Circular-dependency info, reusing the engine's own detection. */
  cycle: { detected: boolean; stopNodeName?: string };
  nodeCount: number;
  connectionCount: number;
  generatedAt: string;
}

/**
 * Supplies the authoritative per-output formulas for a node.
 * Used for custom nodes whose formulas live in editor state rather than in
 * the node definition. Return `undefined` to fall back to the built-in
 * extraction (node description).
 */
export interface TraceFormulaInfo {
  /** Output name → formula (formula-parser syntax). */
  formulas: Record<string, string>;
  source: Exclude<TraceFormulaSource, 'none'>;
}

/**
 * Supplies formulas for a node. The service always invokes it with the full
 * existing `CanvasNode`, so the provider may read any node property it needs.
 */
export type FormulaProvider = (node: CanvasNode) => TraceFormulaInfo | undefined;

export interface BuildTraceOptions {
  formulaProvider?: FormulaProvider;
}
