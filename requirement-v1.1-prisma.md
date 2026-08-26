# Rencana Pengembangan Web Monitoring SPK

## PT SUCOFINDO (Persero) — Project Survei Topografi Lokasi Bor dan Fasilitas Produksi PT Pertamina EP Zona 4 Prabumulih

**Versi:** V1.1 (konsolidasi — menggantikan V1.0)
**Tanggal:** 25 Agustus 2026
**Status:** Requirement disepakati — siap masuk tahap Database Schema V1
**Platform:** Web Application, single-project scope
**Frontend/Deployment:** Next.js + Vercel
**Backend/Database:** Supabase PostgreSQL
**Authentication:** Supabase Auth
**File Storage:** Supabase Storage
**Tier:** Free tier (Supabase + Vercel) — cukup untuk kebutuhan single-project saat ini

> **Catatan untuk Claude Code:** Dokumen ini adalah sumber kebenaran tunggal (single source of truth) untuk requirement sistem. Baca seluruh dokumen ini sebelum memulai development apa pun. Ikuti urutan prioritas di Section 12 (Prioritas Development) — jangan membangun modul di luar urutan tanpa konfirmasi.

---

# 1. Executive Summary

Web Monitoring SPK dirancang sebagai sistem terintegrasi untuk memonitor seluruh lifecycle Surat Perintah Kerja (SPK) pada project survei topografi lokasi bor dan fasilitas produksi, mulai dari pembuatan SPK, pelaksanaan pekerjaan lapangan, pengelolaan Vendor Jasa Survey, progress pekerjaan, desain, routing dokumen, opname, PAD, invoice, payment, hingga cost tracking dan margin per SPK.

Sistem tidak hanya berfungsi sebagai dashboard pelaporan, tetapi sebagai **operational monitoring system** yang menjadi sumber data utama project.

Konsep utama sistem:

> **SPK menjadi central object yang menghubungkan seluruh proses operasional, administratif, finansial, dan resource.**

Empat dimensi utama sistem:

### 1. Operasional
**SPK → Schedule → Daily Plan → Daily Progress → Progress**

### 2. Administratif
**SPK → Dokumen → Routing → Opname → PAD → Invoice → Payment**

### 3. Financial / Cost
**SPK → Vendor Payment / Personnel Cost / Operational Cash → Margin**

### 4. Resource
**Vendor Jasa Survey → Team → Assignment → Daily Plan → Productivity**

Keempat dimensi tersebut terhubung melalui SPK.

---

# 2. Latar Belakang

Project ini adalah **Survei Topografi Lokasi Bor dan Fasilitas Produksi PT Pertamina EP Zona 4 Prabumulih** — bukan sistem lintas-project PMU Geomatika secara umum. Scope sistem dirancang single-project untuk kebutuhan project ini.

Pengelolaan banyak SPK dalam project membutuhkan monitoring terhadap beberapa aspek sekaligus:

* pekerjaan lapangan;
* jadwal Vendor Jasa Survey;
* progress aktual;
* desain;
* routing dokumen;
* opname;
* PAD;
* invoice;
* payment;
* spending (kas kecil, biaya personel, pembayaran vendor);
* margin/profitabilitas per SPK;
* bottleneck dalam proses.

Permasalahan yang ingin diselesaikan antara lain:

1. Informasi progress SPK tersebar di berbagai sumber.
2. Daily Plan dan Daily Progress Vendor Jasa Survey perlu dipantau secara konsisten.
3. Rencana pekerjaan Vendor Jasa Survey dapat berubah tanpa informasi yang cukup cepat.
4. Progress aktual dan progress yang dilaporkan dapat berbeda.
5. Routing dokumen memiliki lead time panjang dan sulit dipantau secara keseluruhan.
6. Data financial belum selalu tersinkronisasi dengan progress SPK.
7. PAD perlu dimonitor agar tidak terjadi perbedaan pencatatan pendapatan.
8. Biaya operasional (kas kecil mess), biaya personel, dan pembayaran vendor belum tercatat terstruktur — margin per SPK belum bisa dihitung.
9. Management membutuhkan informasi bottleneck tanpa harus meminta rekap manual.
10. Tidak semua role membutuhkan akses terhadap seluruh data.

Web ini dikembangkan untuk menyediakan **single source of truth** bagi monitoring project.

---

# 3. Tujuan Sistem

## 3.1 Tujuan Utama

Membangun sistem monitoring SPK berbasis web yang mampu memberikan informasi:

> **SPK mana yang sedang dikerjakan, siapa yang mengerjakan, sudah sampai tahap apa, dokumen sedang berada di mana, berapa nilai yang sudah direalisasikan, berapa margin-nya, serta apa yang sedang menjadi bottleneck.**

## 3.2 Tujuan Khusus

Sistem harus mampu:

1. Mengelola data SPK.
2. Mengelola assignment Vendor Jasa Survey.
3. Mengelola team Vendor Jasa Survey.
4. Mengelola Daily Plan.
5. Mengelola Daily Progress (diisi personel ketika sudah di mess — bukan real-time dari lapangan; tidak memerlukan mode offline/PWA).
6. Menghitung progress pekerjaan secara otomatis.
7. Mengelola desain dan revisinya.
8. Memonitor routing dokumen.
9. Mengelola opname.
10. Mengelola PAD.
11. Mengelola invoice.
12. Memonitor payment.
13. Mencatat dan mengelola spending — kas kecil operasional, biaya personel, dan pembayaran vendor.
14. Menghitung margin per SPK secara otomatis.
15. Menampilkan bottleneck.
16. Menampilkan Today's Schedule.
17. Menampilkan histori perubahan data.
18. Membatasi akses berdasarkan role.
19. Menyediakan dashboard untuk management dan cabang.

