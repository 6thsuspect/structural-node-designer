/* ────────────────────────────────────────────────────────────────────────────
 * Calculation Trace — public entry point
 *
 * The feature is self-contained: the app only imports the panel, the hook and
 * (optionally) the types. Removing the feature = deleting this folder plus
 * the two integration points documented in docs/CALCULATION_TRACE.md.
 * ──────────────────────────────────────────────────────────────────────────── */

export { default as CalculationTracePanel } from './components/CalculationTracePanel';
export { useCalculationTrace } from './hooks/useCalculationTrace';
export {
  buildCalculationTrace,
  buildTraceMarkdown,
  formatTraceValue,
  formatTraceValueWithUnit,
  extractCodeReference,
  searchTraceSteps,
  substituteFormulaValues,
} from './services/calculationTraceService';
export type {
  BuildTraceOptions,
  CalculationTrace,
  CalculationTraceStep,
  FormulaProvider,
  TraceFormulaInfo,
  TraceInput,
  TraceLevel,
  TraceStatus,
  TraceStatusKind,
  TraceValue,
} from './types/calculationTrace.types';
