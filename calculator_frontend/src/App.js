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

// PUBLIC_INTERFACE
function App() {
  /** Engine-owned calculator state. */
  const [calcState, setCalcState] = useState(() => createInitialCalculatorState());

  /** Local UI error (optional): we primarily rely on engine's display/status. */
  const displayValue = useMemo(() => getCalculatorDisplay(calcState), [calcState]);

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
        <section aria-label="Calculator display" style={{ width: 'min(360px, 92vw)' }}>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Display"
            // Visual styling will be handled in later CSS updates; this ensures usable layout now.
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '16px 14px',
              textAlign: 'right',
              fontSize: 28,
              fontWeight: 600,
              minHeight: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            <span style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayValue}
            </span>
          </div>

          {/* Keypad */}
          <div
            aria-label="Calculator keypad"
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
            }}
          >
            {/* Row 1 (3 buttons) */}
            {BUTTON_ROWS[0].map((b) => (
              <button
                key={b.key}
                type="button"
                aria-label={b.ariaLabel}
                onClick={() => applyInput(b.input)}
                style={{
                  gridColumn: b.key === 'clear' ? 'span 2' : 'auto',
                  padding: '14px 12px',
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--button-bg)',
                  color: 'var(--button-text)',
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}

            {/* Fill the missing 4th column in row 1 by making Clear span 2 columns */}
            {/* Remaining rows */}
            {BUTTON_ROWS.slice(1, 4).flat().map((b) => (
              <button
                key={b.key}
                type="button"
                aria-label={b.ariaLabel}
                onClick={() => applyInput(b.input)}
                style={{
                  padding: '14px 12px',
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}

            {/* Last row: make 0 span 2 columns to look like typical calculators */}
            <button
              key="0"
              type="button"
              aria-label="0"
              onClick={() => applyInput({ type: 'digit', digit: '0' })}
              style={{
                gridColumn: 'span 2',
                padding: '14px 12px',
                fontSize: 18,
                fontWeight: 700,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              0
            </button>

            <button
              key="decimal"
              type="button"
              aria-label="Decimal point"
              onClick={() => applyInput({ type: 'decimal' })}
              style={{
                padding: '14px 12px',
                fontSize: 18,
                fontWeight: 700,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              .
            </button>

            <button
              key="equal"
              type="button"
              aria-label="Equals"
              onClick={() => applyInput({ type: 'equal' })}
              style={{
                padding: '14px 12px',
                fontSize: 18,
                fontWeight: 700,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--button-bg)',
                color: 'var(--button-text)',
                cursor: 'pointer',
              }}
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
