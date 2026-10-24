import React from 'react';
import { render } from '@testing-library/react-native';
import FoodResultRow from '../../../src/components/foodSearch/FoodResultRow';
import i18n, { initializeI18n } from '../../../src/localization/i18n';
import type { FoodItem } from '../../../src/types/foods';

jest.mock('../../../src/components/Icon', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

const food = (lastUsedDate: string | null): FoodItem =>
  ({
    id: 'food-1',
    name: 'Oats',
    brand: null,
    is_custom: false,
    last_used_date: lastUsedDate,
    default_variant: {
      serving_size: 40,
      serving_unit: 'g',
      calories: 150,
      protein: 5,
      carbs: 27,
      fat: 3,
    },
  }) as FoodItem;

const renderRow = (item: FoodItem) =>
  render(
    <FoodResultRow
      item={item}
      isFavorite={false}
      favoriteGold="#d4a017"
      onSelect={jest.fn()}
    />
  );

/**
 * A food last logged long ago shows the calendar date. It has to follow the app's
 * language, not the phone's, so the same row reads differently per language.
 */
describe('FoodResultRow last-logged label', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('writes an old date in the app language', async () => {
    await initializeI18n('en');
    await i18n.changeLanguage('en');
    const english = renderRow(food('2025-01-05'));
    expect(english.getByText('Last logged Jan 5, 2025')).toBeTruthy();
    english.unmount();

    await i18n.changeLanguage('de');
    const german = renderRow(food('2025-01-05'));
    expect(german.queryByText('Last logged Jan 5, 2025')).toBeNull();
    expect(german.getByText(/5\. Jan\.? 2025/)).toBeTruthy();
  });

  it('shows nothing for a food that was never logged', async () => {
    await initializeI18n('en');
    await i18n.changeLanguage('en');
    const view = renderRow(food(null));

    expect(view.queryByText(/Last logged/)).toBeNull();
  });
});
