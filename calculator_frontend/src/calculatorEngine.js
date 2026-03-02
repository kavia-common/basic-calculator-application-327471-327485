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
 * - Determinism:
 *   - No side effects (no DOM, no storage, no Date, no randomness)
 *   - Same {state,input} => same output always
 *
 * Error-state rules (deterministic guardrails):
 * - When status === 'error':
 *   - digit or decimal: starts a fresh expression (clears error) with that input
 *   - clear: resets to initial
 *   - backspace: resets to initial (common calc behavior)
 *   - operator/equal: no-op (state unchanged) and returns an error object (predictable)
 *
 * Operator/equals rules:
 * - Repeated operators: last operator is replaced (e.g., "1 + *" becomes "1 *")
 * - Equals requires a complete expression:
 *   - "1 +" then "=" => error (malformed expression)
 *   - "=" on a single number:
 *       - if lastEqual exists (from a previous evaluation), repeats it (e.g., "2 + 3 =" gives 5, then "=" gives 8)
 *       - otherwise no-op (keeps current number as result)
 *
 * Display:
 * - status === 'error': display errorMessage
 * - otherwise: tokens joined by spaces
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
 *   errorMessage: string|null,
 *   lastEqual: null | { op: string, rhs: number }
 * }} CalculatorState
 *
 * Invariants:
 * - tokens represent an expression of the form: number (operator number)*
 * - operators are one of '+', '-', '*', '/'
 * - numbers are strings like "12", "0.5", "0.", ".5" (".5" normalized at parse time)
 * - In ready mode:
 *   - tokens never empty
 *   - tokens never contains two operators in a row (operators are replaced)
 * - In result mode:
 *   - tokens is a single formatted number token (the result)
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
    lastEqual: null,
  };
}

/**
 * PUBLIC_INTERFACE
 * Convert engine state to a display string.
 * @param {CalculatorState} state
 * @returns {string}
 */
export function getCalculatorDisplay(state) {
  const safe = normalizeState(state);
  if (safe.status === 'error') {
    return safe.errorMessage || 'Error';
  }
  if (!safe.tokens || safe.tokens.length === 0) return '0';
  return safe.tokens.join(' ');
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

  // Centralized error-state gating: only some inputs are allowed to recover.
  if (safeState.status === 'error') {
    return transitionFromErrorState(safeState, input);
  }

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
      return toError(safeState, 'UNKNOWN_INPUT', 'Unknown input');
  }
}

/* ----------------------- Internal helpers (pure) ----------------------- */

function normalizeState(state) {
  const fallback = createInitialCalculatorState();
  if (!state || !Array.isArray(state.tokens)) return fallback;

  const status = state.status === 'result' || state.status === 'error' ? state.status : 'ready';
  const tokens = state.tokens.length > 0 ? state.tokens.slice() : ['0'];

  // Normalize lastEqual shape.
  const lastEqual =
    state.lastEqual && typeof state.lastEqual === 'object'
      ? {
          op: typeof state.lastEqual.op === 'string' ? state.lastEqual.op : '',
          rhs: Number(state.lastEqual.rhs),
        }
      : null;

  return {
    tokens,
    status,
    errorMessage: status === 'error' ? state.errorMessage || 'Error' : null,
    lastEqual: lastEqual && OPERATORS.has(lastEqual.op) && Number.isFinite(lastEqual.rhs) ? lastEqual : null,
  };
}

function transitionFromErrorState(state, input) {
  switch (input?.type) {
    case 'clear':
      return { state: createInitialCalculatorState() };
    case 'backspace':
      return { state: createInitialCalculatorState() };
    case 'digit':
      // Digit starts fresh after error.
      return { state: applyDigit({ ...createInitialCalculatorState(), status: 'ready' }, input.digit) };
    case 'decimal':
      // Decimal starts fresh after error as "0."
      return { state: { tokens: ['0.'], status: 'ready', errorMessage: null, lastEqual: null } };
    case 'operator':
      return {
        state,
        error: { code: 'MALFORMED_EXPRESSION', message: 'Operator not allowed after error; clear or start with a digit' },
      };
    case 'equal':
      return {
        state,
        error: { code: 'MALFORMED_EXPRESSION', message: 'Equals not allowed after error; clear or start with a digit' },
      };
    default:
      return toError(state, 'UNKNOWN_INPUT', 'Unknown input');
  }
}

