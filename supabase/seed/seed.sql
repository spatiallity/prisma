-- ============================================================================
-- Seed — reference data that the application cannot function without.
-- Idempotent: safe to re-run.
--
-- Run with:  supabase db reset            (local, picks up supabase/seed.sql)
--        or: psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
--        or: paste into the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles (Section 5)
-- ---------------------------------------------------------------------------
insert into roles (code, name, description) values
  ('operational',    'Operational',        'SPK, vendor, assignment, schedule, routing, progress. Financial view only.'),
  ('administration', 'Administration',     'Nilai kontrak, opname, PAD, invoice, payment, spending.'),
  ('drafter',        'Drafter',            'Detail SPK dan modul desain.'),
  ('project_manager','Project Manager',    'Monitoring luas termasuk margin. Bukan operator utama.'),
  ('kabid_biu',      'Kabid BIU Cabang',   'Full monitoring seluruh informasi project.'),
  ('dukbis',         'Bidang Dukbis Cabang','Contract sampai payment dan spending.'),
  ('vendor',         'Vendor Jasa Survey', 'Terbatas pada SPK yang ditugaskan. Tanpa akses financial.')
on conflict (code) do update
  set name = excluded.name, description = excluded.description;

-- ---------------------------------------------------------------------------
-- Permissions — full module x action catalogue
-- ---------------------------------------------------------------------------
insert into permissions (module, action)
select m, a
from unnest(enum_range(null::app_module)) m
cross join unnest(enum_range(null::app_action)) a
on conflict (module, action) do nothing;

