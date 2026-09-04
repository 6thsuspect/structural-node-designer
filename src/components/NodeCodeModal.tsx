import { useEffect, useMemo, useRef, useState, type CSSProperties, type UIEvent } from 'react';
import { CanvasNode, PortType, Theme } from '../types';
import ModalWindow from './ModalWindow';

export interface CodeNodeData {
  id: string;
  label: string;
  description: string;
  category: string;
  inputs: { name: string; type: PortType; value: any; unit?: string }[];
  outputs: { name: string; type: PortType; unit?: string }[];
  code: string;
}

interface Props {
  isOpen: boolean;
  theme: Theme;
  node: CanvasNode | null;
  /** The code stored for an existing code node (controls the save identity). */
  existingCode?: string | null;
  /** Code to prefill when there is no existing code node (e.g. generated). */
  initialCode?: string;
  onClose: () => void;
  onSave: (data: CodeNodeData) => void;
}

const themeStyles: Record<Theme, {
  bg: string; overlay: string; text: string; border: string;
  input: string; label: string; accent: string; error: string;
  success: string; card: string; editorBg: string;
}> = {
  dark: {
    bg: '#1e293b', overlay: 'rgba(0,0,0,0.7)', text: '#e2e8f0', border: '#334155',
    input: '#0f172a', label: '#94a3b8', accent: '#3b82f6', error: '#ef4444',
    success: '#10b981', card: '#0f172a', editorBg: '#0b1220',
  },
  light: {
    bg: '#ffffff', overlay: 'rgba(0,0,0,0.5)', text: '#1e293b', border: '#e2e8f0',
    input: '#f1f5f9', label: '#64748b', accent: '#3b82f6', error: '#ef4444',
    success: '#10b981', card: '#f8fafc', editorBg: '#f8fafc',
  },
  grasshopper: {
    bg: '#2d3748', overlay: 'rgba(0,0,0,0.7)', text: '#e2e8f0', border: '#4a5568',
    input: '#1a202c', label: '#a0aec0', accent: '#68d391', error: '#fc8181',
    success: '#68d391', card: '#1a202c', editorBg: '#16181d',
  },
  autocad: {
    bg: '#1a1a1a', overlay: 'rgba(0,0,0,0.8)', text: '#ffffff', border: '#333333',
    input: '#0a0a0a', label: '#888888', accent: '#00ff00', error: '#ff4444',
    success: '#00ff00', card: '#0a0a0a', editorBg: '#000000',
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Lightweight syntax highlighter for JavaScript — no external dependencies.
function highlight(code: string, p: { kw: string; str: string; num: string; cmt: string }): string {
  const combined = /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(\b(?:return|const|let|var|function|if|else|for|while|new|typeof|true|false|null|undefined|Math)\b)/g;
  let html = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(code)) !== null) {
    html += escapeHtml(code.slice(last, m.index));
    const color = m[1] ? p.cmt : m[2] ? p.str : m[3] ? p.num : p.kw;
    html += `<span style="color:${color}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  html += escapeHtml(code.slice(last));
  return html;
}

function defaultOutputValue(type: PortType): any {
  if (type === 'boolean') return 'false';
  if (type === 'string') return "''";
  return '0';
}

function buildTemplate(node: CanvasNode): string {
  const lines: string[] = [];
  lines.push('// `inputs` holds the input values, keyed by name.');
  lines.push('// Use inputs["Name"] for names with spaces or symbols.');
  lines.push('return {');
  node.outputs.forEach((o) => {
    lines.push(`  ${JSON.stringify(o.name)}: ${defaultOutputValue(o.type)},`);
  });
  lines.push('};');
  return lines.join('\n');
}

/* ─── Analyse the user's code to derive the real input/output port lists ───
 * The code is the source of truth: inputs are whatever the function reads from
 * `inputs["name"]`, and outputs are whatever keys it returns. This lets users
 * add/remove ports simply by editing the code. */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove // line comments and /* block comments, keeping string literals intact. */
function stripComments(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < code.length) {
        out += code[i];
        if (code[i] === '\\') { out += code[i + 1] ?? ''; i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Names referenced via inputs["name"] / inputs['name'], in order of appearance. */
function extractInputNames(code: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /inputs\s*\[\s*("([^"]*)"|'([^']*)')\s*\]/g;
  let m: RegExpExecArray | null;
  const cleaned = stripComments(code);
  while ((m = re.exec(cleaned)) !== null) {
    const name = m[2] ?? m[3];
    if (name && !seen.has(name)) { seen.add(name); names.push(name); }
  }
  return names;
}

/** Fallback number used in `inputs["name"] ?? <num>` (or `|| <num>`). */
function extractInputDefault(code: string, name: string): number | undefined {
  const re = new RegExp(`inputs\\s*\\[\\s*["']${escapeRegExp(name)}["']\\s*\\]\\s*(?:\\?\\?|\\|\\|)\\s*(-?\\d+(?:\\.\\d+)?)`);
  const m = stripComments(code).match(re);
  return m ? parseFloat(m[1]) : undefined;
}

function findMatchingBrace(s: string, openIdx: number): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let seg = '';
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      seg += ch;
      if (ch === '\\') { seg += body[i + 1] ?? ''; i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; seg += ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; seg += ch; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; seg += ch; continue; }
    if (ch === ',' && depth === 0) { parts.push(seg); seg = ''; continue; }
    seg += ch;
  }
  if (seg.trim()) parts.push(seg);
  return parts;
}

function segmentKey(seg: string): string | null {
  const s = seg.trim();
  if (!s) return null;
  // Find the top-level ':' that separates key from value.
  let depth = 0;
  let inStr: string | null = null;
  let colonIdx = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) { colonIdx = i; break; }
  }
  const raw = colonIdx >= 0 ? s.slice(0, colonIdx).trim() : s;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (/^[A-Za-z_$\u00C0-\uFFFF][\w$\u00C0-\uFFFF]*$/.test(raw)) return raw;
  return null;
}

