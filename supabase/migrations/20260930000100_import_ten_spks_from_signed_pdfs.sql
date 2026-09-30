-- The source PDFs leave the numeric SPK prefix blank. Use explicit provisional
-- identifiers so these records can be found without inventing official numbers.
with source_spks(site_code, contract_value, area_ha, location, kabupaten, field_name, easting, northing, location_note) as (
  values
    ('ABR-SO2', 79914000, 7.46, 'Air Beruang, Kec. Lubai Ulu', 'Muara Enim', 'Prabumulih', 392816.500, 9568188.000, 'Desa belum terverifikasi dari koordinat.'),
    ('MSI-S2', 72456000, 7.00, 'Bangun Rejo, Kec. Sukakarya', 'Musi Rawas', 'Pendopo', 301093.271, 9637648.299, null),
    ('RB-A1', 72806000, 7.04, 'Linggo Sari, Kec. Sungai Lilin', 'Musi Banyuasin', 'Ramba', 404000.170, 9711329.260, null),
    ('MJ-A29', 54034000, 3.33, 'Mangun Jaya, Kec. Babat Toman', 'Musi Banyuasin', 'Ramba', 343233.627, 9694163.031, null),
    ('RJA-R3', 93430000, 11.86, 'Sukaraja, Kec. Tanah Abang', 'Penukal Abab Lematang Ilir', 'Adera', 403221.793, 9632737.830, null),
    ('MSB-A1', 76758000, 7.34, 'Sukowarno, Kec. Sukakarya', 'Musi Rawas', 'Pendopo', 295427.740, 9642933.410, null),
    ('NRB-A1', 77653000, 7.93, 'Tebat Agung, Kec. Rambang Niru', 'Muara Enim', 'Limau', 394764.939, 9616533.286, null),
    ('TLJ-A52', 75161000, 7.42, 'Talang Jimar, Kec. Prabumulih Selatan', 'Kota Prabumulih', 'Prabumulih', 417148.535, 9617481.318, 'Kelurahan belum terverifikasi dari koordinat.'),
    ('GKP-02', 86063000, 9.71, 'Tapus, Kec. Lembak', 'Muara Enim', 'Prabumulih', 416993.346, 9628642.279, null),
    ('LTG-A1', 68332000, 5.83, 'Lubuk Raman, Kec. Rambang Niru', 'Muara Enim', 'Limau', 402120.375, 9613162.310, null)
), inserted as (
  insert into public.spks (
    spk_number, site_code, work_name, work_type, location_type, location,
    kabupaten, provinsi, area_ha, contract_value, start_date, end_date,
    status, activity_template_id, routing_template_id, notes
  )
  select
    'BELUM-TERTERA-' || site_code,
    site_code,
    'Survey Pemetaan, Desain Siteplan Lokasi Bor ' || site_code,
    'Dengan Desain Siteplan',
    'Lokasi Bor',
    location,
    kabupaten,
    'Sumatera Selatan',
    area_ha,
    contract_value,
    date '2026-09-25',
    date '2026-11-05',
    'On Going',
    (select id from public.activity_templates where code = 'TPL-A'),
    (select id from public.routing_templates where status = 'Active' order by created_at limit 1),
    concat(
      'PDF asli: nomor urut SPK tidak tercetak; format tercantum /PHR72410/2026-S0. ',
      'Lokasi pekerjaan: ', field_name, ' Field. ',
      'Koordinat surface: UTM WGS84 48S E ', easting, ', N ', northing, '. ',
      coalesce(location_note, '')
    )
  from source_spks
  on conflict (spk_number) do nothing
  returning id, area_ha, activity_template_id
)
insert into public.spk_activities (
  spk_id, template_item_id, name, weight, measurement, unit, sequence, target_value
)
select
  inserted.id,
  item.id,
  item.name,
  item.weight,
  item.measurement,
  item.unit,
  item.sequence,
  case when item.target_from_spk_area then inserted.area_ha else item.default_target end
from inserted
join public.activity_template_items item on item.template_id = inserted.activity_template_id;