function toError(state, code, message, displayMessage) {
  return {
    state: {
      ...state,
      status: 'error',
      errorMessage: displayMessage || message,
      lastEqual: null,
    },
    error: { code, message },
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
  // If result, backspace behaves like clear-to-0.
  if (state.status === 'result') {
    return createInitialCalculatorState();
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  // If last is operator, remove it.
  if (isOperatorToken(last)) {
    tokens.pop();
    if (tokens.length === 0) tokens.push('0');
    return { ...state, tokens, status: 'ready', errorMessage: null };
  }

  // last is number
  const updated = last.slice(0, -1);

  if (updated.length === 0 || updated === '-' || updated === '.' || updated === '-.') {
    tokens.pop();

    // If expression becomes empty, reset to 0.
    if (tokens.length === 0) tokens.push('0');

    // If we popped a number and now last is operator, remove dangling operator too.
    if (tokens.length > 0 && isOperatorToken(tokens[tokens.length - 1])) {
      tokens.pop();
      if (tokens.length === 0) tokens.push('0');
    }
  } else {
    tokens[tokens.length - 1] = updated;
  }

  return { ...state, tokens, status: 'ready', errorMessage: null };
}

function applyDigit(state, digit) {
  if (!isDigitChar(digit)) {
    // Treat as malformed expression rather than unknown input, because UI only sends valid digits.
    return {
      ...state,
      status: 'error',
      errorMessage: 'Malformed input',
      lastEqual: null,
    };
  }

  // If prior was result, digit starts a new expression.
  if (state.status === 'result') {
    return { tokens: [digit], status: 'ready', errorMessage: null, lastEqual: null };
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
  } else {
    tokens[tokens.length - 1] = last + digit;
  }

  return { ...state, tokens, status: 'ready', errorMessage: null };
}

function applyDecimal(state) {
  // If prior was result, start new expression with "0."
  if (state.status === 'result') {
    return { state: { tokens: ['0.'], status: 'ready', errorMessage: null, lastEqual: null } };
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (isOperatorToken(last)) {
    tokens.push('0.');
    return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
  }

  // last is number
  if (last.includes('.')) {
    return toError(
      { ...state, tokens },
      'MALFORMED_EXPRESSION',
      'Multiple decimals in a number',
      'Malformed number'
    );
  }

  tokens[tokens.length - 1] = last + '.';
  return { state: { ...state, tokens, status: 'ready', errorMessage: null } };
}

function applyOperator(state, operator) {
  const opToken = operatorToToken(operator);
  if (!opToken) {
    return toError(state, 'UNKNOWN_INPUT', 'Unknown operator', 'Unknown operator');
  }

  // If we are in result, we are continuing from a single result token.
  // (If lastEqual exists, we keep it: operator changes the expression and ends the repeat-equals chain.)
  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  // Replace repeated operators deterministically.
  if (isOperatorToken(last)) {
    tokens[tokens.length - 1] = opToken;
    return { state: { ...state, tokens, status: 'ready', errorMessage: null, lastEqual: null } };
  }

  // Validate last number isn't a dangling decimal like "1."
  if (isNumberToken(last) && last.endsWith('.')) {
    return toError(
      state,
      'MALFORMED_EXPRESSION',
      'Number cannot end with decimal point',
      'Malformed number'
    );
  }

  tokens.push(opToken);
  return { state: { ...state, tokens, status: 'ready', errorMessage: null, lastEqual: null } };
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
  // If user hits "=" right after getting a result, we optionally repeat the last operation.
  if (state.status === 'result') {
    return evaluateRepeatEqual(state);
  }

  const tokens = state.tokens.slice();
  const last = tokens[tokens.length - 1];

  if (tokens.length === 0) {
    return toError(state, 'MALFORMED_EXPRESSION', 'Empty expression', 'Malformed expression');
  }

  // "=" on a single number in ready mode:
  // - if we have a lastEqual, allow repeating it (rare but can happen if caller mutated status)
  // - otherwise treat it as "confirm" and switch to result.
  if (tokens.length === 1 && isNumberToken(last)) {
    if (isNumberToken(last) && last.endsWith('.')) {
      return toError(state, 'MALFORMED_EXPRESSION', 'Number cannot end with decimal point', 'Malformed number');
    }

    if (state.lastEqual) {
      // Repeat previous operation from current number.
      return evaluateRepeatEqual({ ...state, status: 'result' });
    }

    return {
      state: {
        tokens: [normalizeNumberTokenForResult(last)],
        status: 'result',
        errorMessage: null,
        lastEqual: null,
      },
    };
  }

  // Expression must end with a number.
  if (isOperatorToken(last)) {
    return toError(state, 'MALFORMED_EXPRESSION', 'Expression cannot end with operator', 'Malformed expression');
  }

  if (isNumberToken(last) && last.endsWith('.')) {
    return toError(state, 'MALFORMED_EXPRESSION', 'Number cannot end with decimal point', 'Malformed number');
  }

  const parsed = parseTokens(tokens);
  if (!parsed.ok) {
    return toError(state, 'MALFORMED_EXPRESSION', parsed.message, 'Malformed expression');
  }

  const evalResult = evalWithPrecedence(parsed.numbers, parsed.ops);
  if (!evalResult.ok) {
    return {
      state: {
        ...state,
        status: 'error',
        errorMessage: evalResult.code === 'DIVIDE_BY_ZERO' ? 'Divide by zero' : 'Malformed expression',
        lastEqual: null,
      },
      error: { code: evalResult.code, message: evalResult.message },
    };
  }

  const formatted = formatNumberForToken(evalResult.value);

  // Store "repeat equals" payload from the last binary operation in the expression:
  // expression: a op b op c ... => after evaluation, repeating "=" applies (lastOp, lastRhs) to current result.
  const lastOp = parsed.ops[parsed.ops.length - 1] || null;
  const lastRhs = parsed.numbers[parsed.numbers.length - 1];
  const lastEqual = lastOp ? { op: lastOp, rhs: lastRhs } : null;

  return {
    state: {
      tokens: [formatted],
      status: 'result',
      errorMessage: null,
      lastEqual,
    },
  };
}

function evaluateRepeatEqual(state) {
  // Deterministic repeated "=" behavior:
  // - If we have lastEqual => apply it to current value.
  // - Otherwise => no-op.
  const tokens = state.tokens.slice();
  const only = tokens[0];

  const currentToken = typeof only === 'string' && only.length ? only : '0';
  const currentParsed = Number(normalizeNumberString(currentToken));
  if (!Number.isFinite(currentParsed)) {
    return toError(state, 'MALFORMED_EXPRESSION', 'Invalid current result', 'Malformed expression');
  }

  if (!state.lastEqual) {
    // No repeat operation captured; keep as-is.
    return {
      state: { ...state, tokens: [formatNumberForToken(currentParsed)], status: 'result', errorMessage: null },
    };
  }

  const { op, rhs } = state.lastEqual;

  if (op === '/' && rhs === 0) {
    return {
      state: { ...state, status: 'error', errorMessage: 'Divide by zero', lastEqual: null },
      error: { code: 'DIVIDE_BY_ZERO', message: 'Attempted division by zero' },
    };
  }

  const nextValue = applyBinaryOp(currentParsed, op, rhs);
  if (!Number.isFinite(nextValue)) {
    return toError(state, 'MALFORMED_EXPRESSION', 'Non-finite result', 'Malformed expression');
  }

  return {
    state: {
      tokens: [formatNumberForToken(nextValue)],
      status: 'result',
      errorMessage: null,
      lastEqual: state.lastEqual,
    },
  };
}

function applyBinaryOp(a, op, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    default:
      return NaN;
  }
}

function normalizeNumberTokenForResult(tok) {
  // Ensure result token isn't something like ".5" or "-.5" (engine accepts it, but results should be normalized).
  const normalizedStr = normalizeNumberString(tok);
  const n = Number(normalizedStr);
  if (!Number.isFinite(n)) return '0';
  return formatNumberForToken(n);
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
