-- Issue #721: retain every legacy R2 media locator while adding direct-BYOS
-- locators. Existing clients continue to write and read r2 records through the
-- existing storage_path contract; new clients write the additive columns.

ALTER TABLE public.media_asset
  ADD COLUMN storage_kind text NOT NULL DEFAULT 'r2',
  ADD COLUMN byos_provider text,
  ADD COLUMN provider_file_id text,
  ADD COLUMN public_url text,
  ADD COLUMN locator_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT media_asset_storage_kind_check
    CHECK (storage_kind IN ('r2', 'byos')),
  ADD CONSTRAINT media_asset_byos_locator_check
    CHECK (
      (storage_kind = 'r2' AND byos_provider IS NULL AND provider_file_id IS NULL)
      OR
      (
        storage_kind = 'byos'
        AND byos_provider IN ('google-drive', 'dropbox')
        AND provider_file_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT media_asset_locator_version_check
    CHECK (locator_version >= 1);

CREATE UNIQUE INDEX media_asset_byos_provider_file_id_key
  ON public.media_asset (byos_provider, provider_file_id)
  WHERE storage_kind = 'byos';

COMMENT ON COLUMN public.media_asset.storage_path IS
  'Legacy R2 object key for r2 records; unique synthetic BYOS locator for byos records. Existing R2 values are retained indefinitely.';
COMMENT ON COLUMN public.media_asset.storage_kind IS
  'Versioned media locator kind: r2 for permanent Worker reads or byos for browser-direct provider files.';
COMMENT ON COLUMN public.media_asset.byos_provider IS
  'BYOS provider identifier (google-drive or dropbox). Never contains an account identity.';
COMMENT ON COLUMN public.media_asset.provider_file_id IS
  'Opaque provider file identifier for a BYOS locator. Never contains credentials.';
COMMENT ON COLUMN public.media_asset.public_url IS
  'Optional provider-managed public URL cached in private synced metadata. It is a bearer-style link, never a token.';
COMMENT ON COLUMN public.media_asset.locator_version IS
  'Version of the polymorphic media locator contract.';
