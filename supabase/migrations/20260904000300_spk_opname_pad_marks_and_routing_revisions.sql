-- ============================================================================
-- 0018 — BA Opname / PAD become a mark on the SPK instead of a routed revenue
--        document (the old opnames/pad tables stay in place, unused, rather
--        than being dropped — nothing references them once this ships).
--        Routing review is simplified to Lanjut/Revisi; a step under revision
--        can collect more than one round, so each round is its own row.
-- ============================================================================

alter table spks
  add column opname_marked_at timestamptz,
  add column opname_marked_by uuid references users(id),
  add column pad_marked_at    timestamptz,
  add column pad_marked_by    uuid references users(id);

comment on column spks.opname_marked_at is
  'Set when this SPK has been opname-ed (usually once Desain Awal is done). Just a mark — no separate document.';
comment on column spks.pad_marked_at is
  'Set once PAD is made for this SPK, which happens after opname is marked done.';

-- ---------------------------------------------------------------------------
create table routing_step_revisions (
  id                 uuid primary key default gen_random_uuid(),
  routing_history_id uuid not null references routing_history(id),
  note               text not null,
  resubmit_at        date not null,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now()
);

comment on table routing_step_revisions is
  'One row per revision round on a routing step: what needs fixing and when it will be resubmitted.';

create index routing_step_revisions_step_idx on routing_step_revisions(routing_history_id);

alter table routing_step_revisions enable row level security;

create policy routing_step_revisions_select on routing_step_revisions
  for select to authenticated
  using (
    has_perm('routing', 'view')
    and exists (
      select 1 from routing_history h
      join spk_routing r on r.id = h.spk_routing_id
      where h.id = routing_history_id and spk_visible(r.spk_id)
    )
  );

create policy routing_step_revisions_insert on routing_step_revisions
  for insert to authenticated
  with check (
    exists (
      select 1 from routing_history h
      join spk_routing r on r.id = h.spk_routing_id
      where h.id = routing_history_id and spk_editable(r.spk_id, 'routing')
    )
  );
