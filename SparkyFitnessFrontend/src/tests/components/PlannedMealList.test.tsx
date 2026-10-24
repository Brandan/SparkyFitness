import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { PlannedMealItem } from '@workspace/shared';
import PlannedMealList from '../../pages/Diary/PlannedMealList';
import { renderWithClient } from '../test-utils';

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

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockAdd = jest.fn();
const mockSkip = jest.fn();
const mockRestore = jest.fn();
jest.mock('@/api/Foods/plannedMeals', () => ({
  getPlannedMeals: jest.fn(),
  addPlannedMeal: (...args: unknown[]) => mockAdd(...args),
  skipPlannedMeal: (...args: unknown[]) => mockSkip(...args),
  restorePlannedMeal: (...args: unknown[]) => mockRestore(...args),
}));

const item: PlannedMealItem = {
  template_id: '11111111-1111-4111-8111-111111111111',
  template_name: 'Daily breakfast',
  item_key: 'meal:type:meal:',
  item_type: 'meal',
  meal_type_id: '22222222-2222-4222-8222-222222222222',
  meal_type_name: 'Breakfast',
  meal_id: '33333333-3333-4333-8333-333333333333',
  food_id: null,
  variant_id: null,
  name: 'Eggs and sausage',
  brand: null,
  quantity: 1,
  unit: 'serving',
  foods: [
    { name: 'Eggs', quantity: 2, unit: 'large' },
    { name: 'Sausage', quantity: 2, unit: 'link' },
  ],
  images: [],
};

const target = {
  template_id: item.template_id,
  date: '2026-10-24',
  item_key: item.item_key,
};

const renderList = (
  items: PlannedMealItem[] = [item],
  onOpenImages?: jest.Mock
) =>
  renderWithClient(
    <PlannedMealList
      items={items}
      selectedDate="2026-10-24"
      mealName="Breakfast"
      onOpenImages={onOpenImages}
    />
  );

describe('PlannedMealList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the planned meal and the foods inside it', () => {
    renderList();

    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Eggs and sausage')).toBeInTheDocument();
    expect(
      screen.getByText('Eggs 2 large · Sausage 2 link')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add to diary' })
    ).toBeInTheDocument();
  });

  it('renders nothing when nothing is planned', () => {
    const { container } = renderList([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('adds the item to the diary and offers undo with the created ids', async () => {
    mockAdd.mockResolvedValue({
      food_entry_ids: ['e1', 'e2'],
      food_entry_meal_ids: ['m1'],
    });
    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Add to diary' }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(target));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0].title).toBe(
      'Added Eggs and sausage to Breakfast'
    );
    expect(mockToast.mock.calls[0][0].action).toBeTruthy();
  });

  it('removes the item from this day without adding anything', async () => {
    mockSkip.mockResolvedValue(undefined);
    renderList();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Eggs and sausage from this day',
      })
    );

    await waitFor(() => expect(mockSkip).toHaveBeenCalledWith(target));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('shows the picture of a planned item that has one, and opens it', () => {
    const onOpenImages = jest.fn();
    renderList(
      [{ ...item, images: ['/uploads/foods/eggs.jpg'] }],
      onOpenImages
    );

    expect(screen.getByAltText('Eggs and sausage')).toHaveAttribute(
      'src',
      '/uploads/foods/eggs.jpg'
    );
    fireEvent.click(screen.getByRole('button', { name: 'View images' }));
    expect(onOpenImages).toHaveBeenCalledWith(
      ['/uploads/foods/eggs.jpg'],
      0,
      'Eggs and sausage'
    );
  });

  it('shows no picture slot when the item has none', () => {
    renderList();

    expect(screen.queryByRole('button', { name: 'View images' })).toBeNull();
  });

  it('offers Add all only when more than one item is planned, and adds each', async () => {
    mockAdd.mockResolvedValue({
      food_entry_ids: ['e1'],
      food_entry_meal_ids: [],
    });
    const second = { ...item, item_key: 'meal:type:other:', name: 'Toast' };
    renderList([item, second]);

    fireEvent.click(screen.getByRole('button', { name: 'Add all 2 to diary' }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
    expect(mockAdd).toHaveBeenNthCalledWith(1, target);
    expect(mockAdd).toHaveBeenNthCalledWith(2, {
      ...target,
      item_key: 'meal:type:other:',
    });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0].title).toBe('Added 2 items to Breakfast');
  });

  it('does not offer Add all for a single item', () => {
    renderList();

    expect(screen.queryByRole('button', { name: /Add all/ })).toBeNull();
  });
});
