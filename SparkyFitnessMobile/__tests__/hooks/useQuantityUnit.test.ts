import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import { useQuantityUnit } from '../../src/hooks/useQuantityUnit';

const native = {
  onChangeText: jest.fn(),
  onBlur: jest.fn(),
  onIncrement: jest.fn(),
  onDecrement: jest.fn(),
};

function setup(initialText: string, initialUnit: string) {
  return renderHook(
    ({ unit }: { unit: string }) => {
      const [text, setText] = useState(initialText);
      const quantityUnit = useQuantityUnit({
        baseUnit: unit,
        baseQuantityText: text,
        setBaseQuantityText: setText,
      });
      return { text, quantityUnit };
    },
    { initialProps: { unit: initialUnit } }
  );
}

describe('useQuantityUnit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the screen handlers through while in the food unit', () => {
    const { result } = setup('336', 'g');
    const props = result.current.quantityUnit.getStepperProps(native);

    expect(result.current.quantityUnit.isConverted).toBe(false);
    expect(props.value).toBe('336');
    expect(props.onChangeText).toBe(native.onChangeText);
    expect(props.onIncrement).toBe(native.onIncrement);
  });

  it('re-expresses the same amount when the unit changes', () => {
    const { result } = setup('336', 'g');

    act(() => result.current.quantityUnit.selectUnit('oz'));

    expect(result.current.quantityUnit.isConverted).toBe(true);
    expect(result.current.text).toBe('336');
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe(
      '11.85'
    );
  });

  it('stores typed ounces as grams', () => {
    const { result } = setup('336', 'g');
    act(() => result.current.quantityUnit.selectUnit('oz'));

    act(() =>
      result.current.quantityUnit.getStepperProps(native).onChangeText('12')
    );

    expect(result.current.text).toBe('340.19');
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe(
      '12'
    );
    expect(native.onChangeText).not.toHaveBeenCalled();
  });

  it('keeps a partial entry like "1." under the cursor until blur', () => {
    const { result } = setup('100', 'g');
    act(() => result.current.quantityUnit.selectUnit('oz'));

    act(() =>
      result.current.quantityUnit.getStepperProps(native).onChangeText('1.')
    );
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe(
      '1.'
    );

    act(() => result.current.quantityUnit.getStepperProps(native).onBlur?.());
    expect(native.onBlur).toHaveBeenCalledTimes(1);
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe('1');
  });

  it('ignores characters the decimal field rejects', () => {
    const { result } = setup('100', 'g');
    act(() => result.current.quantityUnit.selectUnit('oz'));

    act(() =>
      result.current.quantityUnit.getStepperProps(native).onChangeText('abc')
    );

    expect(result.current.text).toBe('100');
  });

  it('steps in the entry unit', () => {
    const { result } = setup('336', 'g');
    act(() => result.current.quantityUnit.selectUnit('oz'));

    act(() =>
      result.current.quantityUnit.getStepperProps(native).onIncrement()
    );
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe(
      '12'
    );

    act(() =>
      result.current.quantityUnit.getStepperProps(native).onDecrement()
    );
    expect(result.current.quantityUnit.getStepperProps(native).value).toBe(
      '11.5'
    );
  });

  it('goes back to the food unit when the serving variant changes', () => {
    const { result, rerender } = setup('336', 'g');
    act(() => result.current.quantityUnit.selectUnit('oz'));

    rerender({ unit: 'cup' });

    expect(result.current.quantityUnit.unit).toBe('cup');
    expect(result.current.quantityUnit.isConverted).toBe(false);
  });

  it('offers no units for quantity-style foods', () => {
    const { result } = setup('1', 'serving');

    expect(result.current.quantityUnit.choices).toEqual([]);
    expect(result.current.quantityUnit.isConverted).toBe(false);
  });
});