-- ---------------------------------------------------------------------------
-- Role permissions — a direct transcription of the Section 6 matrix.
--   scope 'all'     → every record
--   scope 'own'     → only the user's own / their vendor's records
--   scope 'limited' → reduced field set ("View terbatas", vendor dashboard)
-- ---------------------------------------------------------------------------
with matrix(role_code, module, action, scope) as (
  values
  -- Operational ------------------------------------------------------------
  ('operational','dashboard','view','all'), ('operational','dashboard','edit','all'),
  ('operational','spk','view','all'), ('operational','spk','create','all'), ('operational','spk','edit','all'),
  ('operational','vendor','view','all'), ('operational','vendor','edit','all'), ('operational','vendor','create','all'),
  ('operational','schedule','view','all'), ('operational','schedule','edit','all'),
  ('operational','daily_plan','view','all'), ('operational','daily_plan','edit','all'), ('operational','daily_plan','create','all'),
  ('operational','daily_progress','view','all'), ('operational','daily_progress','edit','all'), ('operational','daily_progress','create','all'),
  ('operational','progress','view','all'), ('operational','progress','edit','all'), ('operational','progress','create','all'),
  ('operational','design','view','all'),
  ('operational','routing','view','all'), ('operational','routing','edit','all'), ('operational','routing','create','all'),
  ('operational','contract','view','all'),
  ('operational','opname','view','all'),
  ('operational','pad','view','all'),
  ('operational','invoice','view','all'),
  ('operational','payment','view','all'),
  ('operational','spending','view','all'),
  ('operational','report','view','all'),
  ('operational','master_data','view','all'),
  ('operational','audit_log','view','all'),

  -- Administration ---------------------------------------------------------
  ('administration','dashboard','view','all'),
  ('administration','spk','view','all'), ('administration','spk','create','all'), ('administration','spk','edit','all'),
  ('administration','vendor','view','all'),
  ('administration','schedule','view','all'),
  ('administration','daily_plan','view','all'),
  ('administration','daily_progress','view','all'),
  ('administration','progress','view','all'),
  ('administration','design','view','all'),
  ('administration','routing','view','all'),
  ('administration','contract','view','all'), ('administration','contract','edit','all'), ('administration','contract','create','all'),
  ('administration','opname','view','all'),   ('administration','opname','edit','all'),   ('administration','opname','create','all'),
  ('administration','pad','view','all'),      ('administration','pad','edit','all'),      ('administration','pad','create','all'),
  ('administration','invoice','view','all'),  ('administration','invoice','edit','all'),  ('administration','invoice','create','all'),
  ('administration','payment','view','all'),  ('administration','payment','edit','all'),  ('administration','payment','create','all'),
  ('administration','spending','view','all'), ('administration','spending','edit','all'), ('administration','spending','create','all'),
  ('administration','margin','view','all'),
  ('administration','report','view','all'),
  ('administration','master_data','view','all'), ('administration','master_data','edit','all'), ('administration','master_data','create','all'),
  ('administration','user_management','view','all'), ('administration','user_management','edit','all'), ('administration','user_management','create','all'),
  ('administration','audit_log','view','all'),

  -- Drafter ----------------------------------------------------------------
  ('drafter','dashboard','view','all'),
  ('drafter','spk','view','all'), ('drafter','spk','edit','limited'),
  ('drafter','schedule','view','all'),
  ('drafter','daily_plan','view','all'),
  ('drafter','daily_progress','view','all'),
  ('drafter','progress','view','all'), ('drafter','progress','edit','all'),
  ('drafter','design','view','all'), ('drafter','design','edit','all'), ('drafter','design','create','all'),
  ('drafter','routing','view','all'),
  ('drafter','contract','view','all'),
  ('drafter','opname','view','all'),
  ('drafter','report','view','all'),
  ('drafter','master_data','view','all'),
  ('drafter','audit_log','view','all'),

  -- Project Manager --------------------------------------------------------
  ('project_manager','dashboard','view','all'),
  ('project_manager','spk','view','all'),
  ('project_manager','vendor','view','all'),
  ('project_manager','schedule','view','all'),
  ('project_manager','daily_plan','view','all'),
  ('project_manager','daily_progress','view','all'),
  ('project_manager','progress','view','all'),
  ('project_manager','design','view','all'),
  ('project_manager','routing','view','all'),
  ('project_manager','contract','view','all'),
  ('project_manager','opname','view','all'),
  ('project_manager','pad','view','all'),
  ('project_manager','invoice','view','all'),
  ('project_manager','payment','view','all'),
  ('project_manager','spending','view','all'),
  ('project_manager','margin','view','all'),
  ('project_manager','report','view','all'),
  ('project_manager','master_data','view','all'),
  ('project_manager','audit_log','view','all'),

  -- Kabid BIU Cabang — full monitoring ------------------------------------
  ('kabid_biu','dashboard','view','all'),
  ('kabid_biu','spk','view','all'),
  ('kabid_biu','vendor','view','all'),
  ('kabid_biu','schedule','view','all'),
  ('kabid_biu','daily_plan','view','all'),
  ('kabid_biu','daily_progress','view','all'),
  ('kabid_biu','progress','view','all'),
  ('kabid_biu','design','view','all'),
  ('kabid_biu','routing','view','all'),
  ('kabid_biu','contract','view','all'),
  ('kabid_biu','opname','view','all'),
  ('kabid_biu','pad','view','all'),
  ('kabid_biu','invoice','view','all'),
  ('kabid_biu','payment','view','all'),
  ('kabid_biu','spending','view','all'),
  ('kabid_biu','margin','view','all'),
  ('kabid_biu','report','view','all'),
  ('kabid_biu','master_data','view','all'),
  ('kabid_biu','audit_log','view','all'),

  -- Bidang Dukbis Cabang ---------------------------------------------------
  ('dukbis','dashboard','view','all'),
  ('dukbis','spk','view','all'),
  ('dukbis','vendor','view','all'),
  ('dukbis','schedule','view','all'),
  ('dukbis','progress','view','all'),
  ('dukbis','design','view','all'),
  ('dukbis','routing','view','all'),
  ('dukbis','contract','view','all'), ('dukbis','contract','edit','all'), ('dukbis','contract','create','all'),
  ('dukbis','opname','view','all'),   ('dukbis','opname','edit','all'),   ('dukbis','opname','create','all'),
  ('dukbis','pad','view','all'),      ('dukbis','pad','edit','all'),      ('dukbis','pad','create','all'),
  ('dukbis','invoice','view','all'),  ('dukbis','invoice','edit','all'),  ('dukbis','invoice','create','all'),
  ('dukbis','payment','view','all'),  ('dukbis','payment','edit','all'),  ('dukbis','payment','create','all'),
  ('dukbis','spending','view','all'), ('dukbis','spending','edit','all'), ('dukbis','spending','create','all'),
  ('dukbis','margin','view','all'),
  ('dukbis','report','view','all'),
  ('dukbis','master_data','view','all'),
  ('dukbis','audit_log','view','all'),

  -- Vendor Jasa Survey — assigned SPK only, no financial at all ------------
  ('vendor','dashboard','view','limited'),
  ('vendor','spk','view','own'),
  ('vendor','vendor','view','own'),
  ('vendor','schedule','view','own'),
  ('vendor','daily_plan','view','own'),  ('vendor','daily_plan','edit','own'),  ('vendor','daily_plan','create','own'),
  ('vendor','daily_progress','view','own'), ('vendor','daily_progress','edit','own'), ('vendor','daily_progress','create','own'),
  ('vendor','progress','view','own'),
  ('vendor','routing','view','own'),
  ('vendor','audit_log','view','own')
)
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, m.scope::permission_scope
from matrix m
join roles r on r.code = m.role_code
join permissions p on p.module = m.module::app_module and p.action = m.action::app_action
on conflict (role_id, permission_id) do update set scope = excluded.scope;

