import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  Contact,
  Database,
  FileCheck2,
  FilePlus2,
  FileSignature,
  FileStack,
  FileText,
  FolderKanban,
  Gauge,
  History,
  LayoutDashboard,
  ListChecks,
  Map,
  PencilRuler,
  Percent,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
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

/** Section 7 — Struktur Menu. Rendered per user permission. */
export const NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', href: '/dashboard', icon: Gauge, module: 'dashboard', ready: true, phase: 1 },
      { label: 'Bottleneck', href: '/dashboard/bottleneck', icon: AlertTriangle, module: 'dashboard', phase: 8 },
      { label: "Today's Schedule", href: '/dashboard/today', icon: Sun, module: 'dashboard', phase: 8 },
      { label: 'Recent Activity', href: '/dashboard/activity', icon: Activity, module: 'audit_log', phase: 8 },
    ],
  },
  {
    label: 'SPK',
    icon: FolderKanban,
    items: [
      { label: 'Semua SPK', href: '/spk', icon: FolderKanban, module: 'spk', ready: true, phase: 2 },
      { label: 'SPK On Going', href: '/spk?status=ongoing', icon: Workflow, module: 'spk', ready: true, phase: 2 },
      { label: 'SPK Selesai', href: '/spk?status=selesai', icon: CheckCircle2, module: 'spk', ready: true, phase: 2 },
      { label: 'Buat SPK Baru', href: '/spk/new', icon: FilePlus2, module: 'spk', action: 'create', ready: true, phase: 2 },
    ],
  },
  {
    label: 'Schedule',
    icon: CalendarDays,
    items: [
      { label: 'Calendar', href: '/schedule', icon: CalendarDays, module: 'schedule', ready: true, phase: 4 },
      { label: 'Daily Plan', href: '/schedule/daily-plan', icon: ListChecks, module: 'daily_plan', ready: true, phase: 4 },
      { label: 'Daily Progress', href: '/schedule/daily-progress', icon: CalendarCheck, module: 'daily_progress', ready: true, phase: 4 },
      { label: 'Team Schedule', href: '/schedule/team', icon: Users, module: 'schedule', ready: true, phase: 4 },
    ],
  },
  {
    label: 'Vendor Jasa Survey',
    icon: Users,
    items: [
      { label: 'Daftar Vendor', href: '/vendor', icon: Contact, module: 'vendor', ready: true, phase: 2 },
      { label: 'Team', href: '/vendor/team', icon: Users, module: 'vendor', ready: true, phase: 2 },
      { label: 'Assignment', href: '/vendor/assignment', icon: Map, module: 'vendor', ready: true, phase: 2 },
      { label: 'Productivity', href: '/vendor/productivity', icon: Percent, module: 'vendor', ready: true, phase: 4 },
    ],
  },
  {
    label: 'Design',
    icon: PencilRuler,
    items: [
      { label: 'Design Queue', href: '/design', icon: PencilRuler, module: 'design', ready: true, phase: 5 },
      { label: 'Review', href: '/design/review', icon: FileCheck2, module: 'design', ready: true, phase: 5 },
      { label: 'Revision', href: '/design/revision', icon: History, module: 'design', ready: true, phase: 5 },
      { label: 'Final Design', href: '/design/final', icon: ShieldCheck, module: 'design', ready: true, phase: 5 },
    ],
  },
  {
    label: 'Routing',
    icon: FileStack,
    items: [
      { label: 'Routing Monitor', href: '/routing', icon: FileStack, module: 'routing', ready: true, phase: 6 },
      { label: 'Pending Approval', href: '/routing/pending', icon: FileSignature, module: 'routing', ready: true, phase: 6 },
      { label: 'Routing History', href: '/routing/history', icon: History, module: 'routing', ready: true, phase: 6 },
    ],
  },
  {
    label: 'Financial',
    icon: Wallet,
    items: [
      { label: 'Contract', href: '/financial/contract', icon: FileSignature, module: 'contract', ready: true, phase: 7 },
      { label: 'Opname', href: '/financial/opname', icon: ClipboardList, module: 'opname', ready: true, phase: 7 },
      { label: 'PAD', href: '/financial/pad', icon: FileCheck2, module: 'pad', ready: true, phase: 7 },
      { label: 'Invoice', href: '/financial/invoice', icon: Receipt, module: 'invoice', ready: true, phase: 7 },
      { label: 'Payment', href: '/financial/payment', icon: Wallet, module: 'payment', ready: true, phase: 7 },
      { label: 'Spending', href: '/financial/spending', icon: Coins, module: 'spending', ready: true, phase: 7 },
      { label: 'Margin per SPK', href: '/financial/margin', icon: Percent, module: 'margin', ready: true, phase: 7 },
    ],
  },
  {
    label: 'Reports',
    icon: FileText,
    items: [
      { label: 'Project Report', href: '/reports/project', icon: FileText, module: 'report', phase: 8 },
      { label: 'SPK Report', href: '/reports/spk', icon: FileText, module: 'report', phase: 8 },
      { label: 'Progress Report', href: '/reports/progress', icon: Percent, module: 'report', phase: 8 },
      { label: 'Financial Report', href: '/reports/financial', icon: Wallet, module: 'report', phase: 8 },
    ],
  },
  {
    label: 'Administration',
    icon: Settings2,
    items: [
      { label: 'User', href: '/admin/users', icon: UserCog, module: 'user_management', ready: true, phase: 1 },
      { label: 'Role & Permission', href: '/admin/roles', icon: ShieldCheck, module: 'user_management', ready: true, phase: 1 },
      { label: 'Master Vendor', href: '/admin/vendors', icon: Contact, module: 'master_data', ready: true, phase: 2 },
      { label: 'Master Personnel', href: '/admin/personnel', icon: Users, module: 'master_data', phase: 2 },
      { label: 'Cash Ledger Category', href: '/admin/cash-categories', icon: Coins, module: 'master_data', ready: true, phase: 7 },
      { label: 'Activity Template', href: '/admin/activity-templates', icon: Database, module: 'master_data', ready: true, phase: 3 },
      { label: 'Routing Template', href: '/admin/routing-templates', icon: Workflow, module: 'master_data', ready: true, phase: 6 },
      { label: 'Audit Log', href: '/admin/audit-log', icon: ScrollText, module: 'audit_log', ready: true, phase: 1 },
    ],
  },
]
