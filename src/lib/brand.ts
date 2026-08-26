/** Single source for the product name. Change it here, not in the pages. */
export const BRAND = {
  name: 'PRISMA',
  expansion: 'Project Reporting, Integration, Status Monitoring & Analytics',
  /** Shown under the wordmark where there is room for one line. */
  tagline: 'Project Reporting, Integration, Status Monitoring & Analytics',
  owner: 'PT SUCOFINDO (PERSERO)',
  project: 'Survei Topografi Lokasi Bor dan Fasilitas Produksi',
  client: 'Pertamina EP Zona 4 Prabumulih',
  year: 2026,
} as const

/** The five words the acronym stands for, for the login panel. */
export const BRAND_LETTERS = [
  { letter: 'P', word: 'Project' },
  { letter: 'R', word: 'Reporting' },
  { letter: 'I', word: 'Integration' },
  { letter: 'S', word: 'Status Monitoring' },
  { letter: 'A', word: 'Analytics' },
] as const
