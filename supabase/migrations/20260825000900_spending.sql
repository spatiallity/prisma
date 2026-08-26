-- ============================================================================
-- 0009 — Cost side: cash ledger, personnel cost, vendor payment (Section 25.6)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- cash_ledger — kas kecil mess (Section 25.6.1)
--
-- Section 4.3 / 25.6.1: the running balance is NEVER a stored input. It is a
-- window function over this table, exposed by v_cash_ledger (migration 0011),
-- so a back-dated correction cannot leave the ledger out of balance the way
-- the manual Excel did.
-- ---------------------------------------------------------------------------
create table cash_ledger (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null,
  pic_user_id  uuid references users(id),
  pic_name     text,
  category_id  uuid references cash_ledger_categories(id),
  description  text,
  amount_out   numeric(18,2) not null default 0 check (amount_out >= 0),
  amount_in    numeric(18,2) not null default 0 check (amount_in >= 0),
  -- Optional: filled when the cost belongs to one SPK, left NULL for general
  -- overhead such as mess electricity/wifi (Section 26.3).
  spk_id       uuid references spks(id),
  reference    text,
  file_id      uuid references files(id),
  status       record_status not null default 'Active',
  notes        text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cash_ledger_direction check (
    (amount_out > 0 and amount_in = 0) or (amount_in > 0 and amount_out = 0)
  )
);

comment on table cash_ledger is
  'Section 25.6.1 — daily petty cash. Top-ups are amount_in, spending is amount_out.';
comment on column cash_ledger.spk_id is
  'NULL = project overhead (Section 26.3), not counted in per-SPK margin.';

create index cash_ledger_date_idx on cash_ledger(entry_date);
create index cash_ledger_spk_idx on cash_ledger(spk_id);
create index cash_ledger_category_idx on cash_ledger(category_id);

create trigger cash_ledger_set_updated_at
  before update on cash_ledger
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- personnel_costs (Section 25.6.2)
-- ---------------------------------------------------------------------------
create table personnel_costs (
  id           uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references personnel(id),
  cost_type    personnel_cost_type not null,
  -- Month of validity for salary, specific date for MCU / honor.
  period       date not null,
  amount       numeric(18,2) not null check (amount >= 0),
  spk_id       uuid references spks(id),
  description  text,
  file_id      uuid references files(id),
  status       record_status not null default 'Active',
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table personnel_costs is
  'Section 25.6.2 — salary / MCU / honor. spk_id usually NULL (team overhead).';

create index personnel_costs_personnel_idx on personnel_costs(personnel_id);
create index personnel_costs_period_idx on personnel_costs(period);
create index personnel_costs_spk_idx on personnel_costs(spk_id);

create trigger personnel_costs_set_updated_at
  before update on personnel_costs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- vendor_payments (Section 25.6.3) — always tied to one SPK
-- ---------------------------------------------------------------------------
create table vendor_payments (
  id                uuid primary key default gen_random_uuid(),
  spk_id            uuid not null references spks(id),
  vendor_id         uuid not null references vendors(id),
  contract_value    numeric(18,2) not null check (contract_value >= 0),
  agreed_percentage numeric(6,2) not null check (agreed_percentage >= 0 and agreed_percentage <= 100),
  -- Section 25.6.3 — computed, never entered.
  vendor_payable    numeric(18,2) generated always as (
    round(contract_value * agreed_percentage / 100.0, 2)
  ) stored,
  -- Derived from vendor_payment_terms when terms exist (see trigger below).
  amount_paid       numeric(18,2) not null default 0 check (amount_paid >= 0),
  status            vendor_payment_status not null default 'Belum Dibayar',
  notes             text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (spk_id, vendor_id)
);

comment on table vendor_payments is
  'Section 25.6.3 — borongan payable = SPK contract value x agreed percentage.';

create index vendor_payments_spk_idx on vendor_payments(spk_id);
create index vendor_payments_vendor_idx on vendor_payments(vendor_id);

create trigger vendor_payments_set_updated_at
  before update on vendor_payments
  for each row execute function set_updated_at();

-- Status is derived, not typed. vendor_payable is a generated column and is
-- not yet populated inside a BEFORE trigger, so recompute it here.
create or replace function set_vendor_payment_status()
returns trigger
language plpgsql
as $fn$
declare
  v_payable numeric := round(new.contract_value * new.agreed_percentage / 100.0, 2);
begin
  new.status := case
    when new.amount_paid <= 0 then 'Belum Dibayar'::vendor_payment_status
    when new.amount_paid >= v_payable then 'Lunas'::vendor_payment_status
    else 'Sebagian'::vendor_payment_status
  end;
  return new;
end;
$fn$;

create trigger vendor_payments_derive_status
  before insert or update on vendor_payments
  for each row execute function set_vendor_payment_status();

-- ---------------------------------------------------------------------------
-- vendor_payment_terms — DP / Progress / Final instalments (Section 25.6.3)
-- ---------------------------------------------------------------------------
create table vendor_payment_terms (
  id                uuid primary key default gen_random_uuid(),
  vendor_payment_id uuid not null references vendor_payments(id),
  term_type         vendor_payment_term_type not null,
  sequence          int not null default 1,
  amount            numeric(18,2) not null check (amount >= 0),
  due_date          date,
  paid_date         date,
  reference         text,
  file_id           uuid references files(id),
  status            record_status not null default 'Active',
  notes             text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (vendor_payment_id, term_type, sequence)
);

comment on table vendor_payment_terms is
  'Section 25.6.3 — instalment detail. A term counts as paid once paid_date is set.';

create index vendor_payment_terms_parent_idx on vendor_payment_terms(vendor_payment_id);
create index vendor_payment_terms_due_idx on vendor_payment_terms(due_date);

create trigger vendor_payment_terms_set_updated_at
  before update on vendor_payment_terms
  for each row execute function set_updated_at();

-- Roll paid instalments up into vendor_payments.amount_paid.
create or replace function refresh_vendor_payment_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_parent uuid;
  v_rows   int;
  v_paid   numeric;
begin
  -- NEW is unassigned on DELETE, so pick the record explicitly.
  if tg_op = 'DELETE' then
    v_parent := old.vendor_payment_id;
  else
    v_parent := new.vendor_payment_id;
  end if;

  select count(*), coalesce(sum(amount) filter (where paid_date is not null), 0)
  into v_rows, v_paid
  from vendor_payment_terms
  where vendor_payment_id = v_parent
    and status = 'Active';

  -- With no instalment rows, amount_paid stays whatever was entered directly.
  if v_rows > 0 then
    update vendor_payments
    set amount_paid = v_paid,
        updated_at  = now()
    where id = v_parent;
  end if;

  return null;
end;
$fn$;

create trigger vendor_payment_terms_refresh_paid
  after insert or update or delete on vendor_payment_terms
  for each row execute function refresh_vendor_payment_paid();
