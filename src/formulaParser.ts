// Simple formula parser and evaluator
// Supports: +, -, *, /, ^, (), sqrt(), abs(), sin(), cos(), tan(), log(), exp(), min(), max(), pi, e

type Token = {
  type: 'number' | 'operator' | 'function' | 'variable' | 'paren' | 'comma';
  value: string;
};

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  'sqrt': (args) => Math.sqrt(args[0]),
  'abs': (args) => Math.abs(args[0]),
  'sin': (args) => Math.sin(args[0] * Math.PI / 180), // degrees
  'cos': (args) => Math.cos(args[0] * Math.PI / 180),
  'tan': (args) => Math.tan(args[0] * Math.PI / 180),
  'asin': (args) => Math.asin(args[0]) * 180 / Math.PI,
  'acos': (args) => Math.acos(args[0]) * 180 / Math.PI,
  'atan': (args) => Math.atan(args[0]) * 180 / Math.PI,
  'log': (args) => Math.log(args[0]),
  'log10': (args) => Math.log10(args[0]),
  'exp': (args) => Math.exp(args[0]),
  'min': (args) => Math.min(...args),
  'max': (args) => Math.max(...args),
  'pow': (args) => Math.pow(args[0], args[1]),
  'round': (args) => Math.round(args[0] * Math.pow(10, args[1] || 0)) / Math.pow(10, args[1] || 0),
  'floor': (args) => Math.floor(args[0]),
  'ceil': (args) => Math.ceil(args[0]),
  'sign': (args) => Math.sign(args[0]),
};

const CONSTANTS: Record<string, number> = {
  'pi': Math.PI,
  'PI': Math.PI,
  'e': Math.E,
  'E': Math.E,
};

// Reserved characters that cannot appear inside a variable/output name.
// Everything else — letters (incl. Greek/Unicode like ε, σ, Δ), numbers,
// underscores and other symbols — is a valid identifier character.
const IDENTIFIER_BREAK = /[\s+\-*/^(),=.]/;

const isIdentifierStart = (c: string) => !!c && !/[0-9]/.test(c) && !IDENTIFIER_BREAK.test(c);
const isIdentifierPart = (c: string) => !!c && !IDENTIFIER_BREAK.test(c);

