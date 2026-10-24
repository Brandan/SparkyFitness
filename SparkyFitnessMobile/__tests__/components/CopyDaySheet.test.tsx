import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import CopyDaySheet, {
  type CopyDaySheetRef,
} from '../../src/components/CopyDaySheet';
import i18n, { initializeI18n } from '../../src/localization/i18n';

const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const renderSheet = (itemCounts: number[], onCopy = jest.fn()) => {
  const ref = createRef<CopyDaySheetRef>();
  const view = render(
    <CopyDaySheet ref={ref} dayNames={dayNames} onCopy={onCopy} />
  );
  act(() => ref.current?.present(0, itemCounts));
  return { view, onCopy };
};

describe('CopyDaySheet', () => {
  beforeEach(async () => {
    await initializeI18n('en');
    await i18n.changeLanguage('en');
  });

  it('starts with every empty day selected, so one tap copies to the week', () => {
    const { view, onCopy } = renderSheet([4, 0, 0, 0, 0, 0, 0]);

    expect(view.getByText('Copy Sunday to')).toBeTruthy();
    fireEvent.press(view.getByText('Copy to 6 days'));

    expect(onCopy).toHaveBeenCalledWith(0, [1, 2, 3, 4, 5, 6]);
  });

  it('leaves days that already have items unselected and says they would be replaced', () => {
    const { view } = renderSheet([4, 3, 0, 0, 0, 0, 0]);

    expect(view.getByText('Replaces 3 items')).toBeTruthy();
    expect(
      view.getByRole('checkbox', { name: 'Monday' }).props.accessibilityState
        .checked
    ).toBe(false);
    expect(view.getByText('Copy to 5 days')).toBeTruthy();
  });

  it('copies to exactly the days picked', () => {
    const { view, onCopy } = renderSheet([4, 3, 0, 0, 0, 0, 0]);

    fireEvent.press(view.getByRole('checkbox', { name: 'Monday' }));
    fireEvent.press(view.getByRole('checkbox', { name: 'Tuesday' }));
    fireEvent.press(view.getByText('Copy to 5 days'));

    expect(onCopy).toHaveBeenCalledWith(0, [3, 4, 5, 6, 1]);
  });

  it('cannot copy when no day is picked', () => {
    const { view, onCopy } = renderSheet([4, 0, 0, 0, 0, 0, 0]);

    fireEvent.press(view.getByText('Clear'));
    fireEvent.press(view.getByText('Copy to 0 days'));

    expect(onCopy).not.toHaveBeenCalled();
  });
});
