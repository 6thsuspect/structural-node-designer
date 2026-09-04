import { useState, useMemo, useEffect } from 'react';
import { Theme } from '../types';
import { validateFormula, extractVariables, analyzeFormulaNode, evaluateFormulaNode } from '../formulaParser';
import { CATEGORY_COLORS } from '../nodeDefinitions';
import ModalWindow from './ModalWindow';

export interface QuickNodeData {
  id: string;
  label: string;
  description: string;
  category: string;
  equations: string[];
  inputs: { name: string; defaultValue: number; unit: string }[];
  outputs: { name: string; formula: string; unit: string }[];
}

interface Props {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
  onSave: (nodeData: QuickNodeData) => void;
  editingNode?: QuickNodeData | null;
}

interface ParsedEquation {
  outputName: string;
  formula: string;
  variables: string[];
  isValid: boolean;
  error?: string;
}

const themeStyles: Record<Theme, { 
  bg: string; overlay: string; text: string; border: string; 
  input: string; label: string; accent: string; error: string;
  success: string; card: string;
}> = {
  dark: { 
    bg: '#1e293b', overlay: 'rgba(0,0,0,0.7)', text: '#e2e8f0', border: '#334155',
    input: '#0f172a', label: '#94a3b8', accent: '#3b82f6', error: '#ef4444',
    success: '#10b981', card: '#0f172a'
  },
  light: { 
    bg: '#ffffff', overlay: 'rgba(0,0,0,0.5)', text: '#1e293b', border: '#e2e8f0',
    input: '#f1f5f9', label: '#64748b', accent: '#3b82f6', error: '#ef4444',
    success: '#10b981', card: '#f8fafc'
  },
  grasshopper: { 
    bg: '#2d3748', overlay: 'rgba(0,0,0,0.7)', text: '#e2e8f0', border: '#4a5568',
    input: '#1a202c', label: '#a0aec0', accent: '#68d391', error: '#fc8181',
    success: '#68d391', card: '#1a202c'
  },
  autocad: { 
    bg: '#1a1a1a', overlay: 'rgba(0,0,0,0.8)', text: '#ffffff', border: '#333333',
    input: '#0a0a0a', label: '#888888', accent: '#00ff00', error: '#ff4444',
    success: '#00ff00', card: '#0a0a0a'
  },
};

const CATEGORIES = ['Custom', 'Steel', 'RCC', 'Bridge', 'Loads', 'Section', 'Math'];

// Output names may be any word or symbol — letters, numbers, underscores,
// Greek letters (ε, σ, Δ) and other Unicode symbols. They only can't start with
// a digit or contain characters reserved for formulas (operators, parens, '=', ',', spaces).
function isValidOutputName(name: string): boolean {
  if (!name) return false;
  if (/[0-9]/.test(name[0])) return false;      // can't start with a digit
  return !/[\s+\-*/^(),=]/.test(name);           // no reserved formula characters
}

// Parse equation like "Area = b * h" or "Stress = M / Z"
function parseEquation(equation: string): ParsedEquation {
  const trimmed = equation.trim();
  
  if (!trimmed) {
    return { outputName: '', formula: '', variables: [], isValid: false, error: 'Empty equation' };
  }
  
  // Split by = sign
  const parts = trimmed.split('=');
  
  if (parts.length !== 2) {
    return { outputName: '', formula: trimmed, variables: [], isValid: false, error: 'Use format: Output = formula (e.g., Area = b * h)' };
  }
  
  const outputName = parts[0].trim();
  const formula = parts[1].trim();
  
  if (!outputName) {
    return { outputName: '', formula, variables: [], isValid: false, error: 'Missing output name' };
  }
  
  if (!isValidOutputName(outputName)) {
    return { outputName, formula, variables: [], isValid: false, error: 'Output name cannot start with a digit or contain spaces, operators (+, -, *, /, ^), parentheses, commas, or "="' };
  }
  
  if (!formula) {
    return { outputName, formula: '', variables: [], isValid: false, error: 'Missing formula' };
  }
  
  // Extract variables from formula
  const variables = extractVariables(formula);
  
  // Validate the formula
  const validation = validateFormula(formula, variables);
  
  if (!validation.valid) {
    return { outputName, formula, variables, isValid: false, error: validation.error };
  }
  
  return { outputName, formula, variables, isValid: true };
}