// Map common Unicode math symbols to their ASCII equivalents so users can
// paste symbols (×, ÷, −, ², π, …) directly into formulas and names.
function normalizeSymbols(formula: string): string {
  return formula
    .replace(/[×·∙⋅∗]/g, '*')
    .replace(/÷/g, '/')
    .replace(/⁄/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi');
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  formula = normalizeSymbols(formula);
  
  while (i < formula.length) {
    const char = formula[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // Numbers (including decimals)
    if (/[0-9.]/.test(char)) {
      let num = '';
      while (i < formula.length && /[0-9.eE+-]/.test(formula[i])) {
        // Handle scientific notation carefully
        if ((formula[i] === '+' || formula[i] === '-') && num.length > 0 && !/[eE]/.test(num[num.length - 1])) {
          break;
        }
        num += formula[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    
    // Operators
    if (/[+\-*/^]/.test(char)) {
      tokens.push({ type: 'operator', value: char });
      i++;
      continue;
    }
    
    // Parentheses
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i++;
      continue;
    }
    
    // Comma
    if (char === ',') {
      tokens.push({ type: 'comma', value: char });
      i++;
      continue;
    }
    
    // Identifiers (variables or functions) — allow letters, digits, and any
    // Unicode letter/symbol (e.g. Greek ε, σ, Δ), stopping only at reserved chars.
    if (isIdentifierStart(char)) {
      let ident = '';
      while (i < formula.length && isIdentifierPart(formula[i])) {
        ident += formula[i];
        i++;
      }
      // Check if it's a function (followed by parenthesis)
      const nextNonSpace = formula.slice(i).match(/^\s*\(/);
      if (nextNonSpace && FUNCTIONS[ident.toLowerCase()]) {
        tokens.push({ type: 'function', value: ident.toLowerCase() });
      } else {
        tokens.push({ type: 'variable', value: ident });
      }
      continue;
    }
    
    // Unknown character, skip
    i++;
  }
  
  return tokens;
}

interface ASTNode {
  type: 'number' | 'variable' | 'binary' | 'unary' | 'function';
  value?: number | string;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  argument?: ASTNode;
  args?: ASTNode[];
  name?: string;
}

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  private current(): Token | null {
    return this.tokens[this.pos] || null;
  }
  
  private consume(): Token | null {
    return this.tokens[this.pos++] || null;
  }
  

  
  parse(): ASTNode {
    return this.parseExpression();
  }
  
  private parseExpression(): ASTNode {
    return this.parseAddSub();
  }
  
  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    
    while (this.current()?.type === 'operator' && (this.current()?.value === '+' || this.current()?.value === '-')) {
      const op = this.consume()!.value;
      const right = this.parseMulDiv();
      left = { type: 'binary', operator: op, left, right };
    }
    
    return left;
  }
  
  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    
    while (this.current()?.type === 'operator' && (this.current()?.value === '*' || this.current()?.value === '/')) {
      const op = this.consume()!.value;
      const right = this.parsePower();
      left = { type: 'binary', operator: op, left, right };
    }
    
    return left;
  }
  
  private parsePower(): ASTNode {
    let left = this.parseUnary();
    
    if (this.current()?.type === 'operator' && this.current()?.value === '^') {
      this.consume();
      const right = this.parsePower(); // Right associative
      return { type: 'binary', operator: '^', left, right };
    }
    
    return left;
  }
  
  private parseUnary(): ASTNode {
    if (this.current()?.type === 'operator' && this.current()?.value === '-') {
      this.consume();
      const argument = this.parseUnary();
      return { type: 'unary', operator: '-', argument };
    }
    if (this.current()?.type === 'operator' && this.current()?.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }
  
  private parsePrimary(): ASTNode {
    const token = this.current();
    
    if (!token) {
      return { type: 'number', value: 0 };
    }
    
    // Number
    if (token.type === 'number') {
      this.consume();
      return { type: 'number', value: parseFloat(token.value) };
    }
    
    // Function call
    if (token.type === 'function') {
      const name = this.consume()!.value;
      this.consume(); // (
      const args: ASTNode[] = [];
      
      if (this.current()?.value !== ')') {
        args.push(this.parseExpression());
        while (this.current()?.type === 'comma') {
          this.consume();
          args.push(this.parseExpression());
        }
      }
      
      this.consume(); // )
      return { type: 'function', name, args };
    }
    
    // Variable or constant
    if (token.type === 'variable') {
      this.consume();
      if (CONSTANTS[token.value] !== undefined) {
        return { type: 'number', value: CONSTANTS[token.value] };
      }
      return { type: 'variable', value: token.value };
    }
    
    // Parenthesized expression
    if (token.type === 'paren' && token.value === '(') {
      this.consume();
      const expr = this.parseExpression();
      this.consume(); // )
      return expr;
    }
    
    return { type: 'number', value: 0 };
  }
}

function evaluate(ast: ASTNode, variables: Record<string, number>): number {
  switch (ast.type) {
    case 'number':
      return ast.value as number;
      
    case 'variable':
      const varName = ast.value as string;
      if (variables[varName] !== undefined) {
        return variables[varName];
      }
      throw new Error(`Unknown variable: ${varName}`);
      
    case 'binary':
      const left = evaluate(ast.left!, variables);
      const right = evaluate(ast.right!, variables);
      switch (ast.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '^': return Math.pow(left, right);
        default: return 0;
      }
      
    case 'unary':
      const arg = evaluate(ast.argument!, variables);
      if (ast.operator === '-') return -arg;
      return arg;
      
    case 'function':
      const fn = FUNCTIONS[ast.name!];
      if (!fn) throw new Error(`Unknown function: ${ast.name}`);
      const args = ast.args!.map(a => evaluate(a, variables));
      return fn(args);
      
    default:
      return 0;
  }
}

export function parseFormula(formula: string): (variables: Record<string, number>) => number {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  return (variables: Record<string, number>) => {
    try {
      return evaluate(ast, variables);
    } catch (e) {
      console.error('Formula evaluation error:', e);
      return 0;
    }
  };
}

export function validateFormula(formula: string, inputNames: string[]): { valid: boolean; error?: string } {
  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // Check for unknown variables
    const checkVariables = (node: ASTNode): void => {
      if (node.type === 'variable') {
        const varName = node.value as string;
        if (!inputNames.includes(varName) && CONSTANTS[varName] === undefined) {
          throw new Error(`Unknown variable: ${varName}. Available: ${inputNames.join(', ')}`);
        }
      }
      if (node.left) checkVariables(node.left);
      if (node.right) checkVariables(node.right);
      if (node.argument) checkVariables(node.argument);
      if (node.args) node.args.forEach(checkVariables);
    };
    
    checkVariables(ast);
    
    // Try evaluating with test values
    const testVars: Record<string, number> = {};
    inputNames.forEach(name => testVars[name] = 1);
    evaluate(ast, testVars);
    
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message || 'Invalid formula' };
  }
}

export function extractVariables(formula: string): string[] {
  const tokens = tokenize(formula);
  const variables = new Set<string>();
  
  tokens.forEach(token => {
    if (token.type === 'variable' && CONSTANTS[token.value] === undefined) {
      variables.add(token.value);
    }
  });
  
  return Array.from(variables);
}