---

# 4. Prinsip Desain Sistem

## 4.1 SPK sebagai Central Object

Seluruh informasi harus dapat ditelusuri kembali ke SPK.

```text
SPK-001
 → Vendor Jasa Survey
 → Team
 → Schedule
 → Daily Plan
 → Daily Progress
 → Activity Progress
 → Design
 → Routing
 → Opname
 → PAD
 → Invoice
 → Payment
 → Vendor Payment
 → Margin
```

## 4.2 Data Diinput Sekali, Digunakan Berkali-kali

Data yang sudah ada tidak boleh berulang kali dimasukkan oleh user.

Contoh: jika luas SPK adalah **12,06 Ha**, sistem dapat menggunakan nilai tersebut sebagai target pekerjaan terestris.

## 4.3 Dashboard Bersifat Dinamis

Angka pada dashboard tidak diinput manual. Contoh: **SPK On Going** = jumlah SPK dengan status On Going; **SPK PAD** = jumlah SPK yang sudah memiliki PAD; **SPK Invoice** = jumlah SPK yang sudah invoice.

Prinsip yang sama berlaku untuk saldo kas kecil (`cash_ledger.balance`) dan margin per SPK — **keduanya dihitung sistem, tidak pernah diinput manual.**

## 4.4 Tidak Menggunakan Hard Delete

Untuk data penting seperti SPK, financial, routing, progress, desain, dan file — tidak dilakukan penghapusan permanen. Jika terdapat kesalahan, data diedit dan sistem menyimpan histori perubahan. Data yang sudah tidak berlaku diberi status: Archived / Cancelled / Inactive.

## 4.5 Data Spasial — Cukup Format Ringan

Sistem tidak memerlukan penanganan khusus untuk data spasial besar (point cloud, raster drone/LiDAR) maupun ekstensi database seperti PostGIS. Kebutuhan map cukup ditangani dengan format ringan (GeoJSON/SHP/DXF/CSV) sebagaimana dijelaskan di Section 27 — file akuisisi mentah tidak disimpan/diproses di sistem ini.

---

# 5. Struktur User dan Role

## 5.1 Operational
Hak akses: membuat SPK, mengedit SPK, mengelola Vendor Jasa Survey, assignment pekerjaan, monitoring pekerjaan lapangan, Daily Plan, Daily Progress, schedule, routing, monitoring progress.
Data financial: **View Only**. Tidak mengubah nilai kontrak, Opname, PAD, Invoice, Spending.

## 5.2 Administration
Hak akses: membuat SPK, mengedit data SPK, mengelola nilai kontrak, Opname, PAD, Invoice, payment information, **spending (cash_ledger, personnel_costs, vendor_payments)**.
Administration juga dapat mengubah data dasar SPK.

## 5.3 Drafter
Akses terhadap Detail SPK dan modul desain. Dapat: membuka Detail SPK, mengedit data SPK yang diberikan permission, melihat progress, mengelola desain, upload file desain, melakukan review, mengelola revisi, finalisasi desain.
Tidak memiliki akses edit terhadap financial, PAD, invoice, payment, spending.

## 5.4 Project Manager
Akses monitoring luas: seluruh SPK, progress, kondisi lapangan, Vendor Jasa Survey, schedule, routing, bottleneck, opname, PAD, invoice, spending, **margin per SPK**.
Berfungsi sebagai monitoring dan control, bukan operator utama.

## 5.5 Kabid BIU Cabang
Akses: **Full Monitoring** — seluruh informasi project termasuk financial dan margin.

## 5.6 Bidang Dukbis Cabang
Fokus: **SPK → Contract → Opname → PAD → Invoice → Payment → Spending**. Progress pekerjaan ditampilkan sebagai konteks.

## 5.7 Vendor Jasa Survey
Akses terbatas terhadap SPK yang ditugaskan. Dapat: melihat SPK assignment, lokasi, luas pekerjaan, jadwal, mengelola Daily Plan, mengisi Daily Progress, melihat team dan pekerjaan yang menjadi tanggung jawab mereka.
**Tidak dapat melihat data financial/spending/internal project.**

---

# 6. Role Permission Matrix

| Modul | Operational | Administration | Drafter | PM | Kabid BIU | Dukbis | Vendor Jasa Survey |
|---|---|---|---|---|---|---|---|
| Dashboard | Edit/View | View | View | View | View | View | Limited |
| Create SPK | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Basic SPK | Edit | Edit | Edit terbatas | View | View | View | View terbatas |
| Vendor Jasa Survey | Edit | View | ❌ | View | View | View | Own |
| Schedule | Edit | View | View | View | View | View | Own |
| Daily Plan | Edit | View | View | View | View | View | Own |
| Daily Progress | Edit | View | View | View | View | View | Own |
| Progress | Edit | View | Edit | View | View | View | Own |
| Design | View | View | Edit | View | View | View | ❌ |
| Routing | Edit | View | View | View | View | View | View terbatas |
| Contract | View | Edit | View | View | View | Edit/View | ❌ |
| Opname | View | Edit | View | View | View | Edit/View | ❌ |
| PAD | View | Edit | ❌ | View | View | Edit/View | ❌ |
| Invoice | View | Edit | ❌ | View | View | Edit/View | ❌ |
| Payment | View | Edit/View | ❌ | View | View | Edit/View | ❌ |
| **Spending (Cash/Personnel/Vendor)** | View | Edit | ❌ | View | View | Edit/View | ❌ |
| **Margin per SPK** | ❌ | View | ❌ | View | View | View | ❌ |
| Audit Log | View | View | View | View | View | View | Own |

