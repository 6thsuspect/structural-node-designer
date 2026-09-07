/* ────────────────────────────────────────────────────────────────────────────
 * useCalculationTrace
 *
 * Generates the trace ON DEMAND (only while the trace panel is open) and
 * memoizes it against the current graph state. It never runs in the
 * background, never polls, and never modifies the graph — a failed
 * generation surfaces as `error` while the original calculation remains
 * untouched.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useMemo } from 'react';
import type { CanvasNode, Connection } from '../../../types';
import type { BuildTraceOptions, CalculationTrace } from '../types/calculationTrace.types';
import { buildCalculationTrace } from '../services/calculationTraceService';

export interface UseCalculationTraceResult {
  trace: CalculationTrace | null;
  error: string | null;
}

export function useCalculationTrace(
  nodes: CanvasNode[],
  connections: Connection[],
  rootNodeId: string | null,
  open: boolean,
  options?: BuildTraceOptions,
): UseCalculationTraceResult {
  const formulaProvider = options?.formulaProvider;
  return useMemo<UseCalculationTraceResult>(() => {
    if (!open || !rootNodeId) return { trace: null, error: null };
    try {
      return {
        trace: buildCalculationTrace(nodes, connections, rootNodeId, { formulaProvider }),
        error: null,
      };
    } catch (e) {
      // Fail independently — the original calculation is never touched.
      return { trace: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [nodes, connections, rootNodeId, open, formulaProvider]);
}
