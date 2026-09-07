/* ────────────────────────────────────────────────────────────────────────────
 * CalculationTraceSearch
 *
 * Search-within-trace. Matches node name, node type, category, formula,
 * input/output names and code reference (matching is done by the service's
 * `searchTraceSteps`). Selecting a result expands and scrolls to the step.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CalculationTraceStep } from '../types/calculationTrace.types';
import type { TraceColors } from './CalculationTraceStep';

interface Props {
  value: string;
  onChange: (v: string) => void;
  matches: CalculationTraceStep[];
  total: number;
  onPick: (stepId: string) => void;
  colors: TraceColors;
  inputRef: (el: HTMLInputElement | null) => void;
}

const MAX_RESULTS = 20;

export default function CalculationTraceSearch({
  value, onChange, matches, total, onPick, colors, inputRef,
}: Props) {
  const hasQuery = value.trim().length > 0;
  const shown = matches.slice(0, MAX_RESULTS);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search calculation…"
        aria-label="Search calculation trace"
        aria-haspopup={hasQuery ? 'listbox' : 'false'}
        className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
        style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
      />
      {hasQuery && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg overflow-hidden shadow-xl"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
          role="listbox"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: colors.label, borderBottom: `1px solid ${colors.border}` }}>
            {matches.length} of {total} step{total === 1 ? '' : 's'}{matches.length > MAX_RESULTS ? ` — showing ${MAX_RESULTS}` : ''}
          </div>
          {shown.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: colors.label }}>
              No matching steps
            </div>
          ) : (
            shown.map(step => (
              <button
                key={step.id}
                role="option"
                aria-selected={false}
                onClick={() => onPick(step.id)}
                className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: colors.text }}
              >
                <span style={{ color: '#10b981' }}>✓</span>
                <span className="truncate font-medium">{step.nodeName}</span>
                <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: colors.label }}>
                  {step.category}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
