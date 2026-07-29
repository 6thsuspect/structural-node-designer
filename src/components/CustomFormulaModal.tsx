import React, { useState, useMemo } from 'react';
import { Theme } from '../types';
import { validateFormula, extractVariables } from '../formulaParser';
import { CATEGORY_COLORS } from '../nodeDefinitions';

interface CustomInput {
  name: string;
  defaultValue: number;
  unit: string;
}

interface CustomOutput {
  name: string;
  formula: string;
  unit: string;
}

export interface CustomNodeData {
  id: string;
  label: string;
  description: string;
  category: string;
  inputs: CustomInput[];
  outputs: CustomOutput[];
}

interface Props {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
  onSave: (nodeData: CustomNodeData) => void;
  editingNode?: CustomNodeData | null;
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

const CUSTOM_CATEGORIES = ['Custom', 'Steel', 'RCC', 'Bridge', 'Loads', 'Section', 'Math'];

export default function CustomFormulaModal({ isOpen, theme, onClose, onSave, editingNode }: Props) {
  const colors = themeStyles[theme];
  
  const [label, setLabel] = useState(editingNode?.label || '');
  const [description, setDescription] = useState(editingNode?.description || '');
  const [category, setCategory] = useState(editingNode?.category || 'Custom');
  const [inputs, setInputs] = useState<CustomInput[]>(
    editingNode?.inputs || [{ name: 'x', defaultValue: 0, unit: '' }]
  );
  const [outputs, setOutputs] = useState<CustomOutput[]>(
    editingNode?.outputs || [{ name: 'Result', formula: 'x', unit: '' }]
  );
  const [activeTab, setActiveTab] = useState<'basic' | 'inputs' | 'outputs' | 'preview'>('basic');

  // Reset form when editingNode changes
  React.useEffect(() => {
    if (editingNode) {
      setLabel(editingNode.label);
      setDescription(editingNode.description);
      setCategory(editingNode.category);
      setInputs(editingNode.inputs);
      setOutputs(editingNode.outputs);
    } else {
      setLabel('');
      setDescription('');
      setCategory('Custom');
      setInputs([{ name: 'x', defaultValue: 0, unit: '' }]);
      setOutputs([{ name: 'Result', formula: 'x', unit: '' }]);
    }
  }, [editingNode, isOpen]);

  const inputNames = useMemo(() => inputs.map(i => i.name), [inputs]);

  const validationResults = useMemo(() => {
    return outputs.map(output => validateFormula(output.formula, inputNames));
  }, [outputs, inputNames]);

  const allValid = useMemo(() => {
    return label.trim() !== '' && 
           inputs.every(i => i.name.trim() !== '') &&
           outputs.every(o => o.name.trim() !== '' && o.formula.trim() !== '') &&
           validationResults.every(r => r.valid);
  }, [label, inputs, outputs, validationResults]);

  const handleAddInput = () => {
    const newName = `input${inputs.length + 1}`;
    setInputs([...inputs, { name: newName, defaultValue: 0, unit: '' }]);
  };

  const handleRemoveInput = (index: number) => {
    if (inputs.length > 1) {
      setInputs(inputs.filter((_, i) => i !== index));
    }
  };

  const handleUpdateInput = (index: number, field: keyof CustomInput, value: string | number) => {
    setInputs(inputs.map((input, i) => 
      i === index ? { ...input, [field]: value } : input
    ));
  };

  const handleAddOutput = () => {
    const newName = `out${outputs.length + 1}`;
    setOutputs([...outputs, { name: newName, formula: '', unit: '' }]);
  };

  const handleRemoveOutput = (index: number) => {
    if (outputs.length > 1) {
      setOutputs(outputs.filter((_, i) => i !== index));
    }
  };

  const handleUpdateOutput = (index: number, field: keyof CustomOutput, value: string) => {
    setOutputs(outputs.map((output, i) => 
      i === index ? { ...output, [field]: value } : output
    ));
  };

  const handleSave = () => {
    if (!allValid) return;
    
    onSave({
      id: editingNode?.id || `custom_${Date.now()}`,
      label: label.trim(),
      description: description.trim(),
      category,
      inputs,
      outputs,
    });
    onClose();
  };

  const handleAutoDetectInputs = () => {
    // Extract variables from all formulas and create inputs for them
    const allVars = new Set<string>();
    outputs.forEach(o => {
      extractVariables(o.formula).forEach(v => allVars.add(v));
    });
    
    const existingNames = new Set(inputs.map(i => i.name));
    const newInputs = [...inputs];
    
    allVars.forEach(varName => {
      if (!existingNames.has(varName)) {
        newInputs.push({ name: varName, defaultValue: 0, unit: '' });
      }
    });
    
    setInputs(newInputs);
  };

  // Test calculation
  const testResults = useMemo(() => {
    const results: Record<string, number | string> = {};
    const testVars: Record<string, number> = {};
    inputs.forEach(i => { testVars[i.name] = i.defaultValue; });
    
    outputs.forEach((output, idx) => {
      if (validationResults[idx].valid) {
        try {
          const { parseFormula } = require('../formulaParser');
          const fn = parseFormula(output.formula);
          results[output.name] = fn(testVars);
        } catch (e) {
          results[output.name] = 'Error';
        }
      } else {
        results[output.name] = 'Invalid';
      }
    });
    
    return results;
  }, [inputs, outputs, validationResults]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: colors.overlay }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✏️</span>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.text }}>
                {editingNode ? 'Edit Custom Node' : 'Create Custom Node'}
              </h2>
              <p className="text-xs" style={{ color: colors.label }}>
                Define your own calculation node with custom formulas
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: colors.text }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 gap-1" style={{ borderBottom: `1px solid ${colors.border}` }}>
          {(['basic', 'inputs', 'outputs', 'preview'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                background: activeTab === tab ? colors.card : 'transparent',
                color: activeTab === tab ? colors.text : colors.label,
                borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : '2px solid transparent',
              }}
            >
              {tab === 'basic' && '📋 Basic Info'}
              {tab === 'inputs' && `📥 Inputs (${inputs.length})`}
              {tab === 'outputs' && `📤 Outputs (${outputs.length})`}
              {tab === 'preview' && '👁️ Preview'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>
                  Node Name *
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Plastic Modulus"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: colors.label }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Calculate plastic modulus Zp = A × y"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
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
                  {CUSTOM_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: colors.label }}>Color:</span>
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ background: CATEGORY_COLORS[category] || '#666' }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h4 className="text-sm font-semibold mb-2" style={{ color: colors.accent }}>💡 Formula Syntax Help</h4>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: colors.label }}>
                  <div>
                    <strong>Operators:</strong> + - * / ^ ( )
                  </div>
                  <div>
                    <strong>Constants:</strong> pi, e
                  </div>
                  <div>
                    <strong>Trig:</strong> sin, cos, tan, asin, acos, atan
                  </div>
                  <div>
                    <strong>Math:</strong> sqrt, abs, log, log10, exp
                  </div>
                  <div>
                    <strong>Utility:</strong> min, max, pow, round, floor, ceil
                  </div>
                  <div>
                    <strong>Example:</strong> sqrt(b*d^3/12)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h4 className="text-sm font-semibold mb-3" style={{ color: colors.accent }}>📐 Example Engineering Formulas</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono" style={{ color: colors.label }}>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Section Modulus:</span> Z = b * d^2 / 6
                  </div>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Moment of Inertia:</span> I = b * d^3 / 12
                  </div>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Bending Stress:</span> sigma = M / Z
                  </div>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Euler Buckling:</span> Pcr = pi^2 * E * I / L^2
                  </div>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Shear Stress:</span> tau = V / (b * d)
                  </div>
                  <div className="p-2 rounded" style={{ background: colors.input }}>
                    <span style={{ color: colors.text }}>Circle Area:</span> A = pi * D^2 / 4
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inputs Tab */}
          {activeTab === 'inputs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: colors.label }}>
                  Define the input parameters for your node
                </p>
                <button
                  onClick={handleAddInput}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                  style={{ background: colors.accent, color: '#fff' }}
                >
                  + Add Input
                </button>
              </div>

              {inputs.map((input, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                >
                  <span className="text-xs font-mono w-6" style={{ color: colors.label }}>#{index + 1}</span>
                  <input
                    type="text"
                    value={input.name}
                    onChange={(e) => handleUpdateInput(index, 'name', e.target.value)}
                    placeholder="Name (e.g., b)"
                    className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
                    style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                  />
                  <input
                    type="number"
                    value={input.defaultValue}
                    onChange={(e) => handleUpdateInput(index, 'defaultValue', parseFloat(e.target.value) || 0)}
                    placeholder="Default"
                    className="w-24 px-2 py-1.5 rounded text-sm outline-none"
                    style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                  />
                  <input
                    type="text"
                    value={input.unit}
                    onChange={(e) => handleUpdateInput(index, 'unit', e.target.value)}
                    placeholder="Unit"
                    className="w-20 px-2 py-1.5 rounded text-sm outline-none"
                    style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                  />
                  <button
                    onClick={() => handleRemoveInput(index)}
                    disabled={inputs.length <= 1}
                    className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors disabled:opacity-30"
                    style={{ color: colors.error }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Outputs Tab */}
          {activeTab === 'outputs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: colors.label }}>
                  Define formulas using input variables: <strong>{inputNames.join(', ')}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAutoDetectInputs}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                    style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    🔍 Auto-detect Inputs
                  </button>
                  <button
                    onClick={handleAddOutput}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                    style={{ background: colors.accent, color: '#fff' }}
                  >
                    + Add Output
                  </button>
                </div>
              </div>

              {outputs.map((output, index) => (
                <div 
                  key={index} 
                  className="p-3 rounded-lg space-y-2"
                  style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono w-6" style={{ color: colors.label }}>#{index + 1}</span>
                    <input
                      type="text"
                      value={output.name}
                      onChange={(e) => handleUpdateOutput(index, 'name', e.target.value)}
                      placeholder="Output Name"
                      className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
                      style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                    />
                    <input
                      type="text"
                      value={output.unit}
                      onChange={(e) => handleUpdateOutput(index, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="w-20 px-2 py-1.5 rounded text-sm outline-none"
                      style={{ background: colors.input, color: colors.text, border: `1px solid ${colors.border}` }}
                    />
                    <button
                      onClick={() => handleRemoveOutput(index)}
                      disabled={outputs.length <= 1}
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors disabled:opacity-30"
                      style={{ color: colors.error }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <span className="text-xs" style={{ color: colors.label }}>Formula:</span>
                    <input
                      type="text"
                      value={output.formula}
                      onChange={(e) => handleUpdateOutput(index, 'formula', e.target.value)}
                      placeholder="e.g., b * d^2 / 6"
                      className="flex-1 px-2 py-1.5 rounded text-sm outline-none font-mono"
                      style={{ 
                        background: colors.input, 
                        color: colors.text, 
                        border: `1px solid ${validationResults[index]?.valid ? colors.border : colors.error}` 
                      }}
                    />
                    {validationResults[index]?.valid ? (
                      <span style={{ color: colors.success }}>✓</span>
                    ) : (
                      <span style={{ color: colors.error }} title={validationResults[index]?.error}>✗</span>
                    )}
                  </div>
                  {!validationResults[index]?.valid && (
                    <p className="pl-8 text-xs" style={{ color: colors.error }}>
                      {validationResults[index]?.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Node Preview */}
              <div className="flex justify-center py-4">
                <div 
                  className="rounded-lg shadow-xl overflow-hidden"
                  style={{ width: 220, background: colors.card, border: `2px solid ${colors.border}` }}
                >
                  {/* Header */}
                  <div 
                    className="px-3 py-2"
                    style={{ background: CATEGORY_COLORS[category] || '#666' }}
                  >
                    <div className="text-sm font-semibold text-white truncate">
                      {label || 'Custom Node'}
                    </div>
                    <div className="text-[10px] text-white/70">{category}</div>
                  </div>
                  {/* Ports */}
                  <div className="p-2 space-y-1">
                    {inputs.map((input, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: '#f97316', border: '2px solid #f97316' }}
                        />
                        <span style={{ color: colors.label }}>{input.name}</span>
                        <span className="ml-auto font-mono text-[10px]" style={{ color: colors.accent }}>
                          {input.defaultValue}{input.unit && ` ${input.unit}`}
                        </span>
                      </div>
                    ))}
                    <div className="border-t my-2" style={{ borderColor: colors.border }} />
                    {outputs.map((output, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span style={{ color: colors.label }}>{output.name}</span>
                        <span className="ml-auto font-mono font-bold text-[10px]" style={{ color: colors.success }}>
                          {typeof testResults[output.name] === 'number' 
                            ? (testResults[output.name] as number).toFixed(4)
                            : testResults[output.name]}
                          {output.unit && ` ${output.unit}`}
                        </span>
                        <div 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: '#60a5fa', border: '2px solid #60a5fa' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Test Calculation */}
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h4 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>🧪 Test Calculation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-xs font-semibold mb-2" style={{ color: colors.accent }}>Inputs</h5>
                    <div className="space-y-1">
                      {inputs.map((input, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span style={{ color: colors.label }}>{input.name}:</span>
                          <span className="font-mono" style={{ color: colors.text }}>
                            {input.defaultValue} {input.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold mb-2" style={{ color: colors.success }}>Outputs</h5>
                    <div className="space-y-1">
                      {outputs.map((output, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span style={{ color: colors.label }}>{output.name}:</span>
                          <span className="font-mono font-bold" style={{ 
                            color: validationResults[i]?.valid ? colors.success : colors.error 
                          }}>
                            {typeof testResults[output.name] === 'number' 
                              ? (testResults[output.name] as number).toFixed(6)
                              : testResults[output.name]}
                            {output.unit && ` ${output.unit}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulas */}
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <h4 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>📝 Formulas</h4>
                {outputs.map((output, i) => (
                  <div key={i} className="text-sm font-mono mb-1" style={{ color: colors.label }}>
                    {output.name} = {output.formula}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <div className="text-xs" style={{ color: colors.label }}>
            {allValid ? (
              <span style={{ color: colors.success }}>✓ All formulas valid</span>
            ) : (
              <span style={{ color: colors.error }}>✗ Please fix errors before saving</span>
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
              {editingNode ? 'Update Node' : 'Create Node'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
