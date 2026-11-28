import '@testing-library/jest-dom';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../test-utils';
import { FoodImagePicker } from '@/components/FoodSearch/FoodImagePicker';
import {
  downloadFoodImage,
  searchFoodImages,
} from '@/api/Foods/foodImageSearch';

jest.mock('@/api/Foods/foodImageSearch', () => ({
  searchFoodImages: jest.fn(),
  downloadFoodImage: jest.fn(),
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

beforeAll(() => {
  // jsdom has no object URLs; the picker previews staged files with them.
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FoodImagePicker web search', () => {
  it('has no web search unless a query is given', () => {
    renderWithClient(<FoodImagePicker items={[]} onItemsChange={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Search the web' })
    ).not.toBeInTheDocument();
  });

  it("searches the food's name and stages the picked image", async () => {
    mockSearch.mockResolvedValue({ status: 'ok', results: [result] });
    const file = new File(['x'], 'web-image.jpg', { type: 'image/jpeg' });
    mockDownload.mockResolvedValue(file);
    const onItemsChange = jest.fn();

    renderWithClient(
      <FoodImagePicker
        items={[]}
        onItemsChange={onItemsChange}
        webSearchQuery="Acme apple"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search the web' }));

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Acme apple'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Use image from example.com' })
    );

    await waitFor(() =>
      expect(onItemsChange).toHaveBeenCalledWith([
        expect.objectContaining({ kind: 'new', file }),
      ])
    );
    expect(mockDownload.mock.calls[0]?.[0]).toEqual(result);
    await waitFor(() =>
      expect(
        screen.queryByText('Search the web for a photo')
      ).not.toBeInTheDocument()
    );
  });

  it('keeps the dialog open and says so when an image cannot be fetched', async () => {
    mockSearch.mockResolvedValue({ status: 'ok', results: [result] });
    mockDownload.mockRejectedValue(new Error('502'));
    const onItemsChange = jest.fn();

    renderWithClient(
      <FoodImagePicker
        items={[]}
        onItemsChange={onItemsChange}
        webSearchQuery="apple"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search the web' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Use image from example.com' })
    );

    expect(
      await screen.findByText("Couldn't get that image. Pick another one.")
    ).toBeInTheDocument();
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it('explains how to set it up when there is no key', async () => {
    mockSearch.mockResolvedValue({ status: 'not_configured' });
    renderWithClient(
      <FoodImagePicker items={[]} onItemsChange={jest.fn()} webSearchQuery="" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search the web' }));

    // Nothing to search yet: no request until words are typed.
    expect(screen.getByText('Type what to search for.')).toBeInTheDocument();
    expect(mockSearch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Search for'), {
      target: { value: 'banana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Web image search is not set up')
    ).toBeInTheDocument();
    // Jest's Trans renders the link text beside the <a>, so check each part.
    expect(
      screen.getByText(/Settings › External Providers/)
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        'a[href="/settings?section=food-and-exercise-data-providers"]'
      )
    ).toHaveAttribute('target', '_blank');
  });

  it('searching again does not submit the food form around the picker', async () => {
    mockSearch.mockResolvedValue({ status: 'ok', results: [result] });
    const onFormSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    renderWithClient(
      <form onSubmit={onFormSubmit}>
        <FoodImagePicker
          items={[]}
          onItemsChange={jest.fn()}
          webSearchQuery="apple"
        />
      </form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search the web' }));
    fireEvent.change(screen.getByLabelText('Search for'), {
      target: { value: 'green apple' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('green apple'));
    expect(onFormSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Search the web for a photo')).toBeInTheDocument();
  });
});
