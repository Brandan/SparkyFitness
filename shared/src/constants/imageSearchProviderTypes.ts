// The external provider that backs "Search the web" in the food image picker:
// Brave Search's image endpoint. Like the other providers, it is an
// `external_data_providers` row of this type (only an API key) that is active
// and visible to the person. Without one, the picker shows how to add it and
// nothing is sent anywhere.
export const IMAGE_SEARCH_PROVIDER_TYPE = 'brave_search';

// Where a person gets a Brave Search API key. Shown in Settings and in the
// picker when no key has been added.
export const BRAVE_SEARCH_API_KEYS_URL =
  'https://api-dashboard.search.brave.com/app/keys';