---

# 7. Struktur Menu

## Dashboard
Overview · Bottleneck · Today's Schedule · Recent Activity

## SPK
Semua SPK · SPK On Going · SPK Selesai · Buat SPK Baru

## Schedule
Calendar · Daily Plan · Daily Progress · Team Schedule

## Vendor Jasa Survey
Daftar Vendor Jasa Survey · Team · Assignment · Productivity

## Design
Design Queue · Review · Revision · Final Design

## Routing
Routing Monitor · Pending Approval · Routing History

## Financial
Contract · Opname · PAD · Invoice · Payment · **Spending** (Cash Ledger, Personnel Cost, Vendor Payment) · **Margin per SPK**

## Reports
Project Report · SPK Report · Progress Report · Financial Report

## Administration
User · Role · Master Vendor Jasa Survey · Master Personnel · Cash Ledger Category · Activity Template · Progress Template · Routing Template · Status Master · Audit Log

Menu ditampilkan berdasarkan permission user.

---

# 8. Dashboard

Dashboard utama harus menjawab empat pertanyaan:

1. Berapa banyak SPK dan berada di tahap mana?
2. Apa yang harus dikerjakan hari ini?
3. Apa yang sedang menjadi bottleneck?
4. Bagaimana kondisi financial dan margin project?

## 8.1 KPI Utama

Dashboard menampilkan (semua dihitung otomatis dari database, tidak diinput manual):

* Total SPK
* SPK On Going
* SPK masuk Routing
* SPK PAD
* SPK Invoice
* SPK Payment

---

# 9. Bottleneck Monitoring

Sistem otomatis mendeteksi kondisi yang membutuhkan perhatian.

### Operational Bottleneck
SPK belum memiliki jadwal · SPK belum memiliki Vendor Jasa Survey · Vendor Jasa Survey terlambat update · actual progress tertinggal dari plan.

### Design Bottleneck
Menunggu review · revisi terlalu lama · menunggu finalisasi.

### Routing Bottleneck
Dokumen terlalu lama pada satu stage · approval belum dilakukan · lead time melebihi threshold.

### Financial Bottleneck
Opname belum masuk · PAD belum dibuat · Invoice belum dibuat · Payment belum diterima · **saldo kas kecil di bawah threshold** · **vendor payment jatuh tempo belum dibayar**.

---

# 10. Today's Schedule

Menampilkan pekerjaan hari ini.

| Vendor Jasa Survey | Team | SPK | Aktivitas | Target | Status |
|---|---|---|---|---|---|
| KJSB Syahrial | Team A | BNG-A03 | Terestris | 1,5 Ha | Updated |
| KJSB Syahrial | Team B | BNG-A04 | Terestris | 1,2 Ha | Updated |
| KJSB Hanif | Team A | PRDM-02 | Stake Out | 15 titik | Pending |

Status: Updated Today · Belum Update · Terlambat Update · Completed.

> Catatan pengisian: Daily Progress diisi personel **ketika sudah kembali ke mess** (bukan real-time dari lapangan), sehingga sistem tidak memerlukan mode offline/PWA untuk pengisian data ini.

---

# 11. SPK Management

Data dasar SPK minimal:

Nomor SPK · Nama pekerjaan · Lokasi · Kabupaten/Kota · Provinsi · Luas area · Nilai kontrak · Tanggal mulai · Tanggal selesai · Vendor Jasa Survey · Project Manager · Status · Progress Template · Jenis pekerjaan · Keterangan.

---

# 12. Detail SPK

Halaman utama untuk melihat lifecycle satu pekerjaan.

**Header contoh:** `SPK-2026-001` · `BNG-A03` · 12,06 Ha · Rp XXX · KJSB Syahrial · 20 Aug – 17 Sep 2026 · **Progress 67%**

## Tab Detail SPK

### Overview
Ringkasan: basic information, progress, schedule, Vendor Jasa Survey, bottleneck, latest activity.

### Progress
Menampilkan seluruh aktivitas dan progress.

### Map
Menampilkan area pekerjaan, koridor, titik BM, titik stake out, data spasial pendukung.
Format: SHP, DXF, CSV, GeoJSON. CSV mendukung latitude/longitude, UTM, WGS84, default UTM Zone 48S — zona harus dapat diubah. (Tidak perlu penanganan data spasial besar/PostGIS — lihat Section 4.5.)

### Design
Desain awal, review, pemaparan, revisi, finalisasi, histori file.

### Routing
Histori routing dan posisi dokumen saat ini.

### Financial
Nilai SPK, Opname, PAD, Invoice, Payment, **Spending (cash yang ditandai ke SPK ini, personnel cost yang ditandai, vendor payment)**, **Margin**.

---

# 13. Progress Engine

Progress dihitung berdasarkan **bobot aktivitas**.

Untuk SPK dengan Siteplan:

