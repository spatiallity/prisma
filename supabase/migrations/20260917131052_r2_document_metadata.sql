-- Binary documents live in Cloudflare R2. Supabase remains the audited,
-- RLS-protected catalogue that maps each private object to its SPK.
comment on table public.files is
  'Metadata for private Cloudflare R2 objects. Binary content lives in R2 at storage_path.';
