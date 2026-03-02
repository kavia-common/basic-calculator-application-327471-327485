import React, { useCallback, useMemo, useState } from 'react';
import './App.css';
import {
  createInitialCalculatorState,
  getCalculatorDisplay,
  transitionCalculator,
} from './calculatorEngine';

/**
 * Button layout for the calculator keypad.
 * We keep this definition outside render loops via useMemo in the component,
 * but having a stable structure here makes it easy to adjust later with CSS.
 */
const BUTTON_ROWS = [
  [
    { key: 'clear', label: 'C', ariaLabel: 'Clear', input: { type: 'clear' } },
    { key: 'backspace', label: '⌫', ariaLabel: 'Backspace', input: { type: 'backspace' } },
    { key: 'divide', label: '÷', ariaLabel: 'Divide', input: { type: 'operator', operator: 'DIV' } },
  ],
  [
    { key: '7', label: '7', ariaLabel: '7', input: { type: 'digit', digit: '7' } },
    { key: '8', label: '8', ariaLabel: '8', input: { type: 'digit', digit: '8' } },
    { key: '9', label: '9', ariaLabel: '9', input: { type: 'digit', digit: '9' } },
    { key: 'mul', label: '×', ariaLabel: 'Multiply', input: { type: 'operator', operator: 'MUL' } },
  ],
  [
    { key: '4', label: '4', ariaLabel: '4', input: { type: 'digit', digit: '4' } },
    { key: '5', label: '5', ariaLabel: '5', input: { type: 'digit', digit: '5' } },
    { key: '6', label: '6', ariaLabel: '6', input: { type: 'digit', digit: '6' } },
    { key: 'sub', label: '−', ariaLabel: 'Subtract', input: { type: 'operator', operator: 'SUB' } },
  ],
  [
    { key: '1', label: '1', ariaLabel: '1', input: { type: 'digit', digit: '1' } },
    { key: '2', label: '2', ariaLabel: '2', input: { type: 'digit', digit: '2' } },
    { key: '3', label: '3', ariaLabel: '3', input: { type: 'digit', digit: '3' } },
    { key: 'add', label: '+', ariaLabel: 'Add', input: { type: 'operator', operator: 'ADD' } },
  ],
  [
    { key: '0', label: '0', ariaLabel: '0', input: { type: 'digit', digit: '0' } },
    { key: 'decimal', label: '.', ariaLabel: 'Decimal point', input: { type: 'decimal' } },
    { key: 'equal', label: '=', ariaLabel: 'Equals', input: { type: 'equal' } },
  ],
];

function getButtonVariantClass(buttonKey) {
  if (buttonKey === 'clear') return 'calc-btn calc-btn--danger calc-btn--wide';
  if (buttonKey === 'backspace') return 'calc-btn calc-btn--danger';
  if (buttonKey === 'equal') return 'calc-btn calc-btn--primary';
  if (['divide', 'mul', 'sub', 'add'].includes(buttonKey)) return 'calc-btn calc-btn--operator';
  if (buttonKey === '0') return 'calc-btn calc-btn--wide';
  return 'calc-btn';
}

// PUBLIC_INTERFACE
function App() {
  /** Engine-owned calculator state. */
  const [calcState, setCalcState] = useState(() => createInitialCalculatorState());

  const displayValue = useMemo(() => getCalculatorDisplay(calcState), [calcState]);
  const hasError = calcState.status === 'error';

  const applyInput = useCallback((input) => {
    setCalcState((prev) => {
      const result = transitionCalculator(prev, input);
      return result.state;
    });
  }, []);

  /**
   * Keyboard support (non-exhaustive, but covers common calculator keys):
   * - digits 0-9
   * - + - * /
   * - Enter/=
   * - Backspace
   * - Escape (clear)
   * - . (decimal)
   */
  const handleKeyDown = useCallback(
    (e) => {
      const { key } = e;

      // Digits
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        applyInput({ type: 'digit', digit: key });
        return;
      }

      // Decimal
      if (key === '.') {
        e.preventDefault();
        applyInput({ type: 'decimal' });
        return;
      }

      // Operators
      if (key === '+') {
        e.preventDefault();
        applyInput({ type: 'operator', operator: 'ADD' });
        return;
      }
      if (key === '-') {
        e.preventDefault();
        applyInput({ type: 'operator', operator: 'SUB' });
        return;
      }
      if (key === '*') {
        e.preventDefault();
        applyInput({ type: 'operator', operator: 'MUL' });
        return;
      }
      if (key === '/') {
        e.preventDefault();
        applyInput({ type: 'operator', operator: 'DIV' });
        return;
      }

      // Evaluate
      if (key === 'Enter' || key === '=') {
        e.preventDefault();
        applyInput({ type: 'equal' });
        return;
      }

      // Backspace / Clear
      if (key === 'Backspace') {
        e.preventDefault();
        applyInput({ type: 'backspace' });
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        applyInput({ type: 'clear' });
      }
    },
    [applyInput]
  );

  return (
    <div className="App">
      {/* Main landmark for accessibility */}
      <main className="App-header" aria-label="Calculator" onKeyDown={handleKeyDown}>
        <section className="calculator" aria-label="Calculator">
          <div
            className={`calculator__display ${hasError ? 'is-error' : ''}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Display"
          >
            <div className="calculator__displayValue">{displayValue}</div>
            <div className="calculator__displayHint">
              {hasError ? 'Press C to clear' : 'Type with keyboard or tap buttons'}
            </div>
          </div>

          <div className="calculator__keypad" aria-label="Calculator keypad">
            {/* Row 1: Clear spans two columns */}
            {BUTTON_ROWS[0].map((b) => (
              <button
                key={b.key}
                type="button"
                aria-label={b.ariaLabel}
                className={getButtonVariantClass(b.key)}
                onClick={() => applyInput(b.input)}
              >
                {b.label}
              </button>
            ))}

            {/* Rows 2-4 */}
            {BUTTON_ROWS.slice(1, 4)
              .flat()
              .map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-label={b.ariaLabel}
                  className={getButtonVariantClass(b.key)}
                  onClick={() => applyInput(b.input)}
                >
                  {b.label}
                </button>
              ))}

            {/* Last row: 0 spans two columns */}
            <button
              key="0"
              type="button"
              aria-label="0"
              className={getButtonVariantClass('0')}
              onClick={() => applyInput({ type: 'digit', digit: '0' })}
            >
              0
            </button>

            <button
              key="decimal"
              type="button"
              aria-label="Decimal point"
              className={getButtonVariantClass('decimal')}
              onClick={() => applyInput({ type: 'decimal' })}
            >
              .
            </button>

            <button
              key="equal"
              type="button"
              aria-label="Equals"
              className={getButtonVariantClass('equal')}
              onClick={() => applyInput({ type: 'equal' })}
            >
              =
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
