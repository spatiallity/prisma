-- ============================================================================
-- 0007 — Document routing and lead time (Section 23, 24)
-- ============================================================================

create table spk_routing (
  id              uuid primary key default gen_random_uuid(),
  spk_id          uuid not null references spks(id),
  template_id     uuid references routing_templates(id),
  document_type   text not null,
  document_number text,
  status          routing_status not null default 'Pending',
  started_at      timestamptz,
  completed_at    timestamptz,
  notes           text,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table spk_routing is
  'Section 23 — one routed document per row; its per-stage trail lives in routing_history.';

create index spk_routing_spk_idx on spk_routing(spk_id);
create index spk_routing_status_idx on spk_routing(status);

create trigger spk_routing_set_updated_at
  before update on spk_routing
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- routing_history — every stage the document passes through (Section 23, 24)
-- ---------------------------------------------------------------------------
create table routing_history (
  id               uuid primary key default gen_random_uuid(),
  spk_routing_id   uuid not null references spk_routing(id),
  template_step_id uuid references routing_template_steps(id),
  step_name        text not null,
  sequence         int not null,
  pic_id           uuid references users(id),
  pic_name         text,
  status           routing_status not null default 'Pending',
  started_at       timestamptz,
  completed_at     timestamptz,
  -- Section 24 — lead time per stage, computed, never typed.
  duration_days    numeric(8,2) generated always as (
    case
      when started_at is null or completed_at is null then null
      else round(extract(epoch from (completed_at - started_at)) / 86400.0, 2)
    end
  ) stored,
  sla_days         numeric(6,2),
  note             text,
  attachment_file_id uuid references files(id),
  created_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (spk_routing_id, sequence),
  constraint routing_history_time_order check (
    started_at is null or completed_at is null or completed_at >= started_at
  )
);

comment on table routing_history is
  'Section 23/24 — PIC, start, completion, status, note, attachment and computed duration.';

create index routing_history_routing_idx on routing_history(spk_routing_id);
create index routing_history_status_idx on routing_history(status);

create trigger routing_history_set_updated_at
  before update on routing_history
  for each row execute function set_updated_at();

-- Roll stage state up onto the document (Section 44 — routing feeds SPK status).
create or replace function refresh_routing_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_routing  uuid;
  v_total    int;
  v_done     int;
  v_blocked  int;
  v_started  timestamptz;
  v_finished timestamptz;
begin
  -- NEW is unassigned on DELETE, so pick the record explicitly.
  if tg_op = 'DELETE' then
    v_routing := old.spk_routing_id;
  else
    v_routing := new.spk_routing_id;
  end if;

  select count(*),
         count(*) filter (where status = 'Completed'),
         count(*) filter (where status in ('Returned', 'Rejected')),
         min(started_at),
         max(completed_at)
  into v_total, v_done, v_blocked, v_started, v_finished
  from routing_history
  where spk_routing_id = v_routing;

  update spk_routing
  set status = case
        when v_total = 0 then 'Pending'::routing_status
        when v_blocked > 0 then 'Returned'::routing_status
        when v_done = v_total then 'Completed'::routing_status
        when v_done > 0 or v_started is not null then 'In Progress'::routing_status
        else 'Pending'::routing_status
      end,
      started_at   = v_started,
      completed_at = case when v_total > 0 and v_done = v_total then v_finished else null end,
      updated_at   = now()
  where id = v_routing;

  return null;
end;
$fn$;

create trigger routing_history_refresh_status
  after insert or update or delete on routing_history
  for each row execute function refresh_routing_status();