| Aktivitas | Bobot | Measurement |
|---|---:|---|
| Survei Pendahuluan | 10% | Percentage |
| Pemasangan BM | 5% | Quantity |
| Pengamatan BM | 5% | Quantity |
| Pengukuran Terestris | 20% | Area |
| Pengolahan Data Topo | 15% | Percentage |
| Desain Siteplan | 17% | Stage |
| Finalisasi Desain | 8% | Stage |
| Stake Out | 4% | Quantity |
| Inventaris Lahan | 3% | Percentage |
| Cek Bersama | 3% | Percentage |
| Laporan Akhir | 10% | Percentage |
| **Total** | **100%** | |

---

# 14. Jenis Pengukuran Progress

## 14.1 Percentage
Digunakan untuk: Survei Pendahuluan, Pengolahan Data, Inventaris Lahan, Cek Bersama, Laporan Akhir, dan aktivitas lain yang sesuai. User memasukkan angka persen langsung, mis. **70%**.

## 14.2 Area
Digunakan untuk **Pengukuran Terestris**.
Contoh: Target 12,06 Ha, Actual 8,50 Ha → `8,50 / 12,06 × 100 = 70,48%`.

## 14.3 Quantity
Digunakan untuk aktivitas berbasis jumlah. Contoh **Stake Out**: Target 120 patok, Actual 75 patok → Progress **62,5%**.

## 14.4 Stage
Digunakan untuk **Desain Siteplan** dan **Finalisasi Desain**. Tidak menggunakan input percentage bebas. Status: Belum Mulai / Dalam Pengerjaan / Selesai. Jika selesai, bobot aktivitas diberikan 100%.

---

# 15. Progress Calculation

```text
Activity Contribution = Activity Progress × Activity Weight
Overall Progress = Σ seluruh Activity Contribution
```

Contoh:
Terestris: `70,48% × 20% = 14,096%`
Stake Out: `62,5% × 4% = 2,5%`

Seluruh kontribusi dijumlahkan menjadi overall progress SPK. **User tidak menginput overall progress secara manual.**

---

# 16. Progress History

Setiap update progress disimpan.

| Tanggal | Actual | Progress |
|---|---:|---:|
| 20 Aug | 2,0 Ha | 16,58% |
| 21 Aug | 4,5 Ha | 37,31% |
| 22 Aug | 6,0 Ha | 49,75% |
| 23 Aug | 8,5 Ha | 70,48% |

Dengan histori ini sistem dapat menghasilkan: progress trend, planned vs actual, productivity, delay detection.

---

# 17. Progress Template

Minimal terdapat **Template A** (SPK dengan Siteplan) dan **Template B** (SPK tanpa Siteplan). Template dapat dikembangkan untuk pekerjaan khusus. Saat SPK dibuat, user memilih template — sistem otomatis membuat daftar aktivitas dan bobot.

---

# 18. Schedule Management

**Daily Plan** — rencana pekerjaan yang akan dilakukan.
**Daily Progress** — realisasi pekerjaan, diisi ketika personel sudah di mess.

| SPK | Target | Actual | Achievement |
|---|---:|---:|---:|
| BNG-A03 | 1,5 Ha | 1,4 Ha | 93,3% |
| BNG-A04 | 1,2 Ha | 1,2 Ha | 100% |

Sistem dapat membandingkan **Plan vs Actual**.

---

# 19. Vendor Jasa Survey Management

Data Vendor Jasa Survey: Nama Vendor Jasa Survey, Contact person, Team, anggota, assignment, status aktif/nonaktif. Satu Vendor Jasa Survey dapat memiliki beberapa team (mis. **KJSB Syahrial** → Team A, Team B, Team C). Setiap team dapat ditugaskan ke SPK berbeda.

---

# 20. Productivity Monitoring

Contoh: Terestris → **1,8 Ha/day**; Stake Out → **15 patok/day**.

Sistem dapat menghitung: productivity per team, productivity per Vendor Jasa Survey, target vs actual, daily achievement, plan compliance.

---

# 21. Design Management

Workflow: **Desain Awal → Review → Pemaparan → Revisi → Finalisasi → Approved**

Setiap tahap menyimpan: status, PIC, tanggal, catatan, file, versi.

---

# 22. File Versioning

File tidak ditimpa secara permanen.

```text
Design_v01
Design_v02
Design_v03
Design_Final
```

Sistem menyimpan: file, versi, uploader, timestamp, keterangan, status.

---

# 23. Routing Management

Routing Pertamina:

**Document Control → GIS Engineer → Lead GIS Engineer → User → Manager Engineering & Project → Finance**

Setiap routing step memiliki: PIC, start time, completion time, status, note, attachment, duration.

Status: Pending · In Progress · Completed · Returned · Rejected.

---

# 24. Routing Lead Time

Sistem otomatis menghitung durasi tiap tahap.

| Stage | Duration | Status |
|---|---:|---|
| Document Control | 1,2 hari | Done |
| GIS Engineer | 2,4 hari | Done |
| Lead GIS Engineer | 1,8 hari | In Progress |
| User | - | Pending |

Dashboard dapat mendeteksi **stage dengan lead time tertinggi** dan menampilkan bottleneck.

---

# 25. Financial Management

Lifecycle financial:

**Contract → Opname → PAD → Invoice → Payment**

berjalan paralel dengan:

**Cost Tracking → Vendor Payment / Personnel Cost / Operational Cash → Margin**

## 25.1 Contract
Data: nilai kontrak, tanggal kontrak, nomor kontrak/SPK, amendment jika ada.

## 25.2 Opname
Data: nilai opname, tanggal, nomor dokumen, periode, status.

