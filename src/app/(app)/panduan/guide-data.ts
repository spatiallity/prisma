import type { AppModule } from '@/lib/auth/permissions'

export type GuideCategory = 'Dasar' | 'SPK' | 'Desain' | 'Routing & Keuangan' | 'Administrasi'

export type GuideTopic = {
  id: string
  module: AppModule
  category: GuideCategory
  title: string
  href: string
  image: string | null
  imageAlt: string
  steps: string[]
  note?: string
}

export const CATEGORIES: GuideCategory[] = ['Dasar', 'SPK', 'Desain', 'Routing & Keuangan', 'Administrasi']

export const SCREENSHOT_ACCESS: Record<string, AppModule[]> = {
  overview: ['dashboard'],
  'spk-list': ['spk'],
  'spk-detail': ['spk'],
  survey: ['spk'],
  'design-steps': ['design'],
  'routing-table': ['routing'],
  'routing-opname': ['routing'],
  financial: ['spk', 'report'],
  roles: ['user_management'],
}

export const TOPICS: GuideTopic[] = [
  {
    id: 'navigasi', module: 'dashboard', category: 'Dasar', title: 'Membaca Overview dan berpindah menu', href: '/dashboard',
    image: '/api/panduan/screenshot/overview', imageAlt: 'Dashboard Overview dengan ringkasan nilai SPK, kontrak, dan RAB',
    steps: [
      'Buka Dashboard > Overview untuk melihat nilai SPK, opname/BAST, PAD, invoiced, pengeluaran, serta posisi laba rugi.',
      'Gunakan Rincian per SPK untuk membuka laporan yang membentuk angka SPK; gunakan Rincian per kode akun untuk menelusuri RAB.',
      'Lihat kartu status di bawahnya untuk jumlah SPK pada tiap tahap. Klik menu Progress SPK untuk daftar SPK per tahap.',
      'Jika suatu data tidak terlihat, periksa apakah role akun Anda memiliki izin melihat atau mengubah modul tersebut.',
    ],
  },
  {
    id: 'cari-filter', module: 'spk', category: 'Dasar', title: 'Mencari, memfilter, dan mengurutkan tabel', href: '/spk',
    image: '/api/panduan/screenshot/spk-list', imageAlt: 'Contoh tabel daftar SPK dengan kolom, status, dan aksi',
    steps: [
      'Ketik nomor SPK, kode lokasi, atau nama pekerjaan di kotak Cari pada halaman daftar.',
      'Klik ikon filter pada judul kolom untuk memilih satu atau beberapa nilai. Untuk tanggal, pilih bulan dan tahun.',
      'Klik judul kolom atau ikon sortir untuk mengubah urutan; kolom tanggal diurutkan menurut tanggal sebenarnya.',
      'Pada tabel yang lebar, geser mendatar. Judul kolom tetap terlihat saat isi tabel digulir.',
    ],
  },
  {
    id: 'buat-spk', module: 'spk', category: 'SPK', title: 'Menambahkan SPK baru', href: '/spk/new',
    image: '/api/panduan/screenshot/spk-list', imageAlt: 'Daftar SPK, titik awal untuk membuat SPK baru',
    steps: [
      'Buka SPK > SPK (Surat Perintah Kerja), lalu klik Buat SPK Baru di kanan atas.',
      'Isi nomor SPK, nama pekerjaan, lokasi, jenis pekerjaan, periode, luas, dan nilai kontrak sesuai dokumen SPK.',
      'Untuk pekerjaan survei tanpa desain, pilih jenis pekerjaan Hanya Survei Terestris; alur desain tidak akan dipakai.',
      'Simpan. Setelah halaman detail terbuka, periksa kembali data dan unggah dokumen SPK bila tersedia.',
    ],
    note: 'Tombol membuat SPK hanya muncul jika role memiliki izin Create pada modul SPK.',
  },
  {
    id: 'edit-spk', module: 'spk', category: 'SPK', title: 'Mengedit data dan dokumen SPK', href: '/spk',
    image: '/api/panduan/screenshot/spk-detail', imageAlt: 'Detail SPK dengan tombol Edit dan tab pekerjaan',
    steps: [
      'Cari SPK di daftar, lalu klik kode lokasi atau nomornya untuk membuka Detail SPK.',
      'Klik Edit di bagian kanan atas, ubah data yang perlu dikoreksi, lalu klik Simpan perubahan.',
      'Di tab Ringkasan, gunakan panel file SPK untuk menambah, mengganti, atau menghapus dokumen yang terlampir.',
      'Periksa kartu Tahap Saat Ini serta tab Survei Lapangan, Desain, Dokumen Invoice, dan Keuangan setelah penyimpanan.',
    ],
  },
  {
    id: 'survei', module: 'spk', category: 'SPK', title: 'Menyelesaikan survei dan pengecekan bersama', href: '/spk',
    image: '/api/panduan/screenshot/survey', imageAlt: 'Dialog Pengecekan Bersama pada tab Survei Lapangan',
    steps: [
      'Buka Detail SPK > Survei Lapangan.',
      'Pada Survei Terestris, klik aksi edit, isi tanggal bila diwajibkan, lalu Tandai selesai.',
      'Pada Pengecekan Bersama, klik edit. Isi tanggal pelaksanaan jika sudah ada dan klik Tandai selesai; tombol Simpan hanya menyimpan perubahan data.',
      'Jika tahapan keliru ditandai selesai, buka kembali aksi terkait untuk membatalkan tanda selesai tanpa menghapus seluruh progres SPK.',
    ],
    note: 'Pada penandaan Survei Terestris, tanggal kosong bagi Super Admin akan memakai tanggal hari ini. Role lain mengikuti kewajiban tanggal di formulir.',
  },
  {
    id: 'progress', module: 'progress', category: 'SPK', title: 'Memantau tahap dan memilih beberapa SPK', href: '/spk/progress',
    image: '/api/panduan/screenshot/spk-list', imageAlt: 'Daftar SPK yang bisa dicari dan dibandingkan',
    steps: [
      'Buka SPK > Progress SPK untuk melihat jumlah SPK per tahap dan grafik SPK masuk per bulan.',
      'Lihat kolom Survei Terestris, Desain Awal, Finalisasi Desain, Invoicing, atau Selesai. Klik kartu SPK di dalam kolom untuk rinciannya.',
      'Di daftar SPK, centang beberapa baris untuk menampilkan jumlah serta total nilai SPK yang dipilih.',
      'Gunakan Bersihkan pilihan untuk memulai perbandingan baru.',
    ],
  },
  {
    id: 'ekspor-spk', module: 'spk', category: 'SPK', title: 'Mengunduh data SPK', href: '/spk',
    image: '/api/panduan/screenshot/spk-list', imageAlt: 'Daftar SPK tempat tombol Download data SPK tersedia',
    steps: [
      'Buka daftar SPK dan klik Download data SPK di bagian kanan atas.',
      'Buka file hasil unduhan untuk melihat nilai SPK serta tanggal dan nilai opname, PAD, dan invoice.',
      'Untuk data routing atau laporan keuangan secara khusus, gunakan tombol Download pada masing-masing halaman terkait.',
    ],
  },
  {
    id: 'desain-mulai', module: 'design', category: 'Desain', title: 'Memulai Desain Siteplan', href: '/design/siteplan',
    image: '/api/panduan/screenshot/design-steps', imageAlt: 'Detail SPK dengan tahapan Desain Siteplan dan Finalisasi Desain',
    steps: [
      'Buka Design > Desain Siteplan. Jika SPK belum mempunyai desain, klik Add Data, pilih SPK, isi formulir, lalu klik Buka record desain.',
      'Klik baris SPK untuk membuka rangkaian tahap. Jika desain masih Draft, isi Tanggal mulai, Drafter, dan PIC Pertamina, lalu klik Mulai pengerjaan.',
      'Buka Pembuatan Desain Awal. Gunakan Simpan untuk mengoreksi data atau catatan tanpa berpindah tahap.',
      'Saat pekerjaan awal selesai, isi Tanggal mulai tahap berikutnya dan klik Lanjutkan ke Tahap Selanjutnya.',
    ],
    note: 'Tanggal mulai tahap berikutnya sekaligus menjadi tanggal selesai tahap sebelumnya. Pada alur desain, Super Admin dapat menyimpan tanpa tanggal.',
  },
  {
    id: 'desain-lanjut', module: 'design', category: 'Desain', title: 'Melanjutkan dan mengoreksi tahap desain', href: '/design/siteplan',
    image: '/api/panduan/screenshot/design-steps', imageAlt: 'Rangkaian tahap desain dalam Detail SPK',
    steps: [
      'Buka Design Queue, Desain Siteplan, atau Finalisasi Desain; klik baris SPK yang hendak dikerjakan.',
      'Buka tahap aktif. Gunakan Simpan untuk mengubah Drafter, PIC, catatan, atau tanggal tanpa mengubah status tahap.',
      'Gunakan Lanjutkan ke Tahap Selanjutnya untuk menutup tahap aktif dan memulai tahap berikutnya pada tanggal yang dipilih.',
      'Jika perlu kembali, buka Pilih tahap lain dan pilih tahap tujuan. Gunakan Kembalikan ke tahap ini atau opsi pembatalan progres hanya untuk tahap yang memang perlu dikoreksi.',
    ],
    note: 'Periksa ulang urutan dan tanggal setelah koreksi; tahap yang sudah selesai tetap mempunyai riwayatnya sendiri.',
  },
  {
    id: 'finalisasi', module: 'design', category: 'Desain', title: 'Menangani Menunggu Opname dan Finalisasi Desain', href: '/design/finalisasi',
    image: '/api/panduan/screenshot/design-steps', imageAlt: 'Contoh perbandingan status Siteplan dan Finalisasi Desain pada SPK',
    steps: [
      'Ketika Siteplan mencapai Menunggu Opname, SPK dihitung pada kelompok Finalisasi Desain di Progress SPK.',
      'Buka Design > Finalisasi Desain untuk melihat SPK yang sudah memasuki tahap finalisasi. Finalisasi terbuka dari alur Siteplan, bukan ditambahkan manual di sini.',
      'Klik SPK, isi data tahap aktif, lalu lanjutkan melalui Review Internal, Sinkronisasi, Review PIC Pertamina, hingga Acc PIC Pertamina.',
      'Status Acc PIC Pertamina yang sudah selesai menandai akhir pekerjaan finalisasi; lanjutkan pemantauan di Dokumen Invoice atau Routing Monitor.',
    ],
  },
  {
    id: 'routing-buat', module: 'routing', category: 'Routing & Keuangan', title: 'Membuat dan membuka dokumen routing', href: '/routing',
    image: '/api/panduan/screenshot/routing-table', imageAlt: 'Tabel Routing Monitor dengan status setiap tahap dokumen',
    steps: [
      'Buka Invoicing > Routing Monitor untuk melihat dokumen dan tahap yang masih berjalan.',
      'Jika SPK yang memenuhi syarat belum memiliki routing, gunakan Add Data dan pilih SPK serta template yang sesuai.',
      'Klik baris dokumen untuk membuka rincian. Kolom tahap memperlihatkan status dan tanggalnya.',
      'Gunakan Download data routing di halaman ini untuk mengambil seluruh data monitoring routing.',
    ],
  },
  {
    id: 'routing-progres', module: 'routing', category: 'Routing & Keuangan', title: 'Mengubah tahap routing atau mengirim revisi', href: '/routing',
    image: '/api/panduan/screenshot/routing-table', imageAlt: 'Matriks tahap dan status pada Routing Monitor',
    steps: [
      'Buka dokumen routing dan klik ikon pensil pada tahap yang sedang dikerjakan.',
      'Isi Tanggal mulai, PIC Pertamina, serta Catatan bila diperlukan. Klik Simpan perubahan untuk tetap berada di tahap yang sama.',
      'Isi tanggal mulai tahap berikutnya, lalu klik Lanjutkan ke Tahap Selanjutnya untuk menyelesaikan tahap saat ini.',
      'Klik Masih Revisi jika dokumen perlu diperbaiki; tuliskan alasan pada Catatan. Gunakan Batalkan tahap untuk membetulkan progres tahap terakhir.',
    ],
    note: 'Tanggal mulai tahap berikutnya menjadi tanggal selesai tahap sebelumnya. Super Admin dapat mengosongkan tanggal.',
  },
  {
    id: 'opname-pad', module: 'routing', category: 'Routing & Keuangan', title: 'Mencatat Opname dan PAD', href: '/routing',
    image: '/api/panduan/screenshot/routing-opname', imageAlt: 'Dialog edit Opname dan nilai Opname dari Routing Monitor',
    steps: [
      'Buka SPK di Routing Monitor atau Detail SPK > Keuangan.',
      'Klik ikon pensil pada Opname, isi nilai serta tanggal jika tersedia, lalu klik Tandai selesai. Untuk data yang sudah selesai, gunakan Simpan perubahan.',
      'Setelah Opname selesai, lakukan hal yang sama pada PAD dengan nilai PAD yang benar.',
      'Periksa Detail SPK > Keuangan dan Financial Report; data pada kedua tampilan berasal dari SPK yang sama.',
    ],
  },
  {
    id: 'invoice', module: 'routing', category: 'Routing & Keuangan', title: 'Mencatat invoice terbit', href: '/routing',
    image: '/api/panduan/screenshot/financial', imageAlt: 'Tab Keuangan SPK dengan urutan Nilai SPK, Opname, PAD, Invoice',
    steps: [
      'Setelah PAD, buka tahap Invoiced pada dokumen di Routing Monitor.',
      'Gunakan Simpan progres jika invoice masih dikerjakan; status belum dianggap Invoiced.',
      'Saat invoice benar-benar terbit, klik Selesaikan invoice, isi nilai invoice dan data pendukung, lalu klik Simpan invoice.',
      'Pastikan status Invoice di Detail SPK > Keuangan serta kolom Invoiced di Financial Report sudah mengikuti perubahan.',
    ],
  },
  {
    id: 'laporan', module: 'report', category: 'Routing & Keuangan', title: 'Membaca dan mengunduh Financial Report', href: '/reports/financial',
    image: '/api/panduan/screenshot/financial', imageAlt: 'Contoh rangkaian data keuangan pada Detail SPK',
    steps: [
      'Buka Invoicing > Financial Report untuk melihat nilai SPK, Opname, PAD, denda, dan Invoiced per SPK.',
      'Gunakan pencarian, filter kolom, dan pengurutan untuk menemukan SPK atau periode yang dicari.',
      'Klik SPK yang perlu diperiksa untuk melihat detailnya. Perubahan Opname dan PAD dilakukan pada data SPK, bukan pada angka ringkasan dashboard.',
      'Klik Download laporan untuk mendapatkan seluruh data laporan keuangan.',
    ],
  },
  {
    id: 'rab', module: 'rab_monitoring', category: 'Routing & Keuangan', title: 'Menambah dan mengedit transaksi RAB', href: '/financial/rab',
    image: '/api/panduan/screenshot/overview', imageAlt: 'Dashboard yang menampilkan ringkasan anggaran dan realisasi RAB',
    steps: [
      'Buka Expense > Monitoring RAB dan pilih Seluruh bulan atau bulan tertentu pada Tampilan.',
      'Klik Add Data, pilih kode akun, isi kategori, tanggal, deskripsi, jumlah, serta detail lain yang diminta formulir.',
      'Klik Simpan transaksi. Untuk koreksi, cari transaksi pada tabel lalu klik ikon pensil dan Simpan perubahan.',
      'Gunakan Download Serapan RAB untuk rekap. Pada halaman kategori pengeluaran, tersedia Download Template, unggah data, dan Download Data.',
    ],
  },
  {
    id: 'pengeluaran', module: 'spending', category: 'Routing & Keuangan', title: 'Mengelola UMK, SPPD, PPBJ, gaji, dan MCU', href: '/financial/umk',
    image: '/api/panduan/screenshot/overview', imageAlt: 'Overview dengan Total Pengeluaran dan realisasi RAB',
    steps: [
      'Pilih kategori yang sesuai pada menu Expense: UMK, SPPD, PPBJ Barang, PPBJ Jasa, Gaji PTT Project, atau MCU.',
      'Klik Add Data untuk memasukkan transaksi baru dan isi kolom kategori, kode akun, tanggal, uraian, personel bila ada, serta nilai.',
      'Untuk banyak baris, unduh template kategori, isi tanpa mengubah susunan kolom, lalu gunakan Upload Excel.',
      'Cari baris yang salah dan klik ikon pensil untuk mengoreksi. Pastikan jumlahnya tercermin pada Monitoring RAB.',
    ],
  },
  {
    id: 'users', module: 'user_management', category: 'Administrasi', title: 'Menambah dan mengubah pengguna', href: '/admin/users',
    image: '/api/panduan/screenshot/roles', imageAlt: 'Menu Administration dan tabel Role & Permission',
    steps: [
      'Buka Administration > User, lalu klik Tambah user.',
      'Isi identitas, email, role, dan informasi lain yang diperlukan; simpan untuk membuat akun.',
      'Untuk mengubah akun, cari nama atau email pengguna lalu klik ikon pensil pada kolom Aksi.',
      'Untuk menghapus akun, klik ikon tempat sampah dan baca konfirmasi. Riwayat Audit Log tetap tersedia sesuai kebijakan sistem.',
    ],
    note: 'Aksi hanya tersedia bagi role yang mempunyai izin. Jangan menghapus akun yang masih dipakai tanpa memastikan dampaknya.',
  },
  {
    id: 'roles', module: 'user_management', category: 'Administrasi', title: 'Mengatur role dan permission', href: '/admin/roles',
    image: '/api/panduan/screenshot/roles', imageAlt: 'Tabel Role & Permission dengan ikon edit pada kolom Aksi',
    steps: [
      'Buka Administration > Role & Permission.',
      'Super Admin dapat klik Tambah role untuk membuat role baru. Klik ikon pensil pada role untuk membuka pengaturan permission.',
      'Pilih hak View, Create, atau Edit per modul, kemudian simpan perubahan.',
      'Bila role tidak lagi diperlukan, gunakan ikon hapus setelah memastikan pengguna yang bergantung pada role tersebut telah ditangani.',
    ],
    note: 'Perubahan permission dapat langsung memengaruhi menu dan aksi yang terlihat oleh pengguna.',
  },
  {
    id: 'template-audit', module: 'audit_log', category: 'Administrasi', title: 'Memeriksa template dan riwayat perubahan', href: '/admin/audit-log',
    image: '/api/panduan/screenshot/roles', imageAlt: 'Area Administration tempat Activity Template, Routing Template, dan Audit Log tersedia',
    steps: [
      'Buka Activity Template untuk meninjau susunan aktivitas dan bobotnya; buka Routing Template untuk meninjau urutan tahap dokumen.',
      'Gunakan Recent Activity untuk ringkasan perubahan terbaru beserta SPK yang terdampak.',
      'Buka Audit Log untuk riwayat lengkap, termasuk perubahan sistem dan penghapusan data turunan.',
      'Jika hasil perubahan tidak sesuai, catat SPK, waktu, pengguna, dan field yang berubah sebelum melakukan koreksi.',
    ],
  },
]
