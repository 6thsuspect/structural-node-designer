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
  existingCode?: string | null;
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

export default function NodeCodeModal({ isOpen, theme, node, existingCode, onClose, onSave }: Props) {
  const colors = themeStyles[theme];
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  // Reset when a new node is opened
  useEffect(() => {
    if (isOpen && node) {
      setLabel(node.label);
      setCode(existingCode && existingCode.trim() ? existingCode : buildTemplate(node));
    }
  }, [isOpen, node, existingCode]);

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
    node.inputs.forEach((p) => { sample[p.name] = p.value; });
    try {
      const result = fn(sample);
      if (result === null || typeof result !== 'object' || Array.isArray(result)) {
        return { valid: false, message: 'The function must return an object like { "Out": value }' };
      }
      return { valid: true, message: '✓ Code runs successfully' };
    } catch (e: any) {
      return { valid: false, message: `Runtime error: ${e.message}` };
    }
  }, [code, node]);

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
      inputs: node.inputs.map((p) => ({ name: p.name, type: p.type, value: p.value, unit: p.unit })),
      outputs: node.outputs.map((p) => ({ name: p.name, type: p.type, unit: p.unit })),
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

          {/* Inputs summary */}
          {node.inputs.length > 0 && (
            <div className="p-3 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
                📥 Inputs — available as <code>inputs["name"]</code>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {node.inputs.map((p) => (
                  <span key={p.id} className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}>
                    {p.name}{p.unit ? ` (${p.unit})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outputs summary */}
          {node.outputs.length > 0 && (
            <div className="p-3 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.success }}>
                📤 Outputs — the function must return these keys
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {node.outputs.map((p) => (
                  <span key={p.id} className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}>
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
