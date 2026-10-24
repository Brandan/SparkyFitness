import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CopyDayDialog from '../../pages/Foods/CopyDayDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      defaultValueOrOpts?: string | Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => {
      const template =
        typeof defaultValueOrOpts === 'string' ? defaultValueOrOpts : key;
      const values =
        typeof defaultValueOrOpts === 'object' ? defaultValueOrOpts : opts;
      return template.replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(values?.[name] ?? '')
      );
    },
  }),
}));

const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const renderDialog = (itemCounts: number[], onCopy = jest.fn()) => {
  render(
    <CopyDayDialog
      fromDay={0}
      dayNames={dayNames}
      itemCounts={itemCounts}
      onCopy={onCopy}
      onClose={jest.fn()}
    />
  );
  return onCopy;
};

describe('CopyDayDialog', () => {
  it('starts with every empty day selected, so one tap copies to the week', () => {
    const onCopy = renderDialog([4, 0, 0, 0, 0, 0, 0]);

    expect(
      screen.getByRole('button', { name: 'Copy to 6 days' })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy to 6 days' }));
    expect(onCopy).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6]);
  });

  it('leaves days that already have items unchecked and says they would be replaced', () => {
    renderDialog([4, 3, 0, 0, 0, 0, 0]);

    expect(screen.getByLabelText(/Monday/)).not.toBeChecked();
    expect(screen.getByText('Replaces 3 items')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy to 5 days' })
    ).toBeEnabled();
  });

  it('copies to exactly the days picked', () => {
    const onCopy = renderDialog([4, 3, 0, 0, 0, 0, 0]);

    fireEvent.click(screen.getByLabelText(/Monday/));
    fireEvent.click(screen.getByLabelText(/Tuesday/));
    fireEvent.click(screen.getByRole('button', { name: 'Copy to 5 days' }));

    expect(onCopy).toHaveBeenCalledWith([3, 4, 5, 6, 1]);
  });

  it('cannot copy when no day is picked', () => {
    renderDialog([4, 0, 0, 0, 0, 0, 0]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      screen.getByRole('button', { name: 'Copy to 0 days' })
    ).toBeDisabled();
  });
});