export default function QuickFormulaModal({ isOpen, theme, onClose, onSave, editingNode }: Props) {
  const colors = themeStyles[theme];
  
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Custom');
  const [equationText, setEquationText] = useState('');
  const [inputUnits, setInputUnits] = useState<Record<string, string>>({});
  const [inputDefaults, setInputDefaults] = useState<Record<string, number>>({});
  const [outputUnits, setOutputUnits] = useState<Record<string, string>>({});

  // Reset form when modal opens or editingNode changes
  useEffect(() => {
    if (editingNode) {
      setLabel(editingNode.label);
      setDescription(editingNode.description);
      setCategory(editingNode.category);
      setEquationText(editingNode.equations.join('\n'));
      const units: Record<string, string> = {};
      const defaults: Record<string, number> = {};
      editingNode.inputs.forEach(i => {
        units[i.name] = i.unit;
        defaults[i.name] = i.defaultValue;
      });
      setInputUnits(units);
      setInputDefaults(defaults);
      const outUnits: Record<string, string> = {};
      editingNode.outputs.forEach(o => {
        outUnits[o.name] = o.unit;
      });
      setOutputUnits(outUnits);
    } else if (isOpen) {
      setLabel('');
      setDescription('');
      setCategory('Custom');
      setEquationText('');
      setInputUnits({});
      setInputDefaults({});
      setOutputUnits({});
    }
  }, [editingNode, isOpen]);

  // Parse all equations (line-level syntax & name checks)
  const parsedEquations = useMemo(() => {
    const lines = equationText.split('\n').filter(line => line.trim());
    return lines.map(line => parseEquation(line));
  }, [equationText]);

  // Cross-equation dependency analysis: auto-detects which variables are external
  // inputs vs. internal outputs, resolves dependencies between formulas, computes
  // a dependency-safe evaluation order, and reports cycles / duplicate outputs.
  const dependencyAnalysis = useMemo(() => {
    const originalIndices: number[] = [];
    const equations = parsedEquations
      .map((eq, i) => {
        if (eq.isValid && eq.outputName) {
          originalIndices.push(i);
          return { output: eq.outputName, formula: eq.formula };
        }
        return null;
      })
      .filter((eq): eq is { output: string; formula: string } => eq !== null);
    const plan = analyzeFormulaNode(equations);
    const lineErrors: Record<number, string> = {};
    plan.errors.forEach(err => {
      const line = originalIndices[err.index];
      if (line !== undefined) lineErrors[line] = err.error;
    });
    return { plan, lineErrors };
  }, [parsedEquations]);

  // External inputs = variables referenced but never calculated by any equation
  const allInputVariables = dependencyAnalysis.plan.inputs;

  // Outputs = the left-hand-side variable of every valid equation
  const allOutputs = useMemo(() => {
    return parsedEquations
      .filter(eq => eq.isValid && eq.outputName)
      .map(eq => ({ name: eq.outputName, formula: eq.formula }));
  }, [parsedEquations]);

  // Check if all equations are valid
  const allValid = useMemo(() => {
    return parsedEquations.length > 0 && 
           parsedEquations.every(eq => eq.isValid) &&
           dependencyAnalysis.plan.errors.length === 0 &&
           label.trim() !== '';
  }, [parsedEquations, dependencyAnalysis, label]);

  // Test calculation — evaluated in dependency order, not written order
  const testResults = useMemo(() => {
    const results: Record<string, number | string> = {};
    const values: Record<string, number> = {};
    
    // Set input values
    allInputVariables.forEach(v => {
      values[v] = inputDefaults[v] ?? 1;
    });
    
    try {
      const equations = allOutputs.map(o => ({ output: o.name, formula: o.formula }));
      const computed = evaluateFormulaNode(equations, values);
      allOutputs.forEach(o => {
        results[o.name] = computed[o.name] ?? '—';
      });
    } catch {
      // The detailed error (cycle / undefined variable) is shown on the
      // equation line itself; keep the preview simple.
      allOutputs.forEach(o => { results[o.name] = 'Error'; });
    }
    
    return results;
  }, [allOutputs, allInputVariables, inputDefaults]);

  const handleSave = () => {
    if (!allValid) return;
    
    const inputs = allInputVariables.map(name => ({
      name,
      defaultValue: inputDefaults[name] ?? 0,
      unit: inputUnits[name] || '',
    }));
    
    const outputs = allOutputs.map(o => ({
      name: o.name,
      formula: o.formula,
      unit: outputUnits[o.name] || '',
    }));
    
    onSave({
      id: editingNode?.id || `quick_${Date.now()}`,
      label: label.trim(),
      description: description.trim(),
      category,
      equations: equationText.split('\n').filter(line => line.trim()),
      inputs,
      outputs,
    });
    onClose();
  };

  const handleUpdateInputDefault = (varName: string, value: number) => {
    setInputDefaults(prev => ({ ...prev, [varName]: value }));
  };

  const handleUpdateInputUnit = (varName: string, unit: string) => {
    setInputUnits(prev => ({ ...prev, [varName]: unit }));
  };

  const handleUpdateOutputUnit = (outName: string, unit: string) => {
    setOutputUnits(prev => ({ ...prev, [outName]: unit }));
  };

  // Insert example equation
  const insertExample = (example: string) => {
    setEquationText(prev => prev ? `${prev}\n${example}` : example);
  };

  if (!isOpen) return null;

  return (
    <ModalWindow
      icon="⚡"
      title="Quick Formula Editor"
      subtitle={
        <p className="text-xs" style={{ color: colors.label }}>
          Just type equations like <code className="px-1 rounded" style={{ background: colors.input }}>Area = b * h</code> — inputs are auto-detected!
        </p>
      }
      overlay={colors.overlay}
      bg={colors.bg}
      border={colors.border}
      text={colors.text}
      onClose={onClose}
      initialWidth={960}
      initialHeight={640}
      minWidth={640}
      minHeight={420}
      scrollBody={false}
      persistKey="snd.window.quick"
      footer={
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <div className="text-xs" style={{ color: colors.label }}>
            {allValid ? (
              <span style={{ color: colors.success }}>
                ✓ Ready to create: {allInputVariables.length} inputs → {allOutputs.length} outputs
              </span>
            ) : (
              <span style={{ color: colors.error }}>
                {!label.trim() ? '✗ Enter a node name' : 
                 parsedEquations.length === 0 ? '✗ Enter at least one equation' :
                 '✗ Fix equation errors to continue'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allValid}
              className="px-6 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: colors.accent, color: '#fff' }}
            >
              ⚡ Create Node
            </button>
          </div>
        </div>
      }
    >
      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column - Equation Input */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto" style={{ borderRight: `1px solid ${colors.border}` }}>
            {/* Node Info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>
                  Node Name *
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Beam Stress Calculator"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Calculates bending stress from moment and section modulus"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
              />
            </div>

            {/* Equation Input */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold" style={{ color: colors.label }}>
                  Equations * <span className="font-normal">(one per line)</span>
                </label>
                <span className="text-[10px]" style={{ color: colors.label }}>
                  {parsedEquations.filter((e, i) => e.isValid && !dependencyAnalysis.lineErrors[i]).length} valid / {parsedEquations.length} total
                </span>
              </div>
              
              <textarea
                value={equationText}
                onChange={(e) => setEquationText(e.target.value)}
                placeholder={`Enter equations, one per line:\n\nArea = b * h\nI = b * h^3 / 12\nZ = I / (h / 2)\nStress = M / Z`}
                className="flex-1 min-h-[150px] px-4 py-3 rounded-lg text-sm outline-none font-mono resize-none"
                style={{ 
                  background: colors.input, 
                  color: colors.text, 
                  border: `1px solid ${colors.border}`,
                  lineHeight: '1.8',
                }}
                spellCheck={false}
              />

              {/* Equation Status */}
              {parsedEquations.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {parsedEquations.map((eq, idx) => {
                    const depError = dependencyAnalysis.lineErrors[idx];
                    const hasError = !eq.isValid || !!depError;
                    return (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                        style={{ background: hasError ? `${colors.error}15` : `${colors.success}15` }}
                      >
                        <span style={{ color: hasError ? colors.error : colors.success }}>
                          {hasError ? '✗' : '✓'}
                        </span>
                        <span className="font-mono" style={{ color: colors.text }}>
                          {eq.outputName || '?'} = {eq.formula || '...'}
                        </span>
                        {(eq.error || depError) && (
                          <span className="ml-auto" style={{ color: colors.error }}>
                            {depError || eq.error}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Examples */}
            <div className="mt-4 p-3 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <div className="text-xs font-semibold mb-2" style={{ color: colors.accent }}>📝 Click to insert example:</div>
              <div className="flex flex-wrap gap-1">
                {[
                  'Area = b * h',
                  'I = b * h^3 / 12',
                  'Z = b * h^2 / 6',
                  'Stress = M / Z',
                  'Pcr = pi^2 * E * I / L^2',
                  'tau = V / A',
                  'deflection = P * L^3 / (48 * E * I)',
                ].map(ex => (
                  <button
                    key={ex}
                    onClick={() => insertExample(ex)}
                    className="px-2 py-1 rounded text-[10px] font-mono transition-all hover:scale-105"
                    style={{ background: colors.input, color: colors.label, border: `1px solid ${colors.border}` }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Variables & Preview */}
          <div className="w-80 flex flex-col p-4 overflow-y-auto" style={{ background: colors.card }}>
            {/* Detected Inputs */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
                📥 Detected Inputs ({allInputVariables.length})
              </h3>
              {allInputVariables.length === 0 ? (
                <p className="text-xs" style={{ color: colors.label }}>
                  Variables will appear here as you type equations
                </p>
              ) : (
                <div className="space-y-2">
                  {allInputVariables.map(varName => (
                    <div 
                      key={varName}
                      className="p-2 rounded-lg"
                      style={{ background: colors.input, border: `1px solid ${colors.border}` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ background: '#f97316' }}
                        />
                        <span className="text-sm font-mono font-semibold" style={{ color: colors.text }}>
                          {varName}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={inputDefaults[varName] ?? ''}
                          onChange={(e) => handleUpdateInputDefault(varName, parseFloat(e.target.value) || 0)}
                          placeholder="Default"
                          className="flex-1 px-2 py-1 rounded text-xs outline-none"
                          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                        />
                        <input
                          type="text"
                          value={inputUnits[varName] || ''}
                          onChange={(e) => handleUpdateInputUnit(varName, e.target.value)}
                          placeholder="Unit"
                          className="w-16 px-2 py-1 rounded text-xs outline-none"
                          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outputs */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.success }}>
                📤 Outputs ({allOutputs.length})
              </h3>
              {allOutputs.length === 0 ? (
                <p className="text-xs" style={{ color: colors.label }}>
                  Outputs will appear based on your equations
                </p>
              ) : (
                <div className="space-y-2">
                  {allOutputs.map(output => (
                    <div 
                      key={output.name}
                      className="p-2 rounded-lg"
                      style={{ background: colors.input, border: `1px solid ${colors.border}` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-semibold" style={{ color: colors.text }}>
                          {output.name}
                        </span>
                        <span className="text-xs" style={{ color: colors.label }}>=</span>
                        <span className="text-xs font-mono" style={{ color: colors.label }}>
                          {output.formula}
                        </span>
                        <div 
                          className="w-2 h-2 rounded-full ml-auto"
                          style={{ background: '#60a5fa' }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: colors.label }}>Unit:</span>
                        <input
                          type="text"
                          value={outputUnits[output.name] || ''}
                          onChange={(e) => handleUpdateOutputUnit(output.name, e.target.value)}
                          placeholder="e.g., mm², kN, MPa"
                          className="flex-1 px-2 py-1 rounded text-xs outline-none"
                          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                        />
                        <span className="text-xs font-mono font-bold" style={{ color: colors.success }}>
                          = {typeof testResults[output.name] === 'number' 
                              ? (testResults[output.name] as number).toFixed(4) 
                              : testResults[output.name]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Node Preview */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.label }}>
                👁️ Node Preview
              </h3>
              <div 
                className="rounded-lg overflow-hidden shadow-lg"
                style={{ background: colors.bg, border: `2px solid ${colors.border}` }}
              >
                {/* Header */}
                <div 
                  className="px-3 py-2"
                  style={{ background: CATEGORY_COLORS[category] || '#666' }}
                >
                  <div className="text-sm font-semibold text-white truncate">
                    {label || 'Node Name'}
                  </div>
                  <div className="text-[10px] text-white/70">{category}</div>
                </div>
                {/* Ports */}
                <div className="p-2 space-y-1">
                  {allInputVariables.map(v => (
                    <div key={v} className="flex items-center gap-2 text-xs">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#f97316', border: '2px solid #f97316' }}
                      />
                      <span style={{ color: colors.label }}>{v}</span>
                      <span className="ml-auto font-mono text-[10px]" style={{ color: colors.accent }}>
                        {inputDefaults[v] ?? 0}{inputUnits[v] ? ` ${inputUnits[v]}` : ''}
                      </span>
                    </div>
                  ))}
                  {allInputVariables.length > 0 && allOutputs.length > 0 && (
                    <div className="border-t my-1" style={{ borderColor: colors.border }} />
                  )}
                  {allOutputs.map(o => (
                    <div key={o.name} className="flex items-center gap-2 text-xs">
                      <span style={{ color: colors.label }}>{o.name}</span>
                      <span className="ml-auto font-mono font-bold text-[10px]" style={{ color: colors.success }}>
                        {typeof testResults[o.name] === 'number' 
                          ? (testResults[o.name] as number).toFixed(2)
                          : '—'}
                        {outputUnits[o.name] ? ` ${outputUnits[o.name]}` : ''}
                      </span>
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#60a5fa', border: '2px solid #60a5fa' }}
                      />
                    </div>
                  ))}
                  {allInputVariables.length === 0 && allOutputs.length === 0 && (
                    <div className="text-center py-4 text-xs" style={{ color: colors.label }}>
                      Type equations to see preview
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Syntax Help */}
            <div className="mt-4 p-3 rounded-lg text-[10px]" style={{ background: colors.input, border: `1px solid ${colors.border}` }}>
              <div className="font-semibold mb-1" style={{ color: colors.accent }}>💡 Syntax Tips</div>
              <ul className="space-y-0.5" style={{ color: colors.label }}>
                <li>• Use <code>=</code> to define output: <code>Area = b * h</code></li>
                <li>• Operators: <code>+ - * / ^</code> and <code>( )</code></li>
                <li>• Functions: <code>sqrt, sin, cos, abs, min, max</code></li>
                <li>• Constants: <code>pi, e</code></li>
                <li>• Chain outputs: Use output as input in next line</li>
              </ul>
            </div>
          </div>
        </div>
    </ModalWindow>
  );
}
