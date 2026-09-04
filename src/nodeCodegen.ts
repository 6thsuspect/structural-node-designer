import { CanvasNode, NodeDefinition } from './types';
import { validateFormula } from './formulaParser';

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers that reconstruct editable code / formulas from an existing node.
 * Built-in nodes are compiled TypeScript (no runtime source), so we rebuild a
 * faithful, editable representation from the definition + current node values.
 * ──────────────────────────────────────────────────────────────────────────── */

const FUNC_NAMES = new Set([
  'sqrt', 'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'log', 'log10', 'exp', 'min', 'max', 'pow', 'round', 'floor', 'ceil', 'sign',
]);

const CONSTANTS: Record<string, string> = {
  pi: 'Math.PI', PI: 'Math.PI', e: 'Math.E', E: 'Math.E',
};

const RESERVED = new Set([
  'return', 'const', 'let', 'var', 'function', 'if', 'else', 'for', 'while', 'new',
  'typeof', 'true', 'false', 'null', 'undefined', 'in', 'of', 'class', 'this',
  'super', 'delete', 'void', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'try', 'catch', 'finally', 'throw', 'import', 'export', 'await', 'yield', 'static',
  'extends', 'instanceof', 'NaN', 'Infinity', 'Math', 'inputs',
]);

interface Tok { kind: 'num' | 'ident' | 'op' | 'lp' | 'rp' | 'comma'; value: string; }

function tokenizeExpr(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let n = '';
      while (i < s.length && /[0-9.eE+-]/.test(s[i])) {
        if ((s[i] === '+' || s[i] === '-') && n.length > 0 && !/[eE]/.test(n[n.length - 1])) break;
        n += s[i]; i++;
      }
      toks.push({ kind: 'num', value: n });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) { id += s[i]; i++; }
      toks.push({ kind: 'ident', value: id });
      continue;
    }
    if ('+-*/^'.includes(c)) { toks.push({ kind: 'op', value: c }); i++; continue; }
    if (c === '(') { toks.push({ kind: 'lp', value: '(' }); i++; continue; }
    if (c === ')') { toks.push({ kind: 'rp', value: ')' }); i++; continue; }
    if (c === ',') { toks.push({ kind: 'comma', value: ',' }); i++; continue; }
    i++; // skip unknown characters (Greek letters, symbols, …)
  }
  return toks;
}

function insertImplicitMult(toks: Tok[]): string {
  const isProducer = (t: Tok) => t.kind === 'num' || t.kind === 'rp' || t.kind === 'ident';
  const isStarter = (t: Tok) => t.kind === 'num' || t.kind === 'lp' || t.kind === 'ident';
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i > 0) {
      const prev = toks[i - 1];
      let star = '';
      if (isProducer(prev) && isStarter(t)) {
        // A function call like `sqrt(` must not get a `*`.
        const isCall = prev.kind === 'ident' && FUNC_NAMES.has(prev.value.toLowerCase()) && t.kind === 'lp';
        if (!isCall) star = '*';
      }
      out += star;
    }
    out += t.value;
  }
  return out;
}

/** Split a run-on identifier (e.g. "BD") into known input names ("B", "D"). */
function splitIdentifier(id: string, inputNames: string[]): string[] | null {
  const sorted = [...inputNames].sort((a, b) => b.length - a.length);
  const memo = new Map<string, string[] | null>();
  const trySplit = (s: string): string[] | null => {
    if (s === '') return [];
    if (memo.has(s)) return memo.get(s)!;
    if (inputNames.includes(s)) { memo.set(s, [s]); return [s]; }
    for (const n of sorted) {
      if (s.startsWith(n)) {
        const rest = trySplit(s.slice(n.length));
        if (rest) { const res = [n, ...rest]; memo.set(s, res); return res; }
      }
    }
    memo.set(s, null);
    return null;
  };
  const res = trySplit(id);
  return res && res.length > 1 ? res : null;
}