## 25.3 PAD
Data: nilai PAD, tanggal, status.

## 25.4 Invoice
Data: nomor invoice, nilai, tanggal, status.

## 25.5 Payment
Data: nilai pembayaran, tanggal, status.

## 25.6 Spending — Cost Tracking

Spending dibagi menjadi tiga jenis biaya, karena masing-masing memiliki karakteristik dan cara perhitungan yang berbeda. Menggabungkan ketiganya ke satu tabel generik akan membuat dashboard tidak bisa memisahkan biaya operasional harian dari biaya vendor per SPK.

### 25.6.1 Operational Cash (Kas Kecil)
Karakteristik: harian, banyak transaksi kecil, dicatat oleh PIC lapangan/mess, ada mekanisme top-up berkala.
Contoh: BBM, ATK, konsumsi, listrik/wifi mess, kebersihan mess, materai, HSE reward, tol, Grab operasional.

Data: tanggal transaksi, PIC, kategori (referensi ke master kategori), keterangan/kebutuhan, uang keluar, uang masuk (top-up kas), saldo (**dihitung otomatis**), SPK terkait (**opsional** — diisi jika biaya terkait langsung ke satu SPK, dikosongkan jika overhead umum seperti listrik/wifi/kebersihan mess).

> Prinsip penting: saldo tidak boleh diinput manual seperti pada pencatatan Excel sebelumnya. Sistem menghitung `saldo = saldo sebelumnya + uang masuk − uang keluar` secara otomatis, sehingga menghindari selisih pencatatan yang terjadi pada proses manual.

### 25.6.2 Personnel Cost
Karakteristik: periodik, per personel, umumnya bersifat overhead tim (tidak selalu terkait satu SPK).
Contoh: gaji, MCU personel, honor/operasional PIC.

Data: personel (referensi ke master personel), jenis biaya (Gaji / MCU / Honor & Operasional), periode berlaku (bulan untuk gaji, atau tanggal untuk MCU/honor), nilai, SPK terkait (opsional, umumnya dikosongkan).

### 25.6.3 Vendor / Subcontractor Payment
Karakteristik: per SPK, bersifat borongan berdasarkan persentase kesepakatan kontrak, dapat dibayar bertahap (termin).
Contoh: pembayaran ke Vendor Jasa Survey — SPK bernilai Rp100.000.000 dengan kesepakatan vendor menerima 80% dari nilai kontrak.

Data: SPK terkait (wajib), Vendor Jasa Survey penerima, nilai kontrak SPK, persentase kesepakatan, nilai payable vendor (**dihitung otomatis**: `nilai kontrak SPK × persentase kesepakatan`), tahap termin (DP / Progress / Final), nilai yang sudah dibayarkan, status (Belum Dibayar / Sebagian / Lunas).

---

# 26. Financial Reconciliation

## 26.1 Reconciliation Sisi Revenue

**Contract vs Opname** — Selisih = Contract − Opname
**Opname vs Invoice** — Selisih = Opname − Invoice
**Invoice vs Payment** — Selisih = Invoice − Payment

## 26.2 Reconciliation Sisi Cost

```text
Total Cost per SPK = Vendor Payable
                    + Personnel Cost (yang ditandai ke SPK tsb)
                    + Operational Cash (yang ditandai ke SPK tsb)

Margin per SPK   = Invoice Value − Total Cost per SPK
Margin % per SPK = Margin per SPK / Invoice Value × 100
```

## 26.3 Overhead Project

Biaya yang tidak ditandai ke SPK tertentu (listrik mess, wifi, kebersihan mess, keamanan komplek, dsb) tidak dipaksakan masuk ke perhitungan margin per SPK. Direkap terpisah:

```text
Overhead Project Bulanan = Σ Operational Cash tanpa SPK terkait
                          + Σ Personnel Cost tanpa SPK terkait
```

Sehingga dashboard financial menghasilkan dua angka yang terpisah dan tidak saling mendistorsi:

* **Margin per SPK** — akurat, berbasis vendor payment dan biaya yang jelas keterkaitannya.
* **Overhead Project Bulanan** — gambaran beban operasional umum di luar SPK spesifik.

---

# 27. Map & Spatial Data

Map pada Detail SPK harus mendukung kebutuhan GIS project pada level ringan — bukan penyimpanan/pemrosesan data akuisisi mentah.

Minimal: area pekerjaan, koridor, titik BM, titik stake out, layer tambahan.

Format yang dipertimbangkan: GeoJSON (format internal utama, paling mudah ditampilkan di web), SHP, DXF, CSV (mendukung latitude/longitude, UTM, WGS84, default UTM Zone 48S — zona harus dapat diubah).

File sumber (jika ada) tetap dapat disimpan di Storage sebagai lampiran, tanpa kebutuhan pemrosesan spasial lanjutan (tidak perlu PostGIS, tidak perlu penanganan point cloud/raster drone-LiDAR berukuran besar).

---

# 28. Database Architecture

Database menggunakan **Supabase PostgreSQL**.

```text
users
roles
permissions
role_permissions

spks
spk_assignments

vendors
vendor_teams
vendor_members

activity_templates
activity_template_items

spk_activities
activity_progress

daily_plans
daily_progress

designs
design_revisions

routing_templates
routing_template_steps
spk_routing
routing_history

contracts
opnames
pad
invoices
payments

-- Spending
cash_ledger
cash_ledger_categories

personnel
personnel_costs

vendor_payments
vendor_payment_terms

files
notifications
audit_logs
```

