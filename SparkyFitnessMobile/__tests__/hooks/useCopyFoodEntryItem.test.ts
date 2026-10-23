import { renderHook, waitFor, act } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { useCopyFoodEntryItem } from '../../src/hooks/useCopyFoodEntryItem';
import { copyFoodEntryItem } from '../../src/services/api/foodEntriesApi';
import {
  createTestQueryClient,
  createQueryWrapper,
  type QueryClient,
} from './queryTestUtils';

jest.mock('../../src/services/api/foodEntriesApi', () => ({
  copyFoodEntryItem: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

const mockCopyFoodEntryItem = copyFoodEntryItem as jest.MockedFunction<
  typeof copyFoodEntryItem
>;

const payload = {
  kind: 'foodEntry' as const,
  id: 'entry-1',
  targetDate: '2026-05-16',
  targetMealType: 'meal-type-lunch',
};

describe('useCopyFoodEntryItem', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('copies the item and refreshes the target day', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    mockCopyFoodEntryItem.mockResolvedValue(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useCopyFoodEntryItem({ onSuccess }), {
      wrapper: createQueryWrapper(queryClient),
    });

    act(() => {
      result.current.copyItem(payload);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(payload);
    });
    expect(mockCopyFoodEntryItem).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dailySummary', '2026-05-16'],
      refetchType: 'all',
    });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  test('shows an error and skips onSuccess when the copy fails', async () => {
    mockCopyFoodEntryItem.mockRejectedValue(new Error('boom'));
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useCopyFoodEntryItem({ onSuccess }), {
      wrapper: createQueryWrapper(queryClient),
    });

    act(() => {
      result.current.copyItem(payload);
    });

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
