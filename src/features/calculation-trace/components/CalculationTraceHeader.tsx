/* ────────────────────────────────────────────────────────────────────────────
 * CalculationTraceHeader
 *
 * "Final Result" summary card at the top of the trace panel: identifies the
 * selected node, its headline value, its existing status (if any), and the
 * scope of the trace. Read-only.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CalculationTrace, TraceStatusKind } from '../types/calculationTrace.types';
import type { TraceColors } from './CalculationTraceStep';

interface Props {
  trace: CalculationTrace;
  colors: TraceColors;
}

const statusColors: Record<TraceStatusKind, string> = {
  PASS: '#10b981',
  FAIL: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#94a3b8',
};

export default function CalculationTraceHeader({ trace, colors }: Props) {
  const statusColor = trace.finalStatus ? statusColors[trace.finalStatus.kind] : undefined;

  return (
    <div className="space-y-2">
      {/* Final result card */}
      <div
        className="rounded-lg p-3"
        style={{ background: colors.input, border: `1px solid ${colors.border}` }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: colors.accent }}>
          Final Result
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold" style={{ color: colors.text }}>
            {trace.rootNodeName}
          </h3>
          {trace.finalStatus && statusColor && (
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}14` }}
            >
              {trace.finalStatus.label}
            </span>
          )}
        </div>
        {trace.finalResult ? (
          <div className="font-mono text-lg mt-1" style={{ color: '#10b981' }}>
            {trace.finalResult.name} = {trace.finalResult.display}
          </div>
        ) : (
          <div className="text-xs mt-1" style={{ color: colors.label }}>
            No numeric result — the node {trace.finalStatus ? 'reports a status only' : 'does not produce outputs'}.
          </div>
        )}
        <div className="text-[10px] mt-2" style={{ color: colors.label }}>
          {trace.nodeCount} node{trace.nodeCount === 1 ? '' : 's'} • {trace.connectionCount} connection
          {trace.connectionCount === 1 ? '' : 's'} • generated {new Date(trace.generatedAt).toLocaleTimeString()}
        </div>
      </div>

      {/* Circular dependency warning (existing engine detection) */}
      {trace.cycle.detected && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ color: '#f59e0b', background: '#f59e0b14', border: '1px solid #f59e0b44' }}
        >
          <div className="font-bold">⚠ Circular dependency detected.</div>
          <div className="mt-1">
            Calculation trace cannot continue beyond:{' '}
            <span className="font-semibold">{trace.cycle.stopNodeName ?? trace.rootNodeName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
