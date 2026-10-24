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

    toast.onPress();
    await waitFor(() =>
      expect(mockRestore).toHaveBeenCalledWith({
        ...target,
        food_entry_ids: ['e1', 'e2'],
        food_entry_meal_ids: ['m1'],
      })
    );
  });

  it('removes the item from this day without adding anything', async () => {
    mockSkip.mockResolvedValue(undefined);
    const { getByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    fireEvent.press(getByText('Remove'));

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
    expect(toast.onPress).toBeUndefined();
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

    toast.onPress();
    await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(2));
    expect(mockRestore).toHaveBeenNthCalledWith(1, {
      ...target,
      food_entry_ids: ['e1'],
      food_entry_meal_ids: ['m1'],
    });
  });

  it('does not offer Add all for a single item', () => {
    const { queryByText } = render(
      <PlannedMealsSection items={[item]} date="2026-10-24" />
    );

    expect(queryByText(/Add all/)).toBeNull();
  });
});
