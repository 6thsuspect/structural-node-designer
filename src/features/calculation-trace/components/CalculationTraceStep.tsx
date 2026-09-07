/* ────────────────────────────────────────────────────────────────────────────
 * CalculationTraceStep
 *
 * One collapsible step in the trace timeline. Read-only: it renders existing
 * node data (values, units, formulas, status) and offers a single "Locate"
 * action that only pans/highlights the canvas — it never edits the graph.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CalculationTraceStep as StepData, TraceLevel, TraceStatusKind } from '../types/calculationTrace.types';

export interface TraceColors {
  bg: string;
  text: string;
  border: string;
  input: string;
  label: string;
  accent: string;
  card: string;
}

interface Props {
  step: StepData;
  index: number;
  isLast: boolean;
  level: TraceLevel;
  expanded: boolean;
  onToggle: () => void;
  onLocate: () => void;
  nameOf: (id: string) => string;
  colors: TraceColors;
  innerRef: (el: HTMLDivElement | null) => void;
  dimmed: boolean;
  flashing: boolean;
}

const statusColors: Record<TraceStatusKind, string> = {
  PASS: '#10b981',
  FAIL: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#94a3b8',
};

function StatusBadge({ step }: { step: StepData }) {
  if (!step.status) return null;
  const color = statusColors[step.status.kind];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
      style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
      title={`Existing status produced by the node: ${step.status.label}`}
    >
      {step.status.label}
    </span>
  );
}

export default function CalculationTraceStep({
  step, index, isLast, level, expanded, onToggle, onLocate, nameOf, colors, innerRef, dimmed, flashing,
}: Props) {
  const dotColor = step.isRoot
    ? colors.accent
    : step.status
      ? statusColors[step.status.kind]
      : colors.label;

  return (
    <div
      ref={innerRef}
      className={`flex gap-2 ${dimmed ? 'opacity-30' : ''} transition-opacity duration-300`}
    >
      {/* Timeline rail */}
      <div className="w-5 flex flex-col items-center flex-shrink-0">
        <div
          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${step.isRoot ? '' : 'bg-transparent'}`}
          style={{
            background: step.isRoot ? dotColor : 'transparent',
            border: step.isRoot ? 'none' : `2px solid ${dotColor}`,
          }}
          title={step.isRoot ? 'Selected node (final result)' : undefined}
        />
        {!isLast && <div className="w-px flex-1" style={{ background: colors.border }} />}
      </div>

      {/* Step card */}
      <div
        className="flex-1 min-w-0 rounded-lg overflow-hidden mb-2"
        style={{
          background: colors.card,
          border: `1px solid ${flashing ? colors.accent : colors.border}`,
          boxShadow: flashing ? `0 0 0 2px ${colors.accent}66` : 'none',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? 'Collapse step' : 'Expand step'}
            className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
          >
            <span className="text-[10px] w-3 flex-shrink-0" style={{ color: colors.label }}>
              {expanded ? '▼' : '▶'}
            </span>
            {step.icon && <span className="flex-shrink-0">{step.icon}</span>}
            <span className="text-sm font-semibold truncate" style={{ color: colors.text }}>
              {index + 1}. {step.nodeName}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] flex-shrink-0"
              style={{ color: colors.label, border: `1px solid ${colors.border}` }}
            >
              {step.category}
            </span>
            <StatusBadge step={step} />
            {step.isRoot && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
                style={{ color: '#fff', background: colors.accent }}
              >
                FINAL RESULT
              </span>
            )}
            {level === 'basic' && step.primaryResult && (
              <span className="text-xs font-mono truncate" style={{ color: '#10b981' }}>
                = {step.primaryResult.display}
              </span>
            )}
          </button>
          <button
            onClick={onLocate}
            title="Locate node on canvas"
            aria-label={`Locate ${step.nodeName} on canvas`}
            className="px-2 py-1 rounded text-[11px] font-medium flex-shrink-0 transition-all hover:opacity-80 cursor-pointer"
            style={{ background: colors.accent, color: '#fff' }}
          >
            📍 Locate
          </button>
        </div>

        {/* Body */}
        {expanded && level !== 'basic' && (
          <div className="px-3 pb-3 space-y-3">
            {step.nodeError && (
              <div
                className="px-2 py-1.5 rounded text-xs"
                style={{ color: '#ef4444', background: '#ef444414', border: '1px solid #ef444444' }}
              >
                ⚠ {step.nodeError}
              </div>
            )}

            {/* Inputs */}
            {step.inputs.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.accent }}>
                  Inputs
                </h4>
                <div className="space-y-0.5">
                  {step.inputs.map(input => (
                    <div key={input.name} className="flex items-baseline gap-2 text-xs">
                      <span className="w-24 flex-shrink-0 truncate" style={{ color: colors.label }} title={input.name}>
                        {input.name}
                      </span>
                      <span className="font-mono" style={{ color: colors.text }}>
                        {input.display || '—'}
                      </span>
                      <span className="text-[10px] truncate" style={{ color: colors.label }}>
                        {input.connected && input.sourceNodeName ? `← from ${input.sourceNodeName}` : '(input)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formula */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.accent }}>
                Formula
              </h4>
              {step.documentedFormula && (
                <div className="text-xs italic" style={{ color: colors.text }}>
                  {step.documentedFormula}
                </div>
              )}
              {step.evaluatedFormulas &&
                Object.entries(step.evaluatedFormulas).map(([name, formula]) => (
                  <div key={name} className="text-xs font-mono mt-1" style={{ color: colors.text }}>
                    <span style={{ color: colors.label }}>{name} = </span>
                    {formula}
                  </div>
                ))}
              {!step.documentedFormula && !step.evaluatedFormulas && (
                <div className="text-xs" style={{ color: colors.label }}>
                  Not available
                  {step.formulaSource === 'custom' && (
                    <span className="ml-2">Source: Custom Node</span>
                  )}
                </div>
              )}
            </div>

            {/* Result */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.accent }}>
                Result
              </h4>
              {step.results.length > 0 ? (
                <div className="space-y-0.5">
                  {step.results.map(r => (
                    <div key={r.name} className="flex items-baseline gap-2 text-xs">
                      <span className="w-24 flex-shrink-0 truncate" style={{ color: colors.label }} title={r.name}>
                        {r.name}
                      </span>
                      <span className="font-mono font-bold" style={{ color: '#10b981' }}>
                        {r.display || '—'}
                      </span>
                      {r.unit && (
                        <span className="text-[10px]" style={{ color: colors.label }}>
                          ({r.unit})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs" style={{ color: colors.label }}>
                  No result (this node does not produce outputs)
                </div>
              )}
            </div>

            {/* Code reference */}
            {step.codeReference && (
              <div className="text-xs" style={{ color: colors.label }}>
                <span className="font-bold">Reference:</span>{' '}
                <span style={{ color: colors.text }}>{step.codeReference}</span>
              </div>
            )}

            {/* Audit extras */}
            {level === 'audit' && (
              <div className="pt-2 space-y-1 text-[10px] font-mono" style={{ color: colors.label, borderTop: `1px solid ${colors.border}` }}>
                <div>
                  Node ID: <span style={{ color: colors.text }}>{step.nodeId}</span>
                </div>
                <div>
                  Node Type: <span style={{ color: colors.text }}>{step.nodeType}</span>
                </div>
                <div>Depth: {step.depth}</div>
                {step.upstreamNodeIds.length > 0 && (
                  <div>
                    Supplied by:{' '}
                    <span style={{ color: colors.text }}>
                      {step.upstreamNodeIds.map(nameOf).join(', ')}
                    </span>
                  </div>
                )}
                {step.downstreamNodeIds.length > 0 && (
                  <div>
                    Feeds:{' '}
                    <span style={{ color: colors.text }}>
                      {step.downstreamNodeIds.map(nameOf).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {expanded && level === 'basic' && step.nodeError && (
          <div className="px-3 pb-2 text-xs" style={{ color: '#ef4444' }}>
            ⚠ {step.nodeError}
          </div>
        )}
      </div>
    </div>
  );
}