-- ---------------------------------------------------------------------------
-- Cash ledger categories (Section 28 / 42)
-- ---------------------------------------------------------------------------
insert into cash_ledger_categories (code, name, sort_order) values
  ('BBM',       'BBM',                     10),
  ('ATK',       'ATK',                     20),
  ('KONSUMSI',  'Konsumsi',                30),
  ('UTILITAS',  'Utilitas Mess',           40),
  ('KEBERSIHAN','Kebersihan & Keamanan',   50),
  ('MATERAI',   'Materai/Administrasi',    60),
  ('TRANSPORT', 'Transportasi (Tol/Grab)', 70),
  ('HSE',       'HSE Reward',              80),
  ('LAIN',      'Lain-lain',               90)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Progress Template A — SPK dengan Siteplan (Section 13, weights verbatim)
-- ---------------------------------------------------------------------------
insert into activity_templates (code, name, description) values
  ('TPL-A', 'Template A — SPK dengan Siteplan', 'Bobot sesuai Section 13 requirement V1.1.')
on conflict (code) do update set name = excluded.name;

with tpl as (select id from activity_templates where code = 'TPL-A'),
items(name, weight, measurement, unit, sequence, from_area) as (
  values
    ('Survei Pendahuluan',    10.000, 'percentage', '%',     1, false),
    ('Pemasangan BM',          5.000, 'quantity',   'titik', 2, false),
    ('Pengamatan BM',          5.000, 'quantity',   'titik', 3, false),
    ('Pengukuran Terestris',  20.000, 'area',       'Ha',    4, true),
    ('Pengolahan Data Topo',  15.000, 'percentage', '%',     5, false),
    ('Desain Siteplan',       17.000, 'stage',      null,    6, false),
    ('Finalisasi Desain',      8.000, 'stage',      null,    7, false),
    ('Stake Out',              4.000, 'quantity',   'patok', 8, false),
    ('Inventaris Lahan',       3.000, 'percentage', '%',     9, false),
    ('Cek Bersama',            3.000, 'percentage', '%',    10, false),
    ('Laporan Akhir',         10.000, 'percentage', '%',    11, false)
)
insert into activity_template_items
  (template_id, name, weight, measurement, unit, sequence, target_from_spk_area)
select tpl.id, i.name, i.weight, i.measurement::measurement_type, i.unit, i.sequence, i.from_area
from tpl, items i
on conflict (template_id, name) do update
  set weight = excluded.weight,
      measurement = excluded.measurement,
      unit = excluded.unit,
      sequence = excluded.sequence,
      target_from_spk_area = excluded.target_from_spk_area;

-- ---------------------------------------------------------------------------
-- Progress Template B — SPK tanpa Siteplan
--
-- NOTE: Section 17 requires Template B to exist but does not state its weights.
-- The design activities (17% + 8%) are dropped and the remaining nine weights
-- are scaled proportionally back up to 100%. CONFIRM these numbers with the
-- project before go-live.
-- ---------------------------------------------------------------------------
insert into activity_templates (code, name, description) values
  ('TPL-B', 'Template B — SPK tanpa Siteplan',
   'Bobot hasil penskalaan proporsional Template A tanpa aktivitas desain — perlu konfirmasi project.')
