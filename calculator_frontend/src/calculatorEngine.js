/**
 * Calculator engine (pure, UI-agnostic).
 *
 * Flow name: CalculatorEngineTransition
 * Single entrypoint: transitionCalculator(state, input)
 *
 * Contract:
 * - Inputs:
 *   - state: CalculatorState (plain JS object; treat as immutable)
 *   - input: CalculatorInput (button intent: digit/operator/decimal/clear/backspace/equal)
 * - Output:
 *   - { state: CalculatorState } on success
 *   - { state: CalculatorState, error: CalculatorEngineError } on validation/evaluation failure
 * - Errors:
 *   - DIVIDE_BY_ZERO: attempted division by zero
 *   - MALFORMED_EXPRESSION: invalid token sequence (e.g., "1++2", "1..2", "=", "1+")
 *   - UNKNOWN_INPUT: unknown input type
 * - Side effects: none (no DOM, no storage, no Date, no randomness)
 *
 * Debuggability:
 * - Deterministic transitions; callers can log {input, prevState, nextState, error}
 */

/**
 * @typedef {'ADD'|'SUB'|'MUL'|'DIV'} Operator
 */

/**
 * @typedef {{type:'digit',digit:string}
 * | {type:'operator',operator:Operator}
 * | {type:'decimal'}
 * | {type:'clear'}
 * | {type:'backspace'}
 * | {type:'equal'}} CalculatorInput
 */

/**
 * @typedef {{
 *   code: 'DIVIDE_BY_ZERO'|'MALFORMED_EXPRESSION'|'UNKNOWN_INPUT',
 *   message: string
 * }} CalculatorEngineError
 */

/**
 * @typedef {{
 *   tokens: string[],
 *   status: 'ready'|'result'|'error',
 *   errorMessage: string|null
 * }} CalculatorState
 *
 * Notes:
 * - tokens represent an expression of the form: number (operator number)*
 * - numbers are strings like "12", "0.5", ".5" (we normalize ".5" to "0.5" at evaluation time).
 * - operators are one of '+', '-', '*', '/'.
 * - status:
 *   - 'ready': normal input mode
 *   - 'result': last action was equal; digits start new expression; operator continues from result
 *   - 'error': last action produced an error; next digit/decimal clears and starts over
 */

const OPERATORS = new Set(['+', '-', '*', '/']);

/**
 * PUBLIC_INTERFACE
 * Create a fresh calculator state.
 * @returns {CalculatorState}
 */
export function createInitialCalculatorState() {
  return {
    tokens: ['0'],
    status: 'ready',
    errorMessage: null,
  };
}

/**
 * PUBLIC_INTERFACE
 * Convert engine state to a display string.
 * @param {CalculatorState} state
 * @returns {string}
 */
export function getCalculatorDisplay(state) {
  if (state.status === 'error') {
    return state.errorMessage || 'Error';
  }
  if (!state.tokens || state.tokens.length === 0) return '0';
  return state.tokens.join(' ');
}

/**
 * PUBLIC_INTERFACE
 * Main reducer/transition function for calculator inputs.
 * @param {CalculatorState} state
 * @param {CalculatorInput} input
 * @returns {{ state: CalculatorState, error?: CalculatorEngineError }}
 */
export function transitionCalculator(state, input) {
  const safeState = normalizeState(state);

  switch (input?.type) {
    case 'clear':
      return { state: createInitialCalculatorState() };

    case 'backspace':
      return { state: applyBackspace(safeState) };

    case 'digit':
      return { state: applyDigit(safeState, input.digit) };

    case 'decimal':
      return applyDecimal(safeState);

    case 'operator':
      return applyOperator(safeState, input.operator);

    case 'equal':
      return evaluateEqual(safeState);

    default:
      return {
        state: {
          ...safeState,
          status: 'error',
          errorMessage: 'Unknown input',
        },
        error: { code: 'UNKNOWN_INPUT', message: 'Unknown input type' },
      };
  }
}

/* ----------------------- Internal helpers (pure) ----------------------- */

function normalizeState(state) {
  const fallback = createInitialCalculatorState();
  if (!state || !Array.isArray(state.tokens)) return fallback;

  const status = state.status === 'result' || state.status === 'error' ? state.status : 'ready';
  const tokens = state.tokens.length > 0 ? state.tokens.slice() : ['0'];

  return {
    tokens,
    status,
    errorMessage: status === 'error' ? state.errorMessage || 'Error' : null,
  };
}

