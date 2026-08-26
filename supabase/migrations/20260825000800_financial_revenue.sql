-- ============================================================================
-- 0008 — Revenue side: Contract -> Opname -> PAD -> Invoice -> Payment
--        (Section 25.1-25.5, 26.1)
-- ============================================================================

create table contracts (
  id                 uuid primary key default gen_random_uuid(),
  spk_id             uuid not null references spks(id),
  contract_number    text not null,
  contract_value     numeric(18,2) not null check (contract_value >= 0),
  contract_date      date,
  -- Amendments point back at the contract they amend (Section 25.1).
  amendment_no       int not null default 0 check (amendment_no >= 0),
  parent_contract_id uuid references contracts(id),
  status             financial_doc_status not null default 'Draft',
  notes              text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (spk_id, contract_number, amendment_no)
);

comment on table contracts is 'Section 25.1 — contract value and amendments per SPK.';

create index contracts_spk_idx on contracts(spk_id);

create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
create table opnames (
  id             uuid primary key default gen_random_uuid(),
  spk_id         uuid not null references spks(id),
  opname_number  text,
  opname_value   numeric(18,2) not null check (opname_value >= 0),
  opname_date    date,
  period_start   date,
  period_end     date,
  status         financial_doc_status not null default 'Draft',
  notes          text,
  file_id        uuid references files(id),
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint opnames_period_order check (
    period_start is null or period_end is null or period_end >= period_start
  )
);

comment on table opnames is 'Section 25.2 — measured work value per period.';

create index opnames_spk_idx on opnames(spk_id);

create trigger opnames_set_updated_at
  before update on opnames
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Table name kept as "pad" to match Section 28.
create table pad (
  id         uuid primary key default gen_random_uuid(),
  spk_id     uuid not null references spks(id),
  opname_id  uuid references opnames(id),
  pad_number text,
  pad_value  numeric(18,2) not null check (pad_value >= 0),
  pad_date   date,
  status     financial_doc_status not null default 'Draft',
  notes      text,
  file_id    uuid references files(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table pad is 'Section 25.3 — Pengakuan/Berita Acara pendapatan per SPK.';

create index pad_spk_idx on pad(spk_id);

create trigger pad_set_updated_at
  before update on pad
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
create table invoices (
  id             uuid primary key default gen_random_uuid(),
  spk_id         uuid not null references spks(id),
  pad_id         uuid references pad(id),
  invoice_number text,
  invoice_value  numeric(18,2) not null check (invoice_value >= 0),
  invoice_date   date,
  due_date       date,
  status         financial_doc_status not null default 'Draft',
  notes          text,
  file_id        uuid references files(id),
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table invoices is 'Section 25.4 — invoice value drives margin (Section 26.2).';

create index invoices_spk_idx on invoices(spk_id);
create index invoices_due_idx on invoices(due_date);

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  spk_id         uuid not null references spks(id),
  invoice_id     uuid references invoices(id),
  payment_value  numeric(18,2) not null check (payment_value >= 0),
  payment_date   date,
  reference      text,
  status         financial_doc_status not null default 'Draft',
  notes          text,
  file_id        uuid references files(id),
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table payments is 'Section 25.5 — payment received against an invoice.';

create index payments_spk_idx on payments(spk_id);
create index payments_invoice_idx on payments(invoice_id);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();