/** Tokenize while splitting run-on identifiers into the node's input names. */
function tokenizeWithInputs(s: string, inputNames: string[]): Tok[] {
  const toks = tokenizeExpr(s);
  const out: Tok[] = [];
  for (const t of toks) {
    if (
      t.kind === 'ident' &&
      !FUNC_NAMES.has(t.value.toLowerCase()) &&
      CONSTANTS[t.value] === undefined &&
      !inputNames.includes(t.value)
    ) {
      const parts = splitIdentifier(t.value, inputNames);
      if (parts) {
        parts.forEach((p, i) => {
          if (i > 0) out.push({ kind: 'op', value: '*' });
          out.push({ kind: 'ident', value: p });
        });
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

/** Clean a human-written formula fragment into formula-parser syntax. */
export function cleanFormulaString(raw: string, inputNames?: string[]): string {
  let s = raw
    .replace(/√\s*([0-9.]+)/g, 'sqrt($1)')
    .replace(/√/g, 'sqrt')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[·∙⋅]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/⁄/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi')
    .replace(/≤/g, '<')
    .replace(/≥/g, '>')
    .replace(/\s+/g, ' ');
  // Drop trailing code references like "(IS 800)", "per IS 875-3".
  s = s.replace(/\s*\((?:IS|IRC|IRS|BS|EN|ACI|AASHTO|CSA)[^()]*\)\s*$/i, '');
  s = s.replace(/\s+(?:per|as\s+per)\s+.*$/i, '');
  s = s.trim();
  const toks = inputNames ? tokenizeWithInputs(s, inputNames) : tokenizeExpr(s);
  const rebuilt = insertImplicitMult(toks);
  // Remove operator debris left behind by stripped (e.g. Greek) variables.
  return rebuilt.replace(/^[+*/^]+/, '').replace(/[+*/^]+$/, '').trim();
}

/**
 * Best-effort reconstruction of a node's output formulas (formula-parser
 * syntax) from its definition description, e.g. "Mp = Fy × Zp (IS 800)".
 */
export function extractOutputFormulas(node: CanvasNode, def?: NodeDefinition): Record<string, string> {
  const result: Record<string, string> = {};
  const desc = (def?.description || '').trim();
  if (!desc) return result;

  const inputNames = node.inputs.map((p) => p.name);
  let lhs = '';
  let rhs = '';
  let useFirstOutput = false;

  if (desc.includes('=')) {
    const parts = desc.split('=');
    lhs = parts[0].trim();
    rhs = parts.slice(1).join('=').trim();
  } else if (desc.includes(':')) {
    const parts = desc.split(':');
    lhs = parts[0].trim();
    rhs = parts.slice(1).join(':').trim();
    useFirstOutput = true;
  } else if (/^[a-zA-Z_]+\s*\(.*\)$/.test(desc)) {
    rhs = desc;
    useFirstOutput = true;
  }

  if (!rhs) return result;
  const formula = cleanFormulaString(rhs, inputNames);
  if (!formula) return result;

  const target = (useFirstOutput
    ? node.outputs[0]?.name
    : node.outputs.find((o) => o.name.toLowerCase() === lhs.toLowerCase())?.name || node.outputs[0]?.name);

  if (target) {
    const validation = validateFormula(formula, inputNames);
    if (validation.valid) result[target] = formula;
  }
  return result;
}

/** Convert a formula-parser expression into an equivalent JavaScript expression. */
export function formulaToJs(formula: string, varMap: Record<string, string>): string {
  const toks = tokenizeExpr(formula);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];

  const parseExpression = (): string => parseAddSub();
  const parseAddSub = (): string => {
    let left = parseMulDiv();
    while (peek() && peek().kind === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value;
      const right = parseMulDiv();
      left = `(${left} ${op} ${right})`;
    }
    return left;
  };
  const parseMulDiv = (): string => {
    let left = parsePower();
    while (peek() && peek().kind === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = next().value;
      const right = parsePower();
      left = `(${left} ${op} ${right})`;
    }
    return left;
  };
  const parsePower = (): string => {
    const left = parseUnary();
    if (peek() && peek().kind === 'op' && peek().value === '^') {
      next();
      const right = parsePower();
      return `Math.pow(${left}, ${right})`;
    }
    return left;
  };
  const parseUnary = (): string => {
    if (peek() && peek().kind === 'op' && peek().value === '-') { next(); return `(-${parseUnary()})`; }
    if (peek() && peek().kind === 'op' && peek().value === '+') { next(); return parseUnary(); }
    return parsePrimary();
  };
  const emitFunction = (fn: string, args: string[]): string => {
    const a0 = args[0] ?? '0';
    switch (fn) {
      case 'sqrt': return `Math.sqrt(${a0})`;
      case 'abs': return `Math.abs(${a0})`;
      case 'sin': return `Math.sin((${a0}) * Math.PI / 180)`;
      case 'cos': return `Math.cos((${a0}) * Math.PI / 180)`;
      case 'tan': return `Math.tan((${a0}) * Math.PI / 180)`;
      case 'asin': return `(Math.asin(${a0}) * 180 / Math.PI)`;
      case 'acos': return `(Math.acos(${a0}) * 180 / Math.PI)`;
      case 'atan': return `(Math.atan(${a0}) * 180 / Math.PI)`;
      case 'log': return `Math.log(${a0})`;
      case 'log10': return `Math.log10(${a0})`;
      case 'exp': return `Math.exp(${a0})`;
      case 'min': return `Math.min(${args.join(', ')})`;
      case 'max': return `Math.max(${args.join(', ')})`;
      case 'pow': return `Math.pow(${args[0] ?? '0'}, ${args[1] ?? '0'})`;
      case 'round': {
        const n = args[1] ?? '0';
        return `(Math.round((${a0}) * Math.pow(10, ${n})) / Math.pow(10, ${n}))`;
      }
      case 'floor': return `Math.floor(${a0})`;
      case 'ceil': return `Math.ceil(${a0})`;
      case 'sign': return `Math.sign(${a0})`;
      default: return `${fn}(${args.join(', ')})`;
    }
  };
  const parsePrimary = (): string => {
    const t = peek();
    if (!t) return '0';
    if (t.kind === 'num') { next(); return t.value; }
    if (t.kind === 'lp') {
      next();
      const e = parseExpression();
      if (peek() && peek().kind === 'rp') next();
      return `(${e})`;
    }
    if (t.kind === 'ident') {
      const name = next().value;
      if (peek() && peek().kind === 'lp') {
        next();
        const args: string[] = [];
        if (!(peek() && peek().kind === 'rp')) {
          args.push(parseExpression());
          while (peek() && peek().kind === 'comma') { next(); args.push(parseExpression()); }
        }
        if (peek() && peek().kind === 'rp') next();
        return emitFunction(name.toLowerCase(), args);
      }
      if (CONSTANTS[name] !== undefined) return CONSTANTS[name];
      if (varMap[name]) return varMap[name];
      return `inputs[${JSON.stringify(name)}]`;
    }
    next();
    return '0';
  };

  return parseExpression();
}

/** Turn a name into a safe JavaScript identifier (unique within the scope). */
export function sanitizeJsName(name: string, index: number, taken: Set<string>): string {
  let base = String(name).trim().replace(/[^A-Za-z0-9_$]/g, '_');
  if (!/^[A-Za-z_$]/.test(base)) base = 'v' + base;
  if (!base) base = 'v' + index;
  if (RESERVED.has(base)) base = '_' + base;
  let candidate = base;
  let i = 1;
  while (taken.has(candidate)) { candidate = base + '_' + (i++); }
  taken.add(candidate);
  return candidate;
}

/**
 * Generate editable JavaScript that reconstructs a node: its inputs (with
 * current values), its formulas, and its outputs.
 */
export function generateNodeCode(
  node: CanvasNode,
  def?: NodeDefinition,
  formulaMap?: Record<string, string>,
): string {
  const taken = new Set<string>();
  const lines: string[] = [];
  lines.push('// ' + node.label + '  (' + node.category + ' • ' + node.type + ')');
  if (def?.description) lines.push('// ' + def.description);
  lines.push('//');
  lines.push('// INPUTS — read inputs["name"], or edit the fallback values below.');
  const varMap: Record<string, string> = {};
  node.inputs.forEach((p, i) => {
    const cname = sanitizeJsName(p.name, i, taken);
    varMap[p.name] = cname;
    const fallback = typeof p.value === 'number' ? p.value : JSON.stringify(p.value ?? 0);
    lines.push(`const ${cname} = inputs[${JSON.stringify(p.name)}] ?? ${fallback};${p.unit ? '  // ' + p.unit : ''}`);
  });
  lines.push('');
  lines.push('// OUTPUTS');
  const outConsts: string[] = [];
  node.outputs.forEach((o, i) => {
    const oname = sanitizeJsName(o.name, node.inputs.length + i, taken);
    const formula = formulaMap?.[o.name];
    let expr: string;
    if (formula) {
      try {
        expr = formulaToJs(formula, varMap);
      } catch {
        expr = '0';
      }
    } else {
      const current = typeof o.value === 'number' ? o.value : JSON.stringify(o.value ?? 0);
      expr = `${current}  /* ← current value — replace with your formula */`;
    }
    lines.push(`const ${oname} = ${expr};${o.unit ? '  // ' + o.unit : ''}`);
    outConsts.push(`${JSON.stringify(o.name)}: ${oname}`);
  });
  lines.push('');
  lines.push(`return { ${outConsts.join(', ')} };`);
  return lines.join('\n');
}

/** Build a Quick-Formula prefill (inputs + equations) from an existing node. */
export function buildQuickPrefill(node: CanvasNode, def?: NodeDefinition): {
  label: string;
  description: string;
  category: string;
  equations: string[];
  inputs: { name: string; defaultValue: number; unit: string }[];
  outputs: { name: string; formula: string; unit: string }[];
} {
  const formulas = extractOutputFormulas(node, def);
  // Quick Formula is numeric-only; keep numeric inputs/outputs.
  const inputs = node.inputs
    .filter((p) => p.type === 'number')
    .map((p) => ({ name: p.name, defaultValue: Number(p.value) || 0, unit: p.unit || '' }));
  const outputs = node.outputs
    .filter((o) => o.type === 'number')
    .map((o) => ({ name: o.name, formula: formulas[o.name] ?? String(Number(o.value) || 0), unit: o.unit || '' }));
  const equations = outputs.map((o) => `${o.name} = ${o.formula}`);
  return {
    label: node.label,
    description: def?.description || '',
    category: node.category,
    equations,
    inputs,
    outputs,
  };
}
