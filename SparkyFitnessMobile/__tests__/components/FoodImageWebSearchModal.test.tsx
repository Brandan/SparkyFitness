import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FoodImagePicker from '../../src/components/FoodImagePicker';
import {
  downloadFoodImage,
  searchFoodImages,
} from '../../src/services/api/foodImageSearchApi';

jest.mock('../../src/services/api/foodImageSearchApi', () => ({
  searchFoodImages: jest.fn(),
  downloadFoodImage: jest.fn(),
}));
jest.mock('../../src/components/FoodImageSourceProvider', () => ({
  useFoodImageSourceContext: () => () => null,
}));

const mockSearch = searchFoodImages as jest.MockedFunction<
  typeof searchFoodImages
>;
const mockDownload = downloadFoodImage as jest.MockedFunction<
  typeof downloadFoodImage
>;

const result = {
  url: 'https://cdn.example.com/apple.jpg',
  thumbnailUrl: 'https://imgs.search.brave.com/apple.jpg',
  title: 'Apple',
  source: 'example.com',
  width: 800,
  height: 600,
};

type AlertButtons = { text?: string; onPress?: () => void }[];

function renderPicker(
  props: Partial<React.ComponentProps<typeof FoodImagePicker>> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onItemsChange = jest.fn();
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <QueryClientProvider client={client}>
        <FoodImagePicker items={[]} onItemsChange={onItemsChange} {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  return { ...utils, onItemsChange };
}

/** Opens the add menu and returns the button labels it offered. */
function openAddMenu(getByTestId: (id: string) => unknown): AlertButtons {
  const alertSpy = jest.spyOn(Alert, 'alert');
  fireEvent.press(getByTestId('food-image-add') as never);
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as AlertButtons;
  alertSpy.mockRestore();
  return buttons;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FoodImagePicker web search', () => {
  it('offers Search the Web only when given a query', () => {
    const plain = renderPicker();
    expect(openAddMenu(plain.getByTestId).map((b) => b.text)).not.toContain(
      'Search the Web'
    );
    plain.unmount();

    const withSearch = renderPicker({ webSearchQuery: 'apple' });
    expect(openAddMenu(withSearch.getByTestId).map((b) => b.text)).toContain(
      'Search the Web'
    );
  });

  it("searches the food's name and stages the picked image", async () => {
    mockSearch.mockResolvedValue({ status: 'ok', results: [result] });
    mockDownload.mockResolvedValue('file:///cache/food-web-images/1/web.jpg');
    const { getByTestId, findByTestId, onItemsChange } = renderPicker({
      webSearchQuery: 'Acme apple',
    });

    const buttons = openAddMenu(getByTestId);
    buttons.find((b) => b.text === 'Search the Web')?.onPress?.();

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Acme apple'));
    fireEvent.press(await findByTestId(`food-web-image-${result.url}`));

    await waitFor(() =>
      expect(onItemsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'new',
          uri: 'file:///cache/food-web-images/1/web.jpg',
        }),
      ])
    );
  });

  it('keeps the search open and says so when the image cannot be fetched', async () => {
    mockSearch.mockResolvedValue({ status: 'ok', results: [result] });
    mockDownload.mockRejectedValue(new Error('UnableToDownload 502'));
    const { getByTestId, findByTestId, findByText, onItemsChange } =
      renderPicker({ webSearchQuery: 'apple' });

    openAddMenu(getByTestId)
      .find((b) => b.text === 'Search the Web')
      ?.onPress?.();
    fireEvent.press(await findByTestId(`food-web-image-${result.url}`));

    expect(
      await findByText("Couldn't get that image. Pick another one.")
    ).toBeTruthy();
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it('explains how to set it up when there is no key', async () => {
    mockSearch.mockResolvedValue({ status: 'not_configured' });
    const { getByTestId, findByText } = renderPicker({
      webSearchQuery: 'apple',
    });

    openAddMenu(getByTestId)
      .find((b) => b.text === 'Search the Web')
      ?.onPress?.();

    expect(await findByText('Web image search is not set up')).toBeTruthy();
  });
});
