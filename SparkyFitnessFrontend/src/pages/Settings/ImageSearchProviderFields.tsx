import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRAVE_SEARCH_API_KEYS_URL } from '@workspace/shared';
import { Trans, useTranslation } from 'react-i18next';

interface ImageSearchProviderFieldsProps {
  appKey: string | null | undefined;
  onAppKeyChange: (value: string) => void;
  idPrefix: string;
  /** Editing keeps the stored key when the field is left blank. */
  editing?: boolean;
}

/**
 * The one field of the Brave Search provider behind "Search the web" in the
 * food image picker: its API key, where to get one, and what is sent.
 */
export const ImageSearchProviderFields = ({
  appKey,
  onAppKeyChange,
  idPrefix,
  editing = false,
}: ImageSearchProviderFieldsProps) => {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}_image_search_app_key`}>
          {t(
            'settings.imageSearchProvider.apiKeyLabel',
            'Brave Search API key'
          )}
        </Label>
        <Input
          id={`${idPrefix}_image_search_app_key`}
          type="password"
          value={appKey || ''}
          onChange={(e) => onAppKeyChange(e.target.value)}
          placeholder={
            editing
              ? t(
                  'settings.imageSearchProvider.apiKeyKeepPlaceholder',
                  'Leave blank to keep the saved key'
                )
              : t(
                  'settings.imageSearchProvider.apiKeyPlaceholder',
                  'Paste your API key'
                )
          }
          autoComplete="off"
        />
      </div>
      <div className="text-sm text-muted-foreground col-span-2 space-y-1">
        <p>
          <Trans
            i18nKey="settings.imageSearchProvider.getKeyNote"
            defaults="Get a key from the <link>Brave Search API dashboard</link>."
            components={{
              link: (
                <a
                  href={BRAVE_SEARCH_API_KEYS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                />
              ),
            }}
          />
        </p>
        <p>
          {t(
            'settings.imageSearchProvider.privacyNote',
            'Adds Search the web to food photos. The words you search for are sent to Brave Search.'
          )}
        </p>
      </div>
    </>
  );
};
