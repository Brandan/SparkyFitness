import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DiaryScreen from '../../src/screens/DiaryScreen';
import { useDailySummary } from '../../src/hooks';
import { EMPTY_SUPPLEMENT_TOTALS } from '@workspace/shared';
import {
  createTestQueryClient,
  createQueryWrapper,
} from '../hooks/queryTestUtils';
import type { PlannedMealItem } from '@workspace/shared';

jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true }),
  useDailySummary: jest.fn(),
  useCustomNutrients: () => ({ customNutrients: [] }),
  useNutrientDisplayPreferences: () => ({ preferences: [] }),
  useMealTypes: () => ({ mealTypes: [], isLoading: false, isError: false }),
  useFamilyUsers: () => ({ data: [] }),
}));

jest.mock('../../src/hooks/useMeasurements', () => ({
  useMeasurements: () => ({ measurements: null, customMeasurements: [] }),
}));

// Sleep is settled and empty throughout: this suite is about the photo arm of the
// predicate, and an unmocked query would stay pending and hide the day behind the
// screen's loading gate.
jest.mock('../../src/hooks/useSleepDay', () => ({
  useSleepDay: () => ({
    wakeUp: null,
    naps: [],
    bedTime: null,
    isLoading: false,
    isError: false,
    isForbidden: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../src/hooks/useCheckInPhotos', () => ({
  useCheckInPhotoDates: () => ({ dates: [], isLoading: false }),
  useCheckInPhotosByDate: () => ({ photos: [], isLoading: false }),
}));

const mockPlanned = jest.fn(() => ({
  plannedMeals: [] as PlannedMealItem[],
  isLoading: false,
}));
jest.mock('../../src/hooks/usePlannedMeals', () => ({
  usePlannedMeals: () => mockPlanned(),
  usePlannedMealMutations: () => ({
    addPlannedMealAsync: jest.fn(),
    skipPlannedMealAsync: jest.fn(),
    restorePlannedMealAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('../../src/hooks/useCheckInPhotoSource', () => ({
  useCheckInPhotoSource: () => ({
    getPhotoSource: (id: string) => ({ uri: `https://x/${id}`, headers: {} }),
    isReady: true,
  }),
}));

jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: null }),
}));

jest.mock('../../src/hooks/useExerciseImageSource', () => ({
  useExerciseImageSource: () => ({ getImageSource: () => undefined }),
}));

jest.mock('../../src/hooks/useHeaderActionColors', () => ({
  useHeaderActionColors: () => ({}),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: () => false,
}));

jest.mock('../../src/stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: () => null,
}));

jest.mock('../../src/stores/diaryDateStore', () => ({
  useDiaryDateStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedDate: '2026-08-12', setSelectedDate: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
  useNavigation: () => mockNavigation,
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));

jest.mock('../../src/components/Icon', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

const mockNavigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  setParams: jest.fn(),
  getParent: jest.fn(() => undefined),
  isFocused: jest.fn(() => true),
} as never;

const mockUseDailySummary = useDailySummary as jest.MockedFunction<
  typeof useDailySummary
>;

const DATE = '2026-08-12';

const plannedItem: PlannedMealItem = {
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
  foods: [],
  images: [],
};

function emptySummary() {
  return {
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    summary: {
      date: DATE,
      calorieGoal: 0,
      caloriesConsumed: 0,
      caloriesBurned: 0,
      activeCalories: 0,
      otherExerciseCalories: 0,
      stepCalories: 0,
      exerciseMinutes: 0,
      exerciseMinutesGoal: 0,
      exerciseCaloriesGoal: 0,
      netCalories: 0,
      remainingCalories: 0,
      protein: { consumed: 0, goal: 0 },
      carbs: { consumed: 0, goal: 0 },
      fat: { consumed: 0, goal: 0 },
      fiber: { consumed: 0, goal: 0 },
      waterConsumed: 0,
      waterGoal: 2500,
      foodEntries: [],
      supplementTotals: EMPTY_SUPPLEMENT_TOTALS,
      exerciseEntries: [],
      calorieBalance: { eaten: 0, burned: 0, remaining: 0, goal: 0 },
      goals: {},
      customNutrientTotals: {},
      customNutrientGoals: {},
    },
  } as unknown as ReturnType<typeof useDailySummary>;
}

const renderDiary = () => {
  const Wrapper = createQueryWrapper(createTestQueryClient());
  return render(
    <Wrapper>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <DiaryScreen navigation={mockNavigation} route={{} as never} />
      </SafeAreaProvider>
    </Wrapper>
  );
};

/**
 * A planned meal is waiting to be added, so a day with nothing logged but something
 * planned is not empty. The Planned card lives in the non-empty branch, so a predicate
 * that ignored it hid tomorrow's plan on the phone while the web showed it.
 */
describe('DiaryScreen on a day with only planned meals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDailySummary.mockReturnValue(emptySummary());
    mockPlanned.mockReturnValue({ plannedMeals: [], isLoading: false });
  });

  it('still calls a day with nothing logged or planned empty', () => {
    renderDiary();

    expect(screen.getByText('Add Food')).toBeTruthy();
  });

  it('shows the planned meals instead of the empty illustration', () => {
    mockPlanned.mockReturnValue({
      plannedMeals: [plannedItem],
      isLoading: false,
    });
    renderDiary();

    expect(screen.queryByText('Add Food')).toBeNull();
    expect(screen.getByText('Planned')).toBeTruthy();
    expect(screen.getByText(/Eggs and sausage/)).toBeTruthy();
    expect(screen.getByText('Add to diary')).toBeTruthy();
  });

  it('does not flash the empty illustration while planned meals load', () => {
    mockPlanned.mockReturnValue({ plannedMeals: [], isLoading: true });
    renderDiary();

    expect(screen.queryByText('Add Food')).toBeNull();
  });
});