function isDigitChar(ch) {
  return typeof ch === 'string' && ch.length === 1 && ch >= '0' && ch <= '9';
}

function isOperatorToken(tok) {
  return OPERATORS.has(tok);
}

function isNumberToken(tok) {
  return typeof tok === 'string' && tok.length > 0 && !isOperatorToken(tok);
}

function applyBackspace(state) {
  // If error/result, backspace behaves like clear-to-0 (common calculator behavior).
  if (state.status === 'error' || state.status === 'result') {
    return createInitialCalculatorState();
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (isOperatorToken(last)) {
    tokens.pop();
  } else {
    // number token
    const updated = last.slice(0, -1);
    if (
      updated.length === 0 ||
      updated === '-' ||
      updated === '.' ||
      updated === '-.'
    ) {
      // If number becomes empty/invalid, drop it; ensure expression doesn't become empty.
      tokens.pop();
      if (tokens.length === 0) tokens.push('0');
      // If we popped a number and now last is operator, remove dangling operator too.
      if (tokens.length > 0 && isOperatorToken(tokens[tokens.length - 1])) {
        tokens.pop();
        if (tokens.length === 0) tokens.push('0');
      }
    } else {
      tokens[tokens.length - 1] = updated;
    }
  }

  return { ...state, tokens, status: 'ready', errorMessage: null };
}

function applyDigit(state, digit) {
  if (!isDigitChar(digit)) {
    return {
      ...state,
      status: 'error',
      errorMessage: 'Malformed input',
    };
  }

  // If prior was error, digit starts fresh.
  if (state.status === 'error') {
    return { tokens: [digit], status: 'ready', errorMessage: null };
  }

  // If prior was result, digit starts a new expression.
  if (state.status === 'result') {
    return { tokens: [digit], status: 'ready', errorMessage: null };
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (isOperatorToken(last)) {
    tokens.push(digit);
    return { ...state, tokens, status: 'ready', errorMessage: null };
  }

  // last is number
  if (last === '0') {
    tokens[tokens.length - 1] = digit; // replace leading 0
  } else if (last === '-0') {
    tokens[tokens.length - 1] = `-${digit}`;
  } else {
    tokens[tokens.length - 1] = last + digit;
  }

  return { ...state, tokens, status: 'ready', errorMessage: null };
}

function applyDecimal(state) {
  // If prior was error, start "0."
  if (state.status === 'error') {
    return { state: { tokens: ['0.'], status: 'ready', errorMessage: null } };
  }

  // If prior was result, start new expression with "0."
  if (state.status === 'result') {
    return { state: { tokens: ['0.'], status: 'ready', errorMessage: null } };
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (isOperatorToken(last)) {
    tokens.push('0.');
    return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
  }

  // last is number
  if (last.includes('.')) {
    return {
      state: { ...state, tokens, status: 'error', errorMessage: 'Malformed number' },
      error: { code: 'MALFORMED_EXPRESSION', message: 'Multiple decimals in a number' },
    };
  }

  tokens[tokens.length - 1] = last + '.';
  return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
}

function applyOperator(state, operator) {
  const opToken = operatorToToken(operator);
  if (!opToken) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Unknown operator' },
      error: { code: 'UNKNOWN_INPUT', message: 'Unknown operator' },
    };
  }

  // If we are in error, operator cannot apply (user should clear or start over with digits).
  if (state.status === 'error') {
    return {
      state,
      error: { code: 'MALFORMED_EXPRESSION', message: 'Operator not allowed after error' },
    };
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  // If last action was "result", we allow continuing from the result.
  // This is naturally handled because tokens already contain a single number.
  // If last token is operator, replace it (avoid malformed "1 + *").
  if (isOperatorToken(last)) {
    tokens[tokens.length - 1] = opToken;
    return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
  }

  // Validate last number isn't a dangling decimal like "1."
  if (isNumberToken(last) && last.endsWith('.')) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Malformed number' },
      error: { code: 'MALFORMED_EXPRESSION', message: 'Number cannot end with decimal point' },
    };
  }

  tokens.push(opToken);
  return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
}

function operatorToToken(operator) {
  switch (operator) {
    case 'ADD':
      return '+';
    case 'SUB':
      return '-';
    case 'MUL':
      return '*';
    case 'DIV':
      return '/';
    default:
      return null;
  }
}

