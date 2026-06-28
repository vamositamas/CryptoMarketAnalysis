export type FormulaVariables = Record<string, number | null>;

export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
}

export interface FormulaEvaluationResult {
  value: number | null;
  error?: string;
}

const MAX_FORMULA_LENGTH = 200;

const ALLOWED_VARIABLES = new Set([
  'btc_price',
  'btc_price_24h_change',
  'market_cap',
  'circulating_supply',
  'stock_to_flow',
  'mvrv_zscore',
  'nupl',
  'fear_greed_index',
  'global_m2_yoy',
]);

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

export function validateFormula(formula: string): FormulaValidationResult {
  if (formula.length > MAX_FORMULA_LENGTH) {
    return { valid: false, error: 'Formula must not exceed 200 characters' };
  }

  const variableMatches = [...formula.matchAll(VARIABLE_PATTERN)];

  if (variableMatches.length === 0) {
    return { valid: false, error: 'Formula must contain at least one variable' };
  }

  for (const match of variableMatches) {
    const varName = match[1];

    if (!ALLOWED_VARIABLES.has(varName)) {
      return { valid: false, error: `Unknown variable: {{${varName}}}` };
    }
  }

  const expression = formula.replace(VARIABLE_PATTERN, '1');

  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    return { valid: false, error: 'Formula syntax error' };
  }

  let depth = 0;

  for (const char of expression) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;

      if (depth < 0) {
        return { valid: false, error: 'Formula syntax error' };
      }
    }
  }

  if (depth !== 0) {
    return { valid: false, error: 'Formula syntax error' };
  }

  try {
    parseAndEvaluate(expression);
  } catch {
    return { valid: false, error: 'Formula syntax error' };
  }

  return { valid: true };
}

export function evaluateFormula(
  formula: string,
  variables: FormulaVariables,
): FormulaEvaluationResult {
  let expression = formula;

  const variableMatches = [...formula.matchAll(VARIABLE_PATTERN)];

  for (const match of variableMatches) {
    const varName = match[1];
    const value = variables[varName];

    if (value === null || value === undefined) {
      return { value: null, error: 'Data unavailable — Check back soon' };
    }

    expression = expression.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), `(${String(value)})`);
  }

  if (VARIABLE_PATTERN.test(expression)) {
    return { value: null, error: 'Data unavailable — Check back soon' };
  }

  try {
    const result = parseAndEvaluate(expression);

    return { value: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Calculation Error';

    return { value: null, error: message };
  }
}

// ─── Safe recursive-descent parser (no eval) ──────────────────────────────

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let num = '';

      while (i < expression.length && ((expression[i] >= '0' && expression[i] <= '9') || expression[i] === '.')) {
        num += expression[i++];
      }

      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    throw new Error('Formula syntax error');
  }

  return tokens;
}

function parseAndEvaluate(expression: string): number {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const result = parser.parseAddSub();

  if (parser.pos < tokens.length) {
    throw new Error('Formula syntax error');
  }

  return result;
}

class Parser {
  pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parseAddSub(): number {
    let left = this.parseMulDiv();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        this.pos++;
        const right = this.parseMulDiv();
        left = token.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }

    return left;
  }

  parseMulDiv(): number {
    let left = this.parseUnary();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type === 'op' && (token.value === '*' || token.value === '/')) {
        this.pos++;
        const right = this.parseUnary();

        if (token.value === '/' && right === 0) {
          throw new Error('Calculation Error — Division by zero');
        }

        left = token.value === '*' ? left * right : left / right;
      } else {
        break;
      }
    }

    return left;
  }

  parseUnary(): number {
    const token = this.tokens[this.pos];

    if (token?.type === 'op' && token.value === '-') {
      this.pos++;
      return -this.parsePrimary();
    }

    if (token?.type === 'op' && token.value === '+') {
      this.pos++;
      return this.parsePrimary();
    }

    return this.parsePrimary();
  }

  parsePrimary(): number {
    const token = this.tokens[this.pos];

    if (!token) {
      throw new Error('Formula syntax error');
    }

    if (token.type === 'number') {
      this.pos++;
      return token.value;
    }

    if (token.type === 'op' && token.value === '(') {
      this.pos++;
      const result = this.parseAddSub();
      const closing = this.tokens[this.pos];

      if (!closing || closing.type !== 'op' || closing.value !== ')') {
        throw new Error('Formula syntax error');
      }

      this.pos++;
      return result;
    }

    throw new Error('Formula syntax error');
  }
}
