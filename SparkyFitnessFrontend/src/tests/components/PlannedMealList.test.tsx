import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { emptyPlannedNutrition, type PlannedMealItem } from '@workspace/shared';
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
const mockUpdate = jest.fn();
jest.mock('@/api/Foods/plannedMeals', () => ({
  updatePlannedFood: (...args: unknown[]) => mockUpdate(...args),
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
  calories: 420,
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
      energyUnit="kcal"
      convertEnergy={(value) => value}
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

  it('shows the calories Add to diary will write', () => {
    renderList();

    expect(screen.getByText(/1 serving · 420 kcal/)).toBeInTheDocument();
  });

  it('shows protein, carbs, and fat, and subtotals them', () => {
    const nutrition = {
      ...emptyPlannedNutrition(),
      calories: 86,
      protein: 1.1,
      carbs: 4.3,
      fat: 7.5,
    };
    const second: PlannedMealItem = {
      ...item,
      item_key: 'food:type:cream:v:1',
      name: 'Heavy Whipping Cream',
      calories: 99,
      foods: [],
      nutrition: {
        ...nutrition,
        calories: 99,
        protein: 2,
        carbs: 2,
        fat: 9.9,
      },
    };
    renderList([
      { ...item, name: 'MCT oil', calories: 86, foods: [], nutrition },
      second,
    ]);

    expect(screen.getByText('P: 1.1g').className).toContain('text-blue-500');
    expect(screen.getByText('C: 4.3g').className).toContain('text-green-500');
    expect(screen.getByText('F: 7.5g').className).toContain('text-yellow-500');
    expect(screen.getByText('Planned:')).toBeInTheDocument();
    expect(screen.getByText(/185 kcal/)).toBeInTheDocument();
    expect(screen.getByText('P: 3.1g')).toBeInTheDocument();
    expect(screen.getByText('C: 6.3g')).toBeInTheDocument();
    expect(screen.getByText('F: 17.4g')).toBeInTheDocument();
  });

  it('leaves calories out when they are not known', () => {
    renderList([{ ...item, calories: null }]);

    expect(screen.getByText('1 serving')).toBeInTheDocument();
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

  it('skips the item for this day without adding anything', async () => {
    mockSkip.mockResolvedValue(undefined);
    renderList();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Skip Eggs and sausage for this day',
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

  it('says which item failed when Add all stops part way', async () => {
    mockAdd
      .mockResolvedValueOnce({
        food_entry_ids: ['e1'],
        food_entry_meal_ids: [],
      })
      .mockRejectedValueOnce(new Error('boom'));
    const second = { ...item, item_key: 'meal:type:other:', name: 'Toast' };
    renderList([item, second]);

    fireEvent.click(screen.getByRole('button', { name: 'Add all 2 to diary' }));

    // The mutation's own error toast comes first; ours is the one that stays.
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(2));
    const shown = mockToast.mock.calls[1][0];
    expect(shown.title).toBe('Added 1 of 2 to Breakfast');
    expect(shown.description).toBe("Couldn't add Toast. Try again.");
  });

  it('does not offer Add all for a single item', () => {
    renderList();

    expect(screen.queryByRole('button', { name: /Add all/ })).toBeNull();
  });

  describe('a one-off planned food', () => {
    const oneOff: PlannedMealItem = {
      ...item,
      template_id: null,
      template_name: '',
      item_key: '44444444-4444-4444-8444-444444444444',
      item_type: 'food',
      meal_id: null,
      food_id: '55555555-5555-4555-8555-555555555555',
      variant_id: '66666666-6666-4666-8666-666666666666',
      name: 'Birthday cake',
      quantity: 1,
      unit: 'slice',
      foods: [],
    };

    it('is labelled one-off and can be changed', () => {
      renderList([oneOff]);
      expect(screen.getByText('Planned · one-off')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Change amount of Birthday cake' })
      ).toBeInTheDocument();
    });

    it('offers no Change button for a plan item', () => {
      renderList([item]);
      expect(screen.queryByText('Change')).not.toBeInTheDocument();
    });

    it('adds with a null template id', async () => {
      mockAdd.mockResolvedValue({
        food_entry_ids: ['e1'],
        food_entry_meal_ids: [],
      });
      renderList([oneOff]);
      fireEvent.click(screen.getByRole('button', { name: 'Add to diary' }));
      await waitFor(() =>
        expect(mockAdd).toHaveBeenCalledWith({
          template_id: null,
          date: '2026-10-24',
          item_key: oneOff.item_key,
        })
      );
    });

    it('saves a new amount', async () => {
      mockUpdate.mockResolvedValue({ ...oneOff, quantity: 2 });
      renderList([oneOff]);
      fireEvent.click(
        screen.getByRole('button', { name: 'Change amount of Birthday cake' })
      );
      const input = await screen.findByLabelText('Amount (slice)');
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith(oneOff.item_key, {
          quantity: 2,
        })
      );
    });

    it('will not save an amount of zero', async () => {
      renderList([oneOff]);
      fireEvent.click(
        screen.getByRole('button', { name: 'Change amount of Birthday cake' })
      );
      const input = await screen.findByLabelText('Amount (slice)');
      fireEvent.change(input, { target: { value: '0' } });
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByText('Enter an amount above 0.')).toBeInTheDocument();
    });
  });
});