/** Keys of the object returned by the code's `return { ... }` statement. */
function extractReturnKeys(code: string): string[] {
  const cleaned = stripComments(code);
  const retIdx = cleaned.lastIndexOf('return');
  if (retIdx === -1) return [];
  const openIdx = cleaned.indexOf('{', retIdx);
  if (openIdx === -1) return [];
  const closeIdx = findMatchingBrace(cleaned, openIdx);
  if (closeIdx === -1) return [];
  return splitTopLevel(cleaned.slice(openIdx + 1, closeIdx))
    .map(segmentKey)
    .filter((k): k is string => !!k);
}

export default function NodeCodeModal({ isOpen, theme, node, existingCode, initialCode, onClose, onSave }: Props) {
  const colors = themeStyles[theme];
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  // Reset when a new node is opened
  useEffect(() => {
    if (isOpen && node) {
      setLabel(node.label);
      const prefilled =
        existingCode && existingCode.trim() ? existingCode
          : initialCode && initialCode.trim() ? initialCode
            : buildTemplate(node);
      setCode(prefilled);
    }
  }, [isOpen, node, existingCode, initialCode]);

  // Derive the real port lists from the code (fall back to the node's current
  // ports when the code doesn't reference inputs / return an object).
  const savedInputs = useMemo(() => {
    if (!node) return [] as { name: string; type: PortType; value: any; unit?: string }[];
    const detected = extractInputNames(code);
    if (detected.length === 0) {
      return node.inputs.map((p) => ({ name: p.name, type: p.type, value: p.value, unit: p.unit }));
    }
    return detected.map((name) => {
      const existing = node.inputs.find((p) => p.name === name);
      if (existing) return { name, type: existing.type, value: existing.value, unit: existing.unit };
      return { name, type: 'number' as PortType, value: extractInputDefault(code, name) ?? 0, unit: undefined };
    });
  }, [code, node]);

  const savedOutputs = useMemo(() => {
    if (!node) return [] as { name: string; type: PortType; unit?: string }[];
    const detected = extractReturnKeys(code);
    if (detected.length === 0) {
      return node.outputs.map((p) => ({ name: p.name, type: p.type, unit: p.unit }));
    }
    return detected.map((name) => {
      const existing = node.outputs.find((p) => p.name === name);
      if (existing) return { name, type: existing.type, unit: existing.unit };
      return { name, type: 'number' as PortType, unit: undefined };
    });
  }, [code, node]);

  // Live validation of the user's code
  const validation = useMemo(() => {
    if (!node) return { valid: true, message: '' };
    if (!code.trim()) return { valid: false, message: 'Code is empty' };
    let fn: (inputs: Record<string, any>) => Record<string, any>;
    try {
      fn = new Function('inputs', code) as (inputs: Record<string, any>) => Record<string, any>;
    } catch (e: any) {
      return { valid: false, message: `Syntax error: ${e.message}` };
    }
    const sample: Record<string, any> = {};
    savedInputs.forEach((p) => { sample[p.name] = p.value; });
    try {
      const result = fn(sample);
      if (result === null || typeof result !== 'object' || Array.isArray(result)) {
        return { valid: false, message: 'The function must return an object like { "Out": value }' };
      }
      return { valid: true, message: '✓ Code runs successfully' };
    } catch (e: any) {
      return { valid: false, message: `Runtime error: ${e.message}` };
    }
  }, [code, node, savedInputs]);

  if (!isOpen || !node) return null;

  const editorPalette = {
    kw: theme === 'light' ? '#a626a4' : '#c678dd',
    str: theme === 'light' ? '#50a14f' : '#98c379',
    num: theme === 'light' ? '#986801' : '#d19a66',
    cmt: theme === 'light' ? '#a0a1a7' : '#6b7280',
  };

  const editorShared: CSSProperties = {
    position: 'absolute',
    inset: 0,
    margin: 0,
    padding: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    lineHeight: '1.6',
    whiteSpace: 'pre',
    tabSize: 2,
  };

  const handleSyncScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleSave = () => {
    if (!node) return;
    if (!validation.valid) return;
    onSave({
      id: existingCode && existingCode.trim() ? node.type : `code_${node.id}`,
      label: label.trim() || node.label,
      description: 'Custom code node',
      category: node.category,
      inputs: savedInputs,
      outputs: savedOutputs,
      code,
    });
  };

  return (
    <ModalWindow
      icon="🧮"
      title="Edit Node Code"
      subtitle={
        <p className="text-xs" style={{ color: colors.label }}>
          Modify this node's logic with JavaScript. <code style={{ background: colors.input }}>inputs</code> holds the input values.
        </p>
      }
      overlay={colors.overlay}
      bg={colors.bg}
      border={colors.border}
      text={colors.text}
      onClose={onClose}
      initialWidth={760}
      initialHeight={580}
      minWidth={420}
      minHeight={320}
      persistKey="snd.window.code"
      footer={
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${colors.border}` }}>
          <div className="text-xs" style={{ color: colors.label }}>
            The function receives <code>inputs</code> and must <code>return</code> an object of output values.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105" style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!validation.valid} className="px-6 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: colors.accent, color: '#fff' }}>
              Save Code
            </button>
          </div>
        </div>
      }
    >
      {/* Body */}
      <div className="p-6 space-y-4">
          {/* Node name */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>Node Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
            />
          </div>

          {/* Inputs summary — derived from the code */}
          {savedInputs.length > 0 && (
            <div className="p-3 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
                📥 Inputs — detected from code as <code>inputs["name"]</code>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {savedInputs.map((p) => (
                  <span key={p.name} className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}>
                    {p.name}{p.unit ? ` (${p.unit})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outputs summary — derived from the code */}
          {savedOutputs.length > 0 && (
            <div className="p-3 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.success }}>
                📤 Outputs — keys returned by the function
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {savedOutputs.map((p) => (
                  <span key={p.name} className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}>
                    {p.name}{p.unit ? ` (${p.unit})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Code editor */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>Function Body (JavaScript)</label>
            <div className="relative rounded-lg overflow-hidden" style={{ height: 320, background: colors.editorBg, border: `1px solid ${colors.border}` }}>
              <pre
                ref={preRef}
                aria-hidden="true"
                style={{ ...editorShared, overflow: 'hidden', pointerEvents: 'none', color: colors.text }}
                dangerouslySetInnerHTML={{ __html: highlight(code, editorPalette) + '\n' }}
              />
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleSyncScroll}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{
                  ...editorShared,
                  overflow: 'auto',
                  background: 'transparent',
                  color: 'transparent',
                  caretColor: colors.text,
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Validation status */}
          <div className="text-xs" style={{ color: validation.valid ? colors.success : colors.error }}>
            {validation.message}
          </div>
      </div>
    </ModalWindow>
  );
}
