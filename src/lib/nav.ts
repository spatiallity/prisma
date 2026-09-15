import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  Banknote,
  Briefcase,
  Calculator,
  ClipboardCheck,
  Database,
  FileSignature,
  FileStack,
  FolderKanban,
  Gauge,
  HandCoins,
  HeartPulse,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  LineChart,
  MapPin,
  Package,
  PencilRuler,
  Plane,
  Receipt,
  ReceiptText,
  Route,
  ScrollText,
  Settings2,
  ShieldCheck,
  Stamp,
  UserCog,
  Wallet,
  Workflow,
} from 'lucide-react'
import type { AppAction, AppModule } from '@/lib/auth/permissions'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  module: AppModule
  action?: AppAction
  /** false → rendered greyed out with its phase, so the shell reflects Section 7. */
  ready?: boolean
  /** Development phase from Section 37. */
  phase: number
}

export type NavGroup = {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

/** Section 7 — Struktur Menu. Rendered per user permission. Every icon here
 *  is used exactly once across the whole nav — group headers included — so
 *  the rail never has two entries a user could confuse by silhouette alone. */
export const NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', href: '/dashboard', icon: Gauge, module: 'dashboard', ready: true, phase: 1 },
      { label: 'Bottleneck', href: '/dashboard/bottleneck', icon: AlertTriangle, module: 'dashboard', ready: true, phase: 8 },
      { label: 'Recent Activity', href: '/dashboard/activity', icon: Activity, module: 'audit_log', ready: true, phase: 8 },
    ],
  },
  {
    label: 'SPK',
    icon: FolderKanban,
    items: [
      {
        label: 'SPK (Surat Perintah Kerja)',
        href: '/spk',
        icon: ClipboardCheck,
        module: 'spk',
        ready: true,
        phase: 2,
      },
    ],
  },
  // Schedule and Vendor Jasa Survey are hidden from the menu for now (asked
  // to temporarily hide both) — routes, permissions and data are untouched,
  // so this is just re-adding these two groups back into NAV to bring them
  // back.
  // {
  //   label: 'Schedule',
  //   icon: CalendarDays,
  //   items: [
  //     { label: 'Calendar', href: '/schedule', icon: CalendarRange, module: 'schedule', ready: true, phase: 4 },
  //     { label: 'Daily Plan', href: '/schedule/daily-plan', icon: ListChecks, module: 'daily_plan', ready: true, phase: 4 },
  //     { label: 'Daily Progress', href: '/schedule/daily-progress', icon: CalendarCheck, module: 'daily_progress', ready: true, phase: 4 },
  //     { label: 'Team Schedule', href: '/schedule/team', icon: UsersRound, module: 'schedule', ready: true, phase: 4 },
  //   ],
  // },
  // {
  //   label: 'Vendor Jasa Survey',
  //   icon: HardHat,
  //   items: [
  //     { label: 'Daftar Vendor', href: '/vendor', icon: Contact, module: 'vendor', ready: true, phase: 2 },
  //     { label: 'Team', href: '/vendor/team', icon: Users, module: 'vendor', ready: true, phase: 2 },
  //     { label: 'Assignment', href: '/vendor/assignment', icon: Map, module: 'vendor', ready: true, phase: 2 },
  //     { label: 'Productivity', href: '/vendor/productivity', icon: TrendingUp, module: 'vendor', ready: true, phase: 4 },
  //   ],
  // },
  {
    label: 'Design',
    icon: PencilRuler,
    items: [
      { label: 'Design Queue', href: '/design', icon: Layers, module: 'design', ready: true, phase: 5 },
      { label: 'Desain Siteplan', href: '/design/siteplan', icon: MapPin, module: 'design', ready: true, phase: 5 },
      { label: 'Finalisasi Desain', href: '/design/finalisasi', icon: ShieldCheck, module: 'design', ready: true, phase: 5 },
    ],
  },
  {
    label: 'Routing',
    icon: FileStack,
    items: [
      { label: 'Routing Monitor', href: '/routing', icon: Route, module: 'routing', ready: true, phase: 6 },
      { label: 'Routing History', href: '/routing/history', icon: History, module: 'routing', ready: true, phase: 6 },
    ],
  },
  {
    label: 'Expense',
    icon: Wallet,
    items: [
      { label: 'Monitoring RAB', href: '/financial/rab', icon: Calculator, module: 'spending', ready: true, phase: 8 },
      { label: 'UMK', href: '/financial/umk', icon: Banknote, module: 'spending', ready: true, phase: 8 },
      { label: 'SPPD', href: '/financial/sppd', icon: Plane, module: 'spending', ready: true, phase: 8 },
      { label: 'PPBJ Barang', href: '/financial/ppbj-barang', icon: Package, module: 'spending', ready: true, phase: 8 },
      { label: 'PPBJ Jasa', href: '/financial/ppbj-jasa', icon: Briefcase, module: 'spending', ready: true, phase: 8 },
      { label: 'Gaji PTT Project', href: '/financial/gaji-ptt', icon: HandCoins, module: 'spending', ready: true, phase: 8 },
      { label: 'MCU', href: '/financial/mcu', icon: HeartPulse, module: 'spending', ready: true, phase: 8 },
    ],
  },
  {
    // Contract/PAD/Invoice used to be a manually-tracked client-payment
    // chain; that's now driven by the SPK itself (Nilai SPK), the design
    // Opname stage, and the routing document's PAD/Invoiced steps, so these
    // three standalone lists are hidden — routes, permissions and data are
    // untouched, so re-adding is just uncommenting. Financial Report is the
    // one surface left, reworked to read that same live data.
    label: 'Client Payment',
    icon: Receipt,
    items: [
      // { label: 'Contract', href: '/financial/contract', icon: FileSignature, module: 'contract', ready: true, phase: 7 },
      // { label: 'PAD', href: '/financial/pad', icon: Stamp, module: 'pad', ready: true, phase: 7 },
      // { label: 'Invoice', href: '/financial/invoice', icon: ReceiptText, module: 'invoice', ready: true, phase: 7 },
      { label: 'Financial Report', href: '/reports/financial', icon: LineChart, module: 'report', ready: true, phase: 8 },
    ],
  },
  {
    label: 'Administration',
    icon: Settings2,
    items: [
      { label: 'User', href: '/admin/users', icon: UserCog, module: 'user_management', ready: true, phase: 1 },
      { label: 'Role & Permission', href: '/admin/roles', icon: KeyRound, module: 'user_management', ready: true, phase: 1 },
      { label: 'Activity Template', href: '/admin/activity-templates', icon: Database, module: 'master_data', ready: true, phase: 3 },
      { label: 'Routing Template', href: '/admin/routing-templates', icon: Workflow, module: 'master_data', ready: true, phase: 6 },
      { label: 'Audit Log', href: '/admin/audit-log', icon: ScrollText, module: 'audit_log', ready: true, phase: 1 },
    ],
  },
]