### Detail tabel Spending (baru)

**`cash_ledger`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| date | date | Tanggal transaksi |
| pic | text / FK ke users | PIC yang mencatat/mengeluarkan |
| category_id | FK → cash_ledger_categories | |
| description | text | Kebutuhan |
| amount_out | numeric | Uang keluar |
| amount_in | numeric | Uang masuk / top-up |
| balance | numeric | **Dihitung otomatis oleh sistem** |
| spk_id | FK → spks, nullable | Opsional, kosong jika overhead umum |

**`cash_ledger_categories`** — master kategori: BBM, ATK, Konsumsi, Utilitas Mess, Kebersihan & Keamanan, Materai/Administrasi, Transportasi (Tol/Grab), HSE Reward, Lain-lain.

**`personnel`** — master data personel tim project.

**`personnel_costs`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| personnel_id | FK → personnel | |
| type | enum | Gaji / MCU / Honor & Operasional |
| period | date | Periode berlaku |
| amount | numeric | |
| spk_id | FK → spks, nullable | Umumnya kosong (overhead tim) |

**`vendor_payments`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| spk_id | FK → spks | Wajib |
| vendor_id | FK → vendors | |
| contract_value | numeric | Nilai kontrak SPK |
| agreed_percentage | numeric | Persentase kesepakatan (mis. 80%) |
| vendor_payable | numeric | **Dihitung otomatis** |
| amount_paid | numeric | Realisasi dibayar |
| status | enum | Belum Dibayar / Sebagian / Lunas |

**`vendor_payment_terms`** — detail termin jika `vendor_payments` dibayar bertahap (DP / Progress / Final), masing-masing dengan nilai dan tanggal pembayaran sendiri.

---

# 29. Relasi Utama Database

```text
USER
 │
 ├──────────────┐
 │              │
 ▼              ▼
ROLE           Vendor Jasa Survey
 │              │
 │              ▼
 │         Vendor Jasa Survey TEAM
 │              │
 └──────┐       │
        ▼       ▼
              SPK
               │
       ┌───────┼────────┬────────┬─────────┐
       ▼       ▼        ▼        ▼         ▼
   ACTIVITIES SCHEDULE DESIGN  ROUTING  FINANCIAL
       │
       ▼
 ACTIVITY PROGRESS
       │
       └──────────────┐
                      ▼
                 SPK PROGRESS

SPK
 │
 ├── CONTRACT
 ├── OPNAME
 ├── PAD
 ├── INVOICE
 ├── PAYMENT
 └── SPENDING
       ├── CASH_LEDGER (opsional per SPK)
       ├── PERSONNEL_COSTS (opsional per SPK)
       └── VENDOR_PAYMENTS (wajib per SPK)
              │
              ▼
           MARGIN
```

---

# 30. Authentication & Authorization

Authentication menggunakan **Supabase Auth**. User login menggunakan akun yang telah dibuat. Authorization menggunakan role dan permission.

```text
User → Role → Permission → Database RLS → Allowed Data
```

---

# 31. Row Level Security

Supabase RLS wajib digunakan.

Contoh Vendor Jasa Survey: Vendor Jasa Survey hanya dapat membaca SPK yang di-assignment kepada Vendor Jasa Survey/team tersebut. Vendor Jasa Survey tidak dapat mengakses financial, PAD, invoice, payment, **spending**.

Pembatasan dilakukan pada **database level**, bukan hanya frontend.

---

# 32. File Storage

File disimpan di **Supabase Storage**. Database hanya menyimpan metadata file.

```text
SPK-2026-001/
├── survey/
├── design/
│   ├── initial/
│   ├── review/
│   ├── revision/
│   └── final/
├── routing/
└── report/
```

Metadata: file ID, SPK ID, filename, storage path, file type, version, uploader, upload date.

---

# 33. Audit Log

Semua perubahan penting dicatat.

```text
User: Arvian
Date: 25 Aug 2026
Action: UPDATE
Module: SPK
Field: contract_value
Before: Rp500.000.000
After: Rp520.000.000
```

Audit log digunakan untuk: accountability, troubleshooting, tracking perubahan, mencegah kehilangan histori.

---

# 34. Notification System

Tahap awal dapat menggunakan notification internal. Contoh: Vendor Jasa Survey belum update Daily Progress; routing melewati deadline; design review belum dilakukan; SPK mendekati deadline; PAD belum dibuat; invoice belum dibuat; **saldo kas kecil di bawah threshold**; **vendor payment jatuh tempo**.

Tahap berikutnya dapat dikembangkan menjadi email, WhatsApp integration, atau notification service lainnya.

---

# 35. Tech Stack

## Frontend
**Next.js** — web interface, routing, dashboard, forms, server-side functionality.

## UI
Direkomendasikan: Tailwind CSS, shadcn/ui, charting library, map component.

## Backend
Fitur server-side Next.js yang terhubung dengan Supabase.

## Database
**Supabase PostgreSQL**

## Authentication
**Supabase Auth**

## Storage
**Supabase Storage**

## Deployment
**Vercel**

---

# 36. Arsitektur Teknologi

```text
                     USER
                      │
                      ▼
               ┌─────────────┐
               │   VERCEL    │
               │   Next.js   │
               └──────┬──────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Supabase    Supabase    Supabase
        Auth       Database     Storage
                     │
                     ▼
                 PostgreSQL
                     │
        ┌────────────┼────────────┬───────────┐
        ▼            ▼            ▼           ▼
       SPK        Progress    Financial   Spending
        │
        ├── Vendor Jasa Survey
        ├── Schedule
        ├── Design
        ├── Routing
        └── Files
```

