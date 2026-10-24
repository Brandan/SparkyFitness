import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import type { PlannedMealItem } from '@workspace/shared';
import PlannedMealsSection from '../../src/components/PlannedMealsSection';

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../src/components/FoodImageSourceProvider', () => ({
  useFoodImageSourceContext: () => (path: string) => ({
    uri: `https://sparky.test${path}`,
    headers: {},
  }),
}));

const mockAdd = jest.fn();
const mockSkip = jest.fn();
const mockRestore = jest.fn();
jest.mock('../../src/hooks/usePlannedMeals', () => ({
  usePlannedMealMutations: () => ({
    addPlannedMealAsync: mockAdd,
    skipPlannedMealAsync: mockSkip,
    restorePlannedMealAsync: mockRestore,
    isPending: false,
  }),
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

describe('PlannedMealsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when nothing is planned', () => {
    const { toJSON } = render(
      <PlannedMealsSection items={[]} date="2026-10-24" />
    );
    expect(toJSON()).toBeNull();
  });

  it('shows the planned meal with the foods inside it', () => {
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    expect(getByText('Planned')).toBeTruthy();
    expect(getByText('Breakfast')).toBeTruthy();
    expect(getByText('Eggs 2 large · Sausage 2 link')).toBeTruthy();
    expect(getByText('Add to diary')).toBeTruthy();
  });

  it('shows the calories Add to diary will write', () => {
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    expect(getByText(/1 serving · 420 kcal/)).toBeTruthy();
    expect(getByText('+420 kcal')).toBeTruthy();
    expect(getByText('+420 kcal planned')).toBeTruthy();
  });

  it('groups planned foods by meal and totals each meal and the day', () => {
    const lunch: PlannedMealItem = {
      ...item,
      item_key: 'meal:type:lunch:',
      meal_type_id: '44444444-4444-4444-8444-444444444444',
      meal_type_name: 'Lunch',
      name: 'Salad',
      calories: 180,
      foods: [],
    };
    const { getByText } = render(
      <PlannedMealsSection items={[item, lunch]} date="2026-10-24" />
    );

    expect(getByText('Breakfast')).toBeTruthy();
    expect(getByText('Lunch')).toBeTruthy();
    expect(getByText('+420 kcal')).toBeTruthy();
    expect(getByText('+180 kcal')).toBeTruthy();
    expect(getByText('+600 kcal planned')).toBeTruthy();
  });

  it('leaves calories out when they are not known', () => {
    const { queryByText } = render(
      <PlannedMealsSection
        items={[{ ...item, calories: null }]}
        date="2026-10-24"
      />
    );

    expect(queryByText(/kcal/)).toBeNull();
  });

  it('adds the item and offers undo with the created ids', async () => {
    mockAdd.mockResolvedValue({
      food_entry_ids: ['e1', 'e2'],
      food_entry_meal_ids: ['m1'],
    });
    mockRestore.mockResolvedValue(undefined);
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Add to diary'));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(target));
    await waitFor(() => expect(Toast.show).toHaveBeenCalled());
    const toast = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(toast.text1).toBe('Added Eggs and sausage to Breakfast');

    toast.props.action.onPress();
    await waitFor(() =>
      expect(mockRestore).toHaveBeenCalledWith({
        ...target,
        food_entry_ids: ['e1', 'e2'],
        food_entry_meal_ids: ['m1'],
      })
    );
  });

  it('skips the item for this day without adding anything', async () => {
    mockSkip.mockResolvedValue(undefined);
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Skip'));

    await waitFor(() => expect(mockSkip).toHaveBeenCalledWith(target));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('says so when adding fails, and does not offer undo', async () => {
    mockAdd.mockRejectedValue(new Error('offline'));
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Add to diary'));

    await waitFor(() => expect(Toast.show).toHaveBeenCalled());
    const toast = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(toast.type).toBe('error');
    expect(toast.props).toBeUndefined();
  });

  it('shows the picture of a planned item that has one', () => {
    const { getByTestId } = render(
      <PlannedMealsSection
        items={[{ ...item, images: ['/uploads/foods/eggs.jpg'] }]}
        date="2026-10-24"
      />
    );

    expect(getByTestId('food-thumbnail')).toBeTruthy();
  });

  it('shows no picture slot when the item has none', () => {
    const { queryByTestId } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    expect(queryByTestId('food-thumbnail')).toBeNull();
  });

  it('adds every planned item with one tap and offers a single undo', async () => {
    mockAdd
      .mockResolvedValueOnce({
        food_entry_ids: ['e1'],
        food_entry_meal_ids: ['m1'],
      })
      .mockResolvedValueOnce({
        food_entry_ids: ['e2'],
        food_entry_meal_ids: [],
      });
    mockRestore.mockResolvedValue(undefined);
    const second = { ...item, item_key: 'meal:type:other:', name: 'Toast' };
    const { getByText } = render(
      <PlannedMealsSection items={[item, second]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Add all 2 to diary'));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(Toast.show).toHaveBeenCalled());
    const toast = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(toast.text1).toBe('Added 2 items to your diary');

    toast.props.action.onPress();
    await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(2));
    expect(mockRestore).toHaveBeenNthCalledWith(1, {
      ...target,
      food_entry_ids: ['e1'],
      food_entry_meal_ids: ['m1'],
    });
  });

  it('says which item failed when Add all stops part way', async () => {
    mockAdd
      .mockResolvedValueOnce({
        food_entry_ids: ['e1'],
        food_entry_meal_ids: [],
      })
      .mockRejectedValueOnce(new Error('offline'));
    const second = { ...item, item_key: 'meal:type:other:', name: 'Toast' };
    const { getByText } = render(
      <PlannedMealsSection items={[item, second]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Add all 2 to diary'));

    await waitFor(() => expect(Toast.show).toHaveBeenCalled());
    const toasts = (Toast.show as jest.Mock).mock.calls;
    expect(toasts).toHaveLength(1);
    expect(toasts[0][0].text1).toBe('Added 1 of 2 to your diary');
    expect(toasts[0][0].text2).toBe("Couldn't add Toast. Try again.");
  });

  it('does not offer Add all for a single item', () => {
    const { queryByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    expect(queryByText(/Add all/)).toBeNull();
  });
});
