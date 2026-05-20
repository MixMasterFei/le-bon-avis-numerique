create table if not exists public.official_press_assets (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product text,
  asset_type text not null default 'image',
  title text not null,
  source_url text not null,
  storage_url text,
  credit text not null,
  license_url text,
  terms_url text,
  terms_summary text,
  tags jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists official_press_assets_active_idx
  on public.official_press_assets(active);

create index if not exists official_press_assets_brand_idx
  on public.official_press_assets(brand);

create index if not exists official_press_assets_verified_at_idx
  on public.official_press_assets(verified_at);

create index if not exists official_press_assets_tags_gin_idx
  on public.official_press_assets using gin(tags);
