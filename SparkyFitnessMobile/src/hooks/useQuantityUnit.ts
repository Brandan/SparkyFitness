import { useCallback, useMemo, useState } from 'react';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';
import {
  canonicalQuantityUnit,
  convertQuantity,
  quantityUnitChoices,
  quantityUnitStep,
  roundQuantity,
} from '../utils/quantityUnits';

export interface QuantityStepperHandlers {
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

interface UseQuantityUnitOptions {
  /** The unit the entry's quantity is stored in (the chosen variant's serving unit). */
  baseUnit: string | null | undefined;
  /** The quantity as the screen holds it, in `baseUnit`. */
  baseQuantityText: string;
  setBaseQuantityText: (text: string) => void;
  /** Goes back to the food's own unit whenever this changes (a reused sheet showing another entry). */
  resetKey?: string;
}

/**
 * Lets a quantity be typed in a different unit than the food's own (ounces for
 * a food measured in grams). The screen keeps holding and saving the quantity
 * in the variant's unit; this only converts at the input edge, so nothing
 * about the entry or its nutrition changes. Switching units re-expresses the
 * same amount, and picking another serving variant puts it back on that
 * variant's own unit.
 */
export function useQuantityUnit({
  baseUnit,
  baseQuantityText,
  setBaseQuantityText,
  resetKey,
}: UseQuantityUnitOptions) {
  const base = baseUnit ? canonicalQuantityUnit(baseUnit) : '';
  const choices = useMemo(() => quantityUnitChoices(baseUnit), [baseUnit]);
  const [selected, setSelected] = useState<{ base: string; unit: string }>();
  // Text mid-edit in the converted unit, so "1." is not rewritten to "1" under the cursor.
  const [draft, setDraft] = useState<string | null>(null);

  // Back to the food's own unit when the base unit or the entry changes. Done
  // while rendering rather than in an effect so no render shows the old pick.
  const resetToken = `${base}\u0000${resetKey ?? ''}`;
  const [seenResetToken, setSeenResetToken] = useState(resetToken);
  if (seenResetToken !== resetToken) {
    setSeenResetToken(resetToken);
    setSelected(undefined);
    setDraft(null);
  }

  const unit =
    selected && selected.base === base && choices.includes(selected.unit)
      ? selected.unit
      : base;
  const isConverted = unit !== base;

  const selectUnit = useCallback(
    (next: string) => {
      setDraft(null);
      setSelected({ base, unit: next });
    },
    [base]
  );

  const toBaseText = useCallback(
    (value: number) =>
      String(roundQuantity(convertQuantity(value, unit, base))),
    [base, unit]
  );

  const displayText = useMemo(() => {
    if (draft !== null) return draft;
    const baseQuantity = parseDecimalInput(baseQuantityText);
    return Number.isFinite(baseQuantity)
      ? String(roundQuantity(convertQuantity(baseQuantity, base, unit)))
      : baseQuantityText;
  }, [base, baseQuantityText, draft, unit]);

  const step = useCallback(
    (delta: number) => {
      const current = parseDecimalInput(displayText);
      const value = Number.isFinite(current) ? current : 0;
      const increment = quantityUnitStep(unit);
      const boundary =
        delta > 0
          ? Math.ceil(value / increment) * increment
          : Math.floor(value / increment) * increment;
      const next = boundary !== value ? boundary : value + delta * increment;
      setDraft(null);
      setBaseQuantityText(toBaseText(Math.max(increment, next)));
    },
    [displayText, setBaseQuantityText, toBaseText, unit]
  );

  /** Stepper props: the screen's own handlers when entering in the food's unit, converting ones otherwise. */
  const getStepperProps = (
    native: QuantityStepperHandlers
  ): QuantityStepperHandlers & { value: string } => {
    if (!isConverted) return { value: baseQuantityText, ...native };
    return {
      value: displayText,
      onChangeText: (text) => {
        if (!DECIMAL_INPUT_REGEX.test(text)) return;
        setDraft(text);
        const parsed = parseDecimalInput(text);
        setBaseQuantityText(Number.isFinite(parsed) ? toBaseText(parsed) : '');
      },
      onBlur: () => {
        setDraft(null);
        native.onBlur?.();
      },
      onIncrement: () => step(1),
      onDecrement: () => step(-1),
    };
  };

  return { choices, unit, isConverted, selectUnit, getStepperProps };
}
