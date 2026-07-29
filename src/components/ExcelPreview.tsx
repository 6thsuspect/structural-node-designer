import { CanvasNode, Theme, Connection } from '../types';

interface Props {
  nodes: CanvasNode[];
  connections: Connection[];
  theme: Theme;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; header: string; cell: string; accent: string }> = {
  dark: { bg: '#0f172a', text: '#e2e8f0', border: '#1e293b', header: '#1e293b', cell: '#0f172a', accent: '#3b82f6' },
  light: { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0', header: '#f1f5f9', cell: '#ffffff', accent: '#3b82f6' },
  grasshopper: { bg: '#1a202c', text: '#e2e8f0', border: '#2d3748', header: '#2d3748', cell: '#1a202c', accent: '#68d391' },
  autocad: { bg: '#0a0a0a', text: '#ffffff', border: '#222222', header: '#111111', cell: '#0a0a0a', accent: '#00ff00' },
};

export default function ExcelPreview({ nodes, theme }: Props) {
  const colors = themeStyles[theme];

  // Build a flat list of all input/output values
  const rows: { label: string; category: string; name: string; value: string; unit: string; type: 'input' | 'output' }[] = [];

  nodes.forEach(node => {
    node.inputs.forEach(port => {
      rows.push({
        label: node.label,
        category: node.category,
        name: port.name,
        value: String(port.value ?? ''),
        unit: port.unit || '',
        type: 'input',
      });
    });
    node.outputs.forEach(port => {
      rows.push({
        label: node.label,
        category: node.category,
        name: port.name,
        value: typeof port.value === 'number'
          ? port.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
          : String(port.value ?? ''),
        unit: port.unit || '',
        type: 'output',
      });
    });
  });

  const colHeaders = ['A', 'B', 'C', 'D', 'E', 'F'];
  const headers = ['Node', 'Category', 'Parameter', 'Value', 'Unit', 'I/O'];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: colors.bg, borderTop: `1px solid ${colors.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <span className="text-sm">📊</span>
        <span className="text-xs font-bold" style={{ color: colors.text }}>Excel Preview</span>
        <span className="text-[10px] ml-auto" style={{ color: colors.text, opacity: 0.4 }}>
          {rows.length} rows
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs border-collapse" style={{ minWidth: 500 }}>
          <thead>
            <tr>
              <th className="w-8 px-1 py-1 text-center sticky top-0 z-10" style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}` }}>
                #
              </th>
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-1 text-left font-semibold sticky top-0 z-10" style={{
                  background: colors.header,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}>
                  <div className="text-[9px] opacity-40">{colHeaders[i]}</div>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center" style={{ color: colors.text, opacity: 0.4 }}>
                  Add nodes to see Excel preview
                </td>
              </tr>
            ) : (
              rows.slice(0, 100).map((row, i) => (
                <tr key={i}>
                  <td className="px-1 py-0.5 text-center font-mono" style={{
                    background: colors.header,
                    color: colors.text,
                    opacity: 0.5,
                    border: `1px solid ${colors.border}`,
                  }}>
                    {i + 1}
                  </td>
                  <td className="px-2 py-0.5" style={{ color: colors.text, border: `1px solid ${colors.border}`, background: colors.cell }}>
                    {row.label}
                  </td>
                  <td className="px-2 py-0.5" style={{ color: colors.text, border: `1px solid ${colors.border}`, background: colors.cell }}>
                    {row.category}
                  </td>
                  <td className="px-2 py-0.5" style={{ color: colors.text, border: `1px solid ${colors.border}`, background: colors.cell }}>
                    {row.name}
                  </td>
                  <td className="px-2 py-0.5 font-mono font-bold" style={{
                    color: row.type === 'output' ? '#10b981' : colors.accent,
                    border: `1px solid ${colors.border}`,
                    background: colors.cell,
                  }}>
                    {row.value}
                  </td>
                  <td className="px-2 py-0.5" style={{ color: colors.text, opacity: 0.6, border: `1px solid ${colors.border}`, background: colors.cell }}>
                    {row.unit}
                  </td>
                  <td className="px-2 py-0.5" style={{
                    color: row.type === 'output' ? '#10b981' : '#f97316',
                    border: `1px solid ${colors.border}`,
                    background: colors.cell,
                  }}>
                    {row.type === 'output' ? '📤 OUT' : '📥 IN'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