on conflict (code) do update set name = excluded.name;

with tpl as (select id from activity_templates where code = 'TPL-B'),
items(name, weight, measurement, unit, sequence, from_area) as (
  values
    ('Survei Pendahuluan',    13.333, 'percentage', '%',     1, false),
    ('Pemasangan BM',          6.667, 'quantity',   'titik', 2, false),
    ('Pengamatan BM',          6.667, 'quantity',   'titik', 3, false),
    ('Pengukuran Terestris',  26.667, 'area',       'Ha',    4, true),
    ('Pengolahan Data Topo',  20.000, 'percentage', '%',     5, false),
    ('Stake Out',              5.333, 'quantity',   'patok', 6, false),
    ('Inventaris Lahan',       4.000, 'percentage', '%',     7, false),
    ('Cek Bersama',            4.000, 'percentage', '%',     8, false),
    ('Laporan Akhir',         13.333, 'percentage', '%',     9, false)
)
insert into activity_template_items
  (template_id, name, weight, measurement, unit, sequence, target_from_spk_area)
select tpl.id, i.name, i.weight, i.measurement::measurement_type, i.unit, i.sequence, i.from_area
from tpl, items i
on conflict (template_id, name) do update
  set weight = excluded.weight,
      measurement = excluded.measurement,
      unit = excluded.unit,
      sequence = excluded.sequence,
      target_from_spk_area = excluded.target_from_spk_area;

-- ---------------------------------------------------------------------------
-- Routing template — Pertamina chain (Section 23)
--
-- NOTE: sla_days below are placeholders so bottleneck detection has something
-- to measure against. Replace with the agreed Pertamina SLA.
-- ---------------------------------------------------------------------------
insert into routing_templates (code, name, description) values
  ('RT-PERTAMINA', 'Routing Dokumen Pertamina',
   'Document Control -> GIS Engineer -> Lead GIS Engineer -> User -> Manager Engineering & Project -> Finance')
on conflict (code) do update set name = excluded.name;

with tpl as (select id from routing_templates where code = 'RT-PERTAMINA'),
steps(name, sequence, sla_days, default_pic_role) as (
  values
    ('Document Control',              1, 2.0, 'Document Control'),
    ('GIS Engineer',                  2, 3.0, 'GIS Engineer'),
    ('Lead GIS Engineer',             3, 3.0, 'Lead GIS Engineer'),
    ('User',                          4, 3.0, 'User'),
    ('Manager Engineering & Project', 5, 3.0, 'Manager Engineering & Project'),
    ('Finance',                       6, 5.0, 'Finance')
)
insert into routing_template_steps (template_id, name, sequence, sla_days, default_pic_role)
select tpl.id, s.name, s.sequence, s.sla_days, s.default_pic_role
from tpl, steps s
on conflict (template_id, sequence) do update
  set name = excluded.name,
      sla_days = excluded.sla_days,
      default_pic_role = excluded.default_pic_role;

-- ---------------------------------------------------------------------------
-- Thresholds used by bottleneck detection (Section 9)
-- ---------------------------------------------------------------------------
insert into app_settings (key, value, value_type, description) values
  ('cash_balance_threshold', '5000000', 'number', 'Saldo kas kecil minimum sebelum alert (Rp).'),
  ('vendor_update_late_days','2',       'number', 'Hari tanpa Daily Progress sebelum vendor dianggap terlambat.'),
  ('design_stage_max_days',  '7',       'number', 'Batas hari satu stage desain sebelum dianggap bottleneck.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- First administrator
--
-- Supabase Auth owns the credential, so create the login first:
--   Dashboard -> Authentication -> Users -> Add user
-- then link it here (replace both values):
--
--   insert into users (id, email, full_name, role_id)
--   select '00000000-0000-0000-0000-000000000000'::uuid,
--          'admin@example.com', 'Nama Admin', r.id
--   from roles r where r.code = 'administration';
-- ---------------------------------------------------------------------------