function evaluateEqual(state) {
  if (state.status === 'error') {
    return { state };
  }

  // Expression must end with a number
  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (tokens.length === 0) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Malformed expression' },
      error: { code: 'MALFORMED_EXPRESSION', message: 'Empty expression' },
    };
  }

  if (isOperatorToken(last)) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Malformed expression' },
      error: { code: 'MALFORMED_EXPRESSION', message: 'Expression cannot end with operator' },
    };
  }

  if (isNumberToken(last) && last.endsWith('.')) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Malformed number' },
      error: { code: 'MALFORMED_EXPRESSION', message: 'Number cannot end with decimal point' },
    };
  }

  const parsed = parseTokens(tokens);
  if (!parsed.ok) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Malformed expression' },
      error: { code: 'MALFORMED_EXPRESSION', message: parsed.message },
    };
  }

  const evalResult = evalWithPrecedence(parsed.numbers, parsed.ops);
  if (!evalResult.ok) {
    return {
      state: {
        ...state,
        status: 'error',
        errorMessage:
          evalResult.code === 'DIVIDE_BY_ZERO' ? 'Divide by zero' : 'Malformed expression',
      },
      error: { code: evalResult.code, message: evalResult.message },
    };
  }

  const formatted = formatNumberForToken(evalResult.value);
  return {
    state: {
      tokens: [formatted],
      status: 'result',
      errorMessage: null,
    },
  };
}

function parseTokens(tokens) {
  // Expect alternating: number, op, number, op, number...
  if (tokens.length % 2 === 0) {
    return { ok: false, message: 'Token sequence length must be odd' };
  }

  const numbers = [];
  const ops = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (i % 2 === 0) {
      if (!isNumberToken(t)) return { ok: false, message: `Expected number at position ${i}` };
      const normalized = normalizeNumberString(t);
      const n = Number(normalized);
      if (!Number.isFinite(n)) return { ok: false, message: `Invalid number: ${t}` };
      numbers.push(n);
    } else {
      if (!isOperatorToken(t)) return { ok: false, message: `Expected operator at position ${i}` };
      ops.push(t);
    }
  }

  return { ok: true, numbers, ops };
}

function normalizeNumberString(s) {
  // Normalize ".5" -> "0.5", "-.5" -> "-0.5"
  if (s.startsWith('-.')) return `-0${s.slice(1)}`;
  if (s.startsWith('.')) return `0${s}`;
  return s;
}

function evalWithPrecedence(numbers, ops) {
  // Shunting-yard-lite for two-level precedence (*,/ before +,-) without parentheses.
  // Work on copies to preserve purity.
  const nums = numbers.slice();
  const opers = ops.slice();

  // First pass: handle * and /
  for (let i = 0; i < opers.length; ) {
    const op = opers[i];
    if (op === '*' || op === '/') {
      const a = nums[i];
      const b = nums[i + 1];

      if (op === '/' && b === 0) {
        return { ok: false, code: 'DIVIDE_BY_ZERO', message: 'Attempted division by zero' };
      }

      const val = op === '*' ? a * b : a / b;

      // Replace a,b with val
      nums.splice(i, 2, val);
      opers.splice(i, 1);
      // Do not increment i; next operator shifts into current position.
    } else {
      i += 1;
    }
  }

  // Second pass: handle + and -
  let acc = nums[0];
  for (let i = 0; i < opers.length; i++) {
    const op = opers[i];
    const b = nums[i + 1];
    if (op === '+') acc += b;
    else if (op === '-') acc -= b;
    else return { ok: false, code: 'MALFORMED_EXPRESSION', message: `Unexpected operator: ${op}` };
  }

  // Avoid -0
  if (Object.is(acc, -0)) acc = 0;

  return { ok: true, value: acc };
}

function formatNumberForToken(n) {
  // Keep it simple and stable:
  // - Integers displayed without decimals
  // - Non-integers: strip trailing zeros
  if (!Number.isFinite(n)) return 'Error';

  const isInt = Number.isInteger(n);
  if (isInt) return String(n);

  // Use a reasonable precision to avoid 0.30000000000000004
  const rounded = Number(n.toPrecision(12));
  let s = String(rounded);

  // Convert scientific notation to decimal-ish if possible (rare for this calculator scope)
  if (s.includes('e') || s.includes('E')) {
    // Fallback: keep JS default; UI may show scientific notation.
    return s;
  }

  // Strip trailing zeros in decimals
  if (s.includes('.')) {
    s = s.replace(/(\.\d*?[1-9])0+$/u, '$1');
    s = s.replace(/\.0+$/u, '');
  }

  return s;
}
