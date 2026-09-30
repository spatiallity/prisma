-- These ten provisional SPKs have not started work yet.
update public.spks
set status = 'Draft'
where site_code in (
  'ABR-SO2', 'MSI-S2', 'RB-A1', 'MJ-A29', 'RJA-R3',
  'MSB-A1', 'NRB-A1', 'TLJ-A52', 'GKP-02', 'LTG-A1'
)
  and spk_number = site_code || '/PHR72410/2026-S0'
  and status = 'On Going';
