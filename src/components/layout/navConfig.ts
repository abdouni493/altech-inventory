import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  ClipboardList,
  Building2,
  Truck,
  UserCog,
  Wallet,
  Banknote,
  PieChart,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/types'
import type { TranslationKey } from '@/i18n/translations'

export interface NavItem {
  key: ModuleKey
  path: string
  labelKey: TranslationKey
  icon: LucideIcon
  color: string
  /** Alt + this key opens the module from anywhere. */
  hotkey: string
}

// Icons & accents of the Altech Inventory identity (blue · cyan · amber · green).
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, color: '#8EA6FF', hotkey: '1' },
  { key: 'affectations', path: '/affectations', labelKey: 'affectations', icon: ClipboardList, color: '#FFC24D', hotkey: '2' },
  { key: 'stock', path: '/stock', labelKey: 'stock', icon: Boxes, color: '#5EEAD4', hotkey: '3' },
  { key: 'purchase', path: '/purchase', labelKey: 'purchase', icon: ShoppingBag, color: '#7DD3FC', hotkey: '4' },
  { key: 'departments', path: '/departments', labelKey: 'departments', icon: Building2, color: '#93C5FD', hotkey: '5' },
  { key: 'suppliers', path: '/suppliers', labelKey: 'suppliers', icon: Truck, color: '#67E8F9', hotkey: '6' },
  { key: 'workers', path: '/workers', labelKey: 'workers', icon: UserCog, color: '#C7D2FE', hotkey: '7' },
  { key: 'expenses', path: '/expenses', labelKey: 'expenses', icon: Wallet, color: '#FCA5A5', hotkey: 'E' },
  { key: 'budget', path: '/budget', labelKey: 'budget', icon: Banknote, color: '#6EE7B7', hotkey: 'B' },
  { key: 'reports', path: '/reports', labelKey: 'reports', icon: PieChart, color: '#FDE68A', hotkey: 'R' },
  { key: 'settings', path: '/settings', labelKey: 'settings', icon: Settings, color: '#CBD5E1', hotkey: 'P' },
]
