-- Add the Brave Search provider type, used by "Search the web" in the food
-- image picker. A person (or the admin, as a global provider) adds it in
-- Settings > External Providers with only an API key, stored encrypted in
-- external_data_providers.app_key like the other providers' keys. With no such
-- provider the picker says how to add one and nothing is sent anywhere.
--
-- No new table or column, so no RLS change: external_data_providers keeps its
-- owner / public / family-share policies. Not strictly private, so an admin can
-- offer one key to everyone (is_public) and a person can share theirs through
-- share_external_providers, like the weather provider.

INSERT INTO public.external_provider_types (id, display_name, description)
VALUES (
  'brave_search',
  'Brave Search (food photos)',
  'Image search used to find a photo for a food. The words you search for are sent to Brave Search.'
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

UPDATE public.external_provider_types
SET categories = ARRAY['other'],
    required_fields = ARRAY['app_key'],
    field_labels = '{"app_key": "Brave Search API key"}'::jsonb,
    is_strictly_private = FALSE,
    supports_barcode = FALSE
WHERE id = 'brave_search';