---

# 37. Development Phases

## Phase 1 — Foundation
Fitur: project setup, Supabase connection, authentication, role, permission, database foundation, RLS, deployment Vercel.
Target: **Sistem sudah dapat digunakan untuk login dan pengelolaan user.**

## Phase 2 — Core SPK
Fitur: SPK CRUD, data dasar, Vendor Jasa Survey, team, assignment, status, Detail SPK, audit log.
Output: **SPK dapat dibuat, diedit, ditugaskan, dan dimonitor.**

## Phase 3 — Progress Engine
Fitur: activity template, progress template, weighted progress, percentage/area/quantity/stage measurement, progress history.
Output: **Overall progress SPK dihitung otomatis.**

## Phase 4 — Schedule & Vendor Jasa Survey
Fitur: calendar, Daily Plan, Daily Progress, team assignment, target vs actual, productivity, update monitoring.
Output: **Project dapat mengetahui siapa mengerjakan apa, kapan, dan berapa hasil aktualnya.**

## Phase 5 — Design
Fitur: design queue, initial design, review, presentation, revision, finalization, file versioning.
Output: **Seluruh proses desain dapat ditelusuri dari Detail SPK.**

## Phase 6 — Routing
Fitur: routing template, routing stage, PIC, approval, routing history, lead time, bottleneck.
Output: **Posisi setiap dokumen dapat diketahui secara real-time.**

## Phase 7 — Financial & Spending
Fitur: contract, opname, PAD, invoice, payment, **cash ledger, personnel cost, vendor payment**, reconciliation, **margin per SPK**.
Output: **Lifecycle financial SPK — termasuk cost dan margin — dapat dimonitor dari satu tempat.**

## Phase 8 — Dashboard & Reporting
Fitur: KPI, SPK pipeline, bottleneck, Today's Schedule, productivity, routing lead time, financial & margin status, reports.
Output: **Management mendapatkan monitoring tanpa membutuhkan rekap manual.**

## Phase 9 — Optimization
Setelah MVP stabil: advanced notifications, automated alerts, export Excel/PDF, analytics, forecasting, performance comparison, API integration.

---

# 38. MVP Scope

### MVP wajib:
1. Login
2. Role
3. User
4. SPK
5. Vendor Jasa Survey
6. Team
7. Assignment
8. Activity
9. Progress Engine
10. Daily Plan
11. Daily Progress
12. Dashboard dasar
13. Audit Log

### Setelah MVP:
14. Design
15. Routing
16. Financial
17. Spending & Margin
18. Reporting
19. Notifications

---

# 39. Prioritas Development

```text
1. Database
   ↓
2. Authentication & Role
   ↓
3. SPK
   ↓
4. Activity & Progress Engine
   ↓
5. Vendor Jasa Survey & Assignment
   ↓
6. Daily Plan / Daily Progress
   ↓
7. Dashboard
   ↓
8. Design
   ↓
9. Routing
   ↓
10. Financial & Spending
   ↓
11. Reporting & Analytics
```

Urutan ini dipilih agar fondasi data dan workflow benar sebelum dashboard dikembangkan.

---

# 40. Risiko Development

**Risiko 1 — Requirement berubah.** Solusi: gunakan master/template, bukan hard-coded.

**Risiko 2 — Permission terlalu longgar.** Solusi: gunakan Supabase RLS di database level.

**Risiko 3 — Progress tidak konsisten.** Solusi: progress dihitung sistem berdasarkan measurement type dan bobot, tidak diinput manual.

**Risiko 4 — Data financial tidak sinkron.** Solusi: gunakan relasi langsung ke SPK dan reconciliation otomatis (revenue side dan cost side).

**Risiko 5 — Dashboard tidak dipercaya user.** Solusi: dashboard hanya mengambil data dari database, dan semua KPI (termasuk saldo kas dan margin) memiliki formula yang jelas dan dihitung otomatis.

**Risiko 6 — Data migrasi dari Excel tidak konsisten.** Solusi: lihat Section 42 (Migrasi Data).

---

# 41. KPI Keberhasilan Sistem

### Operational
% SPK memiliki Daily Plan · % SPK memiliki Daily Progress · % Vendor Jasa Survey update tepat waktu · plan vs actual · average productivity.

### Project
Jumlah SPK On Going · average completion time · SPK overdue · progress aktual vs target.

### Routing
Average routing lead time · lead time per stage · jumlah dokumen pending · jumlah dokumen overdue.

### Financial
Contract vs Opname · Opname vs PAD · PAD vs Invoice · Invoice vs Payment · outstanding payment · **margin per SPK** · **overhead project bulanan** · **saldo kas kecil**.

### System
User adoption · jumlah update harian · data completeness · jumlah perubahan melalui audit log.

---

# 42. Migrasi Data Excel

Data pengeluaran mess dan data SPK yang saat ini tercatat di Excel akan melalui tahap **perapian data** sebelum masuk ke sistem, mencakup minimal:

