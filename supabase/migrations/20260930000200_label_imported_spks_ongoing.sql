-- The PDFs contain the /PHR72410/2026-S0 suffix but leave the serial blank.
-- Use the site code as a visible provisional prefix until the official serial
-- is available. Match only our import placeholders to avoid changing other SPKs.
update public.spks
set spk_number = site_code || '/PHR72410/2026-S0',
    status = 'On Going'
where (site_code, spk_number) in (
  ('ABR-SO2', 'BELUM-TERTERA-ABR-SO2'),
  ('MSI-S2', 'BELUM-TERTERA-MSI-S2'),
  ('RB-A1', 'BELUM-TERTERA-RB-A1'),
  ('MJ-A29', 'BELUM-TERTERA-MJ-A29'),
  ('RJA-R3', 'BELUM-TERTERA-RJA-R3'),
  ('MSB-A1', 'BELUM-TERTERA-MSB-A1'),
  ('NRB-A1', 'BELUM-TERTERA-NRB-A1'),
  ('TLJ-A52', 'BELUM-TERTERA-TLJ-A52'),
  ('GKP-02', 'BELUM-TERTERA-GKP-02'),
  ('LTG-A1', 'BELUM-TERTERA-LTG-A1')
);
