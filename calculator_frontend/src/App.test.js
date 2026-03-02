import {
  createInitialCalculatorState,
  getCalculatorDisplay,
  transitionCalculator,
} from './calculatorEngine';

function applySequence(inputs) {
  return inputs.reduce((s, input) => transitionCalculator(s, input).state, createInitialCalculatorState());
}

test('divide-by-zero puts calculator into deterministic error state', () => {
  const finalState = applySequence([
    { type: 'digit', digit: '8' },
    { type: 'operator', operator: 'DIV' },
    { type: 'digit', digit: '0' },
    { type: 'equal' },
  ]);

  expect(finalState.status).toBe('error');
  expect(getCalculatorDisplay(finalState)).toMatch(/divide by zero/i);
});

test('after error: digit starts fresh, decimal starts 0., clear resets, backspace resets', () => {
  const errorState = applySequence([
    { type: 'digit', digit: '1' },
    { type: 'operator', operator: 'DIV' },
    { type: 'digit', digit: '0' },
    { type: 'equal' },
  ]);
  expect(errorState.status).toBe('error');

  const afterDigit = transitionCalculator(errorState, { type: 'digit', digit: '7' }).state;
  expect(afterDigit.status).toBe('ready');
  expect(getCalculatorDisplay(afterDigit)).toBe('7');

  const afterDecimal = transitionCalculator(errorState, { type: 'decimal' }).state;
  expect(afterDecimal.status).toBe('ready');
  expect(getCalculatorDisplay(afterDecimal)).toBe('0.');

  const afterBackspace = transitionCalculator(errorState, { type: 'backspace' }).state;
  expect(afterBackspace.status).toBe('ready');
  expect(getCalculatorDisplay(afterBackspace)).toBe('0');

  const afterClear = transitionCalculator(errorState, { type: 'clear' }).state;
  expect(afterClear.status).toBe('ready');
  expect(getCalculatorDisplay(afterClear)).toBe('0');
});

test('repeated operators are replaced (no malformed sequences like 1 + * 2)', () => {
  const s = applySequence([
    { type: 'digit', digit: '1' },
    { type: 'operator', operator: 'ADD' },
    { type: 'operator', operator: 'MUL' }, // replaces +
    { type: 'digit', digit: '2' },
    { type: 'equal' },
  ]);

  expect(s.status).toBe('result');
  expect(getCalculatorDisplay(s)).toBe('2'); // 1 * 2
});

test('equals on incomplete expression yields error (1 + =)', () => {
  const s = applySequence([
    { type: 'digit', digit: '1' },
    { type: 'operator', operator: 'ADD' },
    { type: 'equal' },
  ]);

  expect(s.status).toBe('error');
  expect(getCalculatorDisplay(s)).toMatch(/malformed/i);
});

test('repeated equals repeats last operation deterministically', () => {
  // 2 + 3 = => 5; then "=" => 8; then "=" => 11
  const s1 = applySequence([
    { type: 'digit', digit: '2' },
    { type: 'operator', operator: 'ADD' },
    { type: 'digit', digit: '3' },
    { type: 'equal' },
  ]);
  expect(getCalculatorDisplay(s1)).toBe('5');

  const s2 = transitionCalculator(s1, { type: 'equal' }).state;
  expect(getCalculatorDisplay(s2)).toBe('8');

  const s3 = transitionCalculator(s2, { type: 'equal' }).state;
  expect(getCalculatorDisplay(s3)).toBe('11');
});

test('multiple decimals in one number yields deterministic malformed-number error', () => {
  const s = applySequence([
    { type: 'digit', digit: '1' },
    { type: 'decimal' },
    { type: 'digit', digit: '2' },
    { type: 'decimal' },
  ]);

  expect(s.status).toBe('error');
  expect(getCalculatorDisplay(s)).toMatch(/malformed/i);
});