* standardisasi format tanggal (data existing pengeluaran mess tercampur format DD/MM dan MM/DD);
* verifikasi saldo — beberapa baris pada pencatatan manual menghasilkan saldo minus akibat selisih hitung, perlu direkonsiliasi sebelum migrasi ke `cash_ledger`;
* pemetaan kebutuhan/keterangan bebas teks ke kategori baku (`cash_ledger_categories`), agar pengeluaran seperti "BBM TERIOS", "BBM MOTOR", "BBM MAS YOGI" konsisten masuk kategori BBM;
* pemisahan baris "top-up kas" (saat ini tercampur sebagai baris tanpa PIC/keterangan) menjadi entri `amount_in` yang eksplisit;
* pemetaan data SPK existing ke struktur `spks` dan tabel terkait sebelum go-live.

Tahap ini dilakukan sebagai bagian dari **Phase 2 (Core SPK)** dan **Phase 7 (Financial & Spending)** — bukan phase terpisah.

---

# 43. Konsep Akhir Sistem

```text
                         WEB MONITORING SPK
                                │
        ┌──────────────┬────────┼────────┬──────────────┐
        │              │                 │              │
        ▼              ▼                 ▼              ▼
   OPERASIONAL    ADMINISTRATIF       FINANCIAL       RESOURCE
        │              │                 │              │
        ▼              ▼                 ▼              ▼
       SPK          CONTRACT       CASH LEDGER         Vendor Jasa Survey
        │              │                 │              │
        ▼              ▼                 ▼              ▼
    SCHEDULE         OPNAME       PERSONNEL COST       TEAM
        │              │                 │              │
        ▼              ▼                 ▼              ▼
 DAILY PROGRESS       PAD        VENDOR PAYMENT    ASSIGNMENT
        │              │                 │              │
        ▼              ▼                 ▼              ▼
     PROGRESS        INVOICE          MARGIN       PRODUCTIVITY
        │              │
        ▼              ▼
     DESIGN         PAYMENT
        │
        ▼
     ROUTING
        │
        └──────────────┬──────────────────┬──────────────┘
                       ▼
                   DASHBOARD
                        │
          ┌─────────────┼─────────────┬─────────────┐
          ▼             ▼             ▼             ▼
       STATUS       BOTTLENECK     SCHEDULE       MARGIN
```

---

# 44. Prinsip Akhir

Web ini sebaiknya tidak diposisikan sebagai:

> **"Website untuk membuat laporan project."**

Tetapi sebagai:

> **"Project Control System untuk mengendalikan lifecycle SPK — operasional maupun finansial."**

Laporan adalah **output**. Data operasional adalah **input**. Workflow adalah **mesin**. Dashboard adalah **output management**.

Dengan pendekatan tersebut, ketika satu orang meng-update Daily Progress, sistem secara otomatis dapat memengaruhi:

**Activity Progress → Overall SPK Progress → Dashboard → Bottleneck → Schedule/Monitoring**

Ketika routing selesai: **Routing → SPK Status → Dashboard → Bottleneck**

Ketika financial diperbarui: **Opname → PAD → Invoice → Payment → Financial Dashboard**

Ketika spending dicatat: **Vendor Payment / Personnel Cost / Operational Cash → Margin → Financial Dashboard**

Dengan demikian, sistem menjadi **single integrated monitoring & control system** untuk seluruh lifecycle SPK — termasuk profitabilitasnya.

---

# 45. Langkah Berikutnya

Setelah requirement ini disepakati, development dimulai dari tiga deliverable teknis:

### Deliverable 1 — Database Schema V1 *(prioritas pertama)*
Nama tabel, kolom, tipe data, primary key, foreign key, relationship, enum/status, RLS policy — termasuk seluruh tabel spending (`cash_ledger`, `personnel_costs`, `vendor_payments`).

### Deliverable 2 — UI/UX Wireframe
Login, Dashboard, SPK List, Detail SPK, Progress, Schedule, Vendor Jasa Survey, Design, Routing, Financial (termasuk Spending & Margin view).

### Deliverable 3 — Development Architecture
Struktur folder Next.js, Supabase setup, authentication, RLS, API/server actions, file storage, environment variables, deployment Vercel, development workflow.

### Deliverable 4 — UAT & Change Management
Setelah MVP (Phase 1–4) berjalan, dilakukan User Acceptance Testing bersama tim yang akan menggunakan sistem (Operational, Administration, Vendor Jasa Survey), dan disiapkan pendampingan adopsi khususnya untuk role dengan variasi literasi digital (Vendor Jasa Survey lapangan).

**Prioritas pertama adalah Database Schema V1**, karena seluruh modul berikutnya bergantung pada struktur database tersebut.

---

# Appendix A — Environment Variables Checklist

Siapkan sebelum mulai coding, agar Claude Code bisa langsung setup `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Ambil dari dashboard project Supabase (Settings → API) setelah project dibuat.

---

# Appendix B — Urutan Prompt Awal untuk Claude Code

1. **Setup scaffolding** — "Inisialisasi project Next.js dengan koneksi Supabase dan struktur folder dasar, sesuai Tech Stack di Section 35."
2. **Database Schema V1** — "Berdasarkan Section 28–29 dokumen ini, buatkan database schema Supabase PostgreSQL lengkap dengan migration files dan RLS policy dasar sesuai Role Permission Matrix di Section 6."
3. **Review manual** hasil migration & RLS sebelum lanjut.
4. **Phase 1 (Foundation)** — Auth, role, permission, deployment Vercel.
5. **Phase 2 (Core SPK)** — SPK CRUD, Vendor Jasa Survey, team, assignment, Detail SPK, audit log.
6. Lanjutkan sesuai urutan Section 39 (Prioritas Development), satu fase per permintaan, dengan review manual di tiap akhir fase.
