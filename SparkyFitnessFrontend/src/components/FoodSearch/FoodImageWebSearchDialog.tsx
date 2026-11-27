import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Loader2, Search } from 'lucide-react';
import type { FoodImageSearchResult } from '@workspace/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useDownloadFoodImage,
  useFoodImageSearch,
} from '@/hooks/Foods/useFoodImageSearch';

// Settings opens on the provider list, in a new tab so the food form here
// keeps what has been typed.
const PROVIDER_SETTINGS_URL =
  '/settings?section=food-and-exercise-data-providers';

interface FoodImageWebSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What to search for first, usually the food's brand and name. */
  initialQuery: string;
  /** Called with the downloaded image; the dialog then closes. */
  onImagePicked: (file: File) => void;
}

/**
 * Searches the web for a food photo and hands the picked one back as a File,
 * so the picker stages it exactly like a photo chosen from disk.
 */
export function FoodImageWebSearchDialog({
  open,
  onOpenChange,
  initialQuery,
  onImagePicked,
}: FoodImageWebSearchDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [pickingUrl, setPickingUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // Each opening starts from the food's current name, and searches it at once:
  // opening the dialog is the request to search.
  useEffect(() => {
    if (open) {
      setDraft(initialQuery);
      setSubmitted(initialQuery.trim());
      setPickingUrl(null);
      setPickError(null);
    }
  }, [open, initialQuery]);

  const search = useFoodImageSearch(open ? submitted : '');
  const download = useDownloadFoodImage();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPickError(null);
    setSubmitted(draft.trim());
  };

  const handlePick = async (result: FoodImageSearchResult) => {
    if (pickingUrl) return;
    setPickingUrl(result.url);
    setPickError(null);
    try {
      const file = await download.mutateAsync(result);
      onImagePicked(file);
      onOpenChange(false);
    } catch {
      setPickError(
        t(
          'food.webImageSearch.pickFailed',
          "Couldn't get that image. Pick another one."
        )
      );
    } finally {
      setPickingUrl(null);
    }
  };

  const data = search.data;
  const results = data?.status === 'ok' ? data.results : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t('food.webImageSearch.title', 'Search the web for a photo')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'food.webImageSearch.description',
              'Pick a photo to add it to this food.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t(
              'food.webImageSearch.placeholder',
              'Food name and brand'
            )}
            aria-label={t('food.webImageSearch.queryLabel', 'Search for')}
            maxLength={200}
            autoFocus
          />
          <Button type="submit" disabled={draft.trim().length === 0}>
            <Search className="h-4 w-4 mr-2" />
            {t('food.webImageSearch.search', 'Search')}
          </Button>
        </form>

        {pickError && (
          <p role="alert" className="text-sm text-destructive">
            {pickError}
          </p>
        )}

        <div className="min-h-[12rem] overflow-y-auto -mx-1 px-1">
          {submitted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('food.webImageSearch.enterWords', 'Type what to search for.')}
            </p>
          ) : search.isLoading ? (
            <div
              className="py-12 flex justify-center text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="sr-only">
                {t('food.webImageSearch.searching', 'Searching…')}
              </span>
            </div>
          ) : search.isError ? (
            <div className="py-8 text-center space-y-3">
              <p role="alert" className="text-sm text-destructive">
                {search.error instanceof Error && search.error.message
                  ? search.error.message
                  : t(
                      'food.webImageSearch.searchFailed',
                      'Image search failed. Try again.'
                    )}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void search.refetch()}
              >
                {t('food.webImageSearch.tryAgain', 'Try again')}
              </Button>
            </div>
          ) : data?.status === 'not_configured' ? (
            <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">
                {t(
                  'food.webImageSearch.notConfiguredTitle',
                  'Web image search is not set up'
                )}
              </p>
              <p>
                <Trans
                  i18nKey="food.webImageSearch.notConfiguredBody"
                  defaults="Add a Brave Search API key in <link>Settings › External Providers</link>, then search again."
                  components={{
                    link: (
                      <a
                        href={PROVIDER_SETTINGS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      />
                    ),
                  }}
                />
              </p>
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t(
                'food.webImageSearch.noResults',
                'No images found. Try other words.'
              )}
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((result) => {
                const picking = pickingUrl === result.url;
                return (
                  <li key={result.url}>
                    <button
                      type="button"
                      onClick={() => void handlePick(result)}
                      disabled={pickingUrl !== null}
                      aria-label={t('food.webImageSearch.useImage', {
                        defaultValue: 'Use image from {{source}}',
                        source: result.source || result.title,
                      })}
                      className="group w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-md bg-muted ring-1 ring-border group-hover:ring-2 group-hover:ring-primary">
                        <img
                          src={result.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className={`h-full w-full object-cover ${
                            pickingUrl !== null && !picking ? 'opacity-50' : ''
                          }`}
                        />
                        {picking && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {result.source}
                        {result.width && result.height
                          ? ` · ${result.width}×${result.height}`
                          : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {results.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t(
              'food.webImageSearch.attribution',
              'Results from Brave Search. Check you may use a photo before sharing it.'
            )}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
