-- ============================================================================
-- 0006 — File metadata and design management (Section 21, 22, 27, 32)
-- ============================================================================

-- Folder layout inside the Supabase Storage bucket (Section 32):
--   SPK-2026-001/{survey,design/{initial,review,revision,final},routing,report,map}
create type file_module as enum ('survey', 'design', 'routing', 'report', 'map', 'financial', 'other');

create table files (
  id           uuid primary key default gen_random_uuid(),
  spk_id       uuid references spks(id),
  module       file_module not null default 'other',
  filename     text not null,
  storage_path text not null unique,
  file_type    text,
  size_bytes   bigint,
  -- Section 22 — files are versioned, never overwritten in place.
  version      int not null default 1 check (version >= 1),
  is_final     boolean not null default false,
  description  text,
  status       record_status not null default 'Active',
  uploaded_by  uuid references users(id),
  uploaded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table files is
  'Section 32 — metadata only. Binary content lives in Supabase Storage at storage_path.';

create index files_spk_idx on files(spk_id);
create index files_module_idx on files(module);

create trigger files_set_updated_at
  before update on files
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Spatial layers (Section 27) — lightweight GeoJSON only, no PostGIS.
-- ---------------------------------------------------------------------------
create type spatial_layer_type as enum ('area', 'koridor', 'bm', 'stake_out', 'lainnya');

create table spk_spatial_layers (
  id           uuid primary key default gen_random_uuid(),
  spk_id       uuid not null references spks(id),
  name         text not null,
  layer_type   spatial_layer_type not null default 'lainnya',
  -- GeoJSON is the internal format; SHP/DXF/CSV sources are kept as files.
  geojson      jsonb,
  source_file_id uuid references files(id),
  -- Section 27 — CSV import defaults to UTM Zone 48S but must be changeable.
  source_crs   text not null default 'EPSG:32748',
  status       record_status not null default 'Active',
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table spk_spatial_layers is
  'Section 27 — light spatial layers for the Detail SPK map. No PostGIS, no raw acquisition data.';

create index spk_spatial_layers_spk_idx on spk_spatial_layers(spk_id);

create trigger spk_spatial_layers_set_updated_at
  before update on spk_spatial_layers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- designs (Section 21)
-- ---------------------------------------------------------------------------
create table designs (
  id             uuid primary key default gen_random_uuid(),
  spk_id         uuid not null references spks(id),
  title          text,
  current_stage  design_stage not null default 'Desain Awal',
  pic_id         uuid references users(id),
  target_date    date,
  approved_at    timestamptz,
  approved_by    uuid references users(id),
  final_file_id  uuid references files(id),
  status         record_status not null default 'Active',
  notes          text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table designs is
  'Section 21 — Desain Awal -> Review -> Pemaparan -> Revisi -> Finalisasi -> Approved.';

create index designs_spk_idx on designs(spk_id);
create index designs_stage_idx on designs(current_stage);

create trigger designs_set_updated_at
  before update on designs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- design_revisions — one row per stage pass (Section 21, 22)
-- ---------------------------------------------------------------------------
create table design_revisions (
  id           uuid primary key default gen_random_uuid(),
  design_id    uuid not null references designs(id),
  revision_no  int not null check (revision_no >= 0),
  stage        design_stage not null,
  pic_id       uuid references users(id),
  started_at   timestamptz,
  completed_at timestamptz,
  file_id      uuid references files(id),
  notes        text,
  status       record_status not null default 'Active',
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (design_id, revision_no, stage)
);

comment on table design_revisions is
  'Section 21/22 — status, PIC, dates, notes, file and version for every design stage.';

create index design_revisions_design_idx on design_revisions(design_id);

create trigger design_revisions_set_updated_at
  before update on design_revisions
  for each row execute function set_updated_at();

-- Keep designs.current_stage in step with the newest revision (Section 4.3).
create or replace function refresh_design_current_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_design uuid;
  v_stage  design_stage;
begin
  -- NEW is unassigned on DELETE, so pick the record explicitly.
  if tg_op = 'DELETE' then
    v_design := old.design_id;
  else
    v_design := new.design_id;
  end if;

  select dr.stage into v_stage
  from design_revisions dr
  where dr.design_id = v_design
    and dr.status = 'Active'
  order by dr.revision_no desc, dr.created_at desc
  limit 1;

  update designs
  set current_stage = coalesce(v_stage, 'Desain Awal'),
      updated_at    = now()
  where id = v_design;

  return null;
end;
$fn$;

create trigger design_revisions_refresh_stage
  after insert or update or delete on design_revisions
  for each row execute function refresh_design_current_stage();
