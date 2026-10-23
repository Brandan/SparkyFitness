import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { format } from 'date-fns';
import CopyFoodEntryDialog from '@/pages/Diary/CopyFoodEntryDialog';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    formatDateInUserTimezone: (date: Date, formatStr: string) =>
      jest.requireActual('date-fns').format(date, formatStr),
    loggingLevel: 'SILENT',
  }),
}));
jest.mock('@/hooks/Diary/useMealTypes', () => ({
  useMealTypes: () => ({
    data: [
      { id: 'm1', name: 'Lunch' },
      { id: 'm2', name: 'Dinner' },
    ],
  }),
}));

const noop = () => {};

describe('CopyFoodEntryDialog for a single item', () => {
  it('names the item and copies to its own day and meal in one click', () => {
    const onCopy = jest.fn();
    render(
      <CopyFoodEntryDialog
        isOpen
        onClose={noop}
        onCopy={onCopy}
        sourceMealType="Lunch"
        itemName="Banana"
        initialDate="2026-10-12"
      />
    );

    expect(screen.getByText('Copy Banana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledWith('2026-10-12', 'Lunch');
  });

  it('offers Today when the item is from another day and copies to today', () => {
    const onCopy = jest.fn();
    render(
      <CopyFoodEntryDialog
        isOpen
        onClose={noop}
        onCopy={onCopy}
        sourceMealType="Lunch"
        itemName="Banana"
        initialDate="2020-01-02"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledWith(
      format(new Date(), 'yyyy-MM-dd'),
      'Lunch'
    );
  });

  it('hides Today when the item is already from today', () => {
    render(
      <CopyFoodEntryDialog
        isOpen
        onClose={noop}
        onCopy={jest.fn()}
        sourceMealType="Lunch"
        itemName="Banana"
        initialDate={format(new Date(), 'yyyy-MM-dd')}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Today' })
    ).not.toBeInTheDocument();
  });

  it('keeps the meal-level dialog unchanged', () => {
    render(
      <CopyFoodEntryDialog
        isOpen
        onClose={noop}
        onCopy={jest.fn()}
        sourceMealType="Lunch"
      />
    );

    expect(screen.getByText('Copy Food Entries')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Today' })
    ).not.toBeInTheDocument();
  });
});
