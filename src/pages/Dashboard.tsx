import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Boxes,
  ShoppingCart,
  Wallet,
  Coins,
  AlertTriangle,
  HardHat,
  CalendarClock,
  CalendarX,
  ClipboardList,
  Building2,
  Landmark,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/Misc'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/i18n/useTranslation'
import { useProductStore } from '@/store/useProductStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useCaisseStore } from '@/store/useCaisseStore'
import {
  dashboardStats,
  last12Months,
  supplierStats,
  orgWealth,
  departmentBreakdown,
  periodAffectedProducts,
} from '@/utils/calculations'
import { formatMoney, formatNumber, expiryInfo, type ExpiryInfo } from '@/utils/helpers'
import type { Product } from '@/types'
import { fadeUp, staggerContainer } from '@/utils/animations'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const PIE_COLORS = ['#2F5BFF', '#00B8D9', '#6366F1', '#F5A524', '#12B76A', '#0EA5E9']
const ALL_TIME = [new Date(0), new Date(8640000000000000)] as const

const Panel = ({ title, icon, action, children, className = '' }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <motion.div variants={fadeUp} className={`card-wood rounded-xl p-5 ${className}`}>
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h3 className="text-display text-lg font-bold text-wood-dark">{title}</h3>
      {action && <div className="ms-auto">{action}</div>}
    </div>
    {children}
  </motion.div>
)

export const Dashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const products = useProductStore((s) => s.products)
  const purchases = usePurchaseStore((s) => s.purchases)
  const expenses = useExpenseStore((s) => s.expenses)
  const suppliers = useSupplierStore((s) => s.suppliers)
  const workers = useWorkerStore((s) => s.workers)
  const affectations = useAffectationStore((s) => s.affectations)
  const departments = useDepartmentStore((s) => s.departments)
  const transactions = useCaisseStore((s) => s.transactions)

  const stats = useMemo(
    () => dashboardStats(purchases, expenses, products, workers, affectations),
    [purchases, expenses, products, workers, affectations],
  )
  const wealth = useMemo(
    () => orgWealth(transactions, purchases, expenses, workers, products, affectations),
    [transactions, purchases, expenses, workers, products, affectations],
  )
  const monthly = useMemo(() => last12Months(purchases, expenses, affectations), [purchases, expenses, affectations])
  const topDeps = useMemo(
    () => departmentBreakdown(affectations, departments, ...ALL_TIME).filter((d) => d.count > 0).slice(0, 6),
    [affectations, departments],
  )
  const topProducts = useMemo(() => periodAffectedProducts(affectations, products, ...ALL_TIME).slice(0, 6), [affectations, products])

  const supplierDebts = useMemo(
    () =>
      suppliers
        .map((s) => ({ ...s, ...supplierStats(s.id, purchases) }))
        .filter((s) => s.totalDebt > 0)
        .sort((a, b) => b.totalDebt - a.totalDebt),
    [suppliers, purchases],
  )

  const lowStock = useMemo(() => products.filter((p) => p.quantity <= p.minQuantity), [products])

  const expiryAlerts = useMemo(() => {
    const rows: { product: Product; info: ExpiryInfo }[] = []
    for (const p of products) {
      if (!p.hasExpiration || !p.expirationDate) continue
      const info = expiryInfo(p.expirationDate)
      if (info && info.status !== 'ok') rows.push({ product: p, info })
    }
    rows.sort((a, b) => a.info.days - b.info.days)
    return {
      expired: rows.filter((r) => r.info.status === 'expired'),
      soon: rows.filter((r) => r.info.status === 'soon'),
    }
  }, [products])
  const recentAffectations = useMemo(() => [...affectations].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6), [affectations])
  const recentPurchases = useMemo(() => [...purchases].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5), [purchases])
  const recentExpenses = useMemo(() => [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5), [expenses])

  const activeWorkers = workers.filter((w) => w.active).length
  const salaryDue = workers.filter((w) => w.hasSalary && w.active).reduce((s, w) => s + (w.salaryType === 'monthly' ? w.salaryAmount : w.salaryAmount * 26), 0)

  const kpis = [
    {
      icon: <ClipboardList size={22} />,
      label: t('affectationsMonth'),
      value: stats.affectationsMonth,
      accent: 'from-wood-warm to-gold',
      hint: <>{formatMoney(stats.affectedValueMonth)} · {t('today')}: {stats.affectationsToday}</>,
    },
    {
      icon: <Boxes size={22} />,
      label: t('productsInStock'),
      value: stats.productsInStock,
      accent: 'from-wood-medium to-wood-light',
      hint: (
        <>
          <span className="text-mono">{stats.productsInStock}</span> / {products.length} ·{' '}
          <span className="text-terracotta">{stats.stockAlertCount} {t('stockAlerts').toLowerCase()}</span>
        </>
      ),
    },
    { icon: <Coins size={22} />, label: t('inventoryValue'), value: wealth.stockValue, suffix: 'DA', decimals: true, accent: 'from-sage to-emerald-500' },
    { icon: <Building2 size={22} />, label: t('departments'), value: departments.length, accent: 'from-sky-500 to-indigo-600', hint: <>{affectations.length} {t('affectations').toLowerCase()}</> },
    { icon: <ShoppingCart size={22} />, label: t('purchasesMonth'), value: stats.purchasesMonth, suffix: 'DA', decimals: true, accent: 'from-wood-light to-wood-blonde', hint: <>{t('spentMonth')}: {formatMoney(stats.spentMonth)}</> },
    { icon: <Landmark size={22} />, label: t('caisseBalance'), value: wealth.budgetBalance, suffix: 'DA', decimals: true, accent: wealth.budgetBalance >= 0 ? 'from-gold to-gold-light' : 'from-terracotta to-rose-600' },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <PageHeader title={t('dashboard')} subtitle={format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k, i) => (
          <StatCard key={k.label} index={i} {...k} />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel title={t('monthlyFlows')} icon={<TrendingUp size={18} className="text-wood-warm" />} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="gAff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2F5BFF" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#2F5BFF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00B8D9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00B8D9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#56627A' }} />
              <YAxis tick={{ fontSize: 11, fill: '#56627A' }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="affectations" name={t('affectations')} stroke="#2F5BFF" strokeWidth={2.5} fill="url(#gAff)" />
              <Area type="monotone" dataKey="purchases" name={t('purchase')} stroke="#00B8D9" strokeWidth={2.5} fill="url(#gPur)" />
              <Area type="monotone" dataKey="expenses" name={t('expenses')} stroke="#F59E0B" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('topDepartments')} icon={<Building2 size={18} className="text-wood-warm" />} className="lg:col-span-2">
          {topDeps.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <ResponsiveContainer width="100%" height={190} className="max-w-[220px]">
                <PieChart>
                  <Pie data={topDeps} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {topDeps.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full flex-1 space-y-2">
                {topDeps.map((d, i) => (
                  <div key={d.departmentId} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate text-sm text-wood-dark">{d.name}</span>
                    <span className="text-mono text-xs font-bold text-wood-medium">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Expiration alerts */}
      {(expiryAlerts.expired.length > 0 || expiryAlerts.soon.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title={t('expiredProducts')} icon={<CalendarX size={18} className="text-terracotta" />}>
            {expiryAlerts.expired.length === 0 ? (
              <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
            ) : (
              <div className="space-y-2">
                {expiryAlerts.expired.slice(0, 6).map(({ product, info }) => (
                  <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl bg-terracotta/8 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-wood-dark">{product.name}</p>
                      <p className="text-[11px] text-wood-medium">{product.brand}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/15 px-2.5 py-0.5 text-[11px] font-semibold text-terracotta">
                      <CalendarX size={12} />
                      {info.days === 0 ? t('expiresToday') : t('expiredSinceDays').replace('{n}', String(Math.abs(info.days)))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={t('expiringSoonProducts')} icon={<CalendarClock size={18} className="text-[#B45309]" />}>
            {expiryAlerts.soon.length === 0 ? (
              <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
            ) : (
              <div className="space-y-2">
                {expiryAlerts.soon.slice(0, 6).map(({ product, info }) => (
                  <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl bg-gold/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-wood-dark">{product.name}</p>
                      <p className="text-[11px] text-wood-medium">{format(new Date(product.expirationDate!), 'dd/MM/yyyy')}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
                      <CalendarClock size={12} />
                      {info.days === 0 ? t('expiresToday') : t('expiresInDays').replace('{n}', String(info.days))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Recent affectations + most affected products */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          title={t('recentAffectations')}
          icon={<ClipboardList size={18} className="text-wood-warm" />}
          className="lg:col-span-3"
          action={
            <button onClick={() => navigate('/affectations')} className="inline-flex items-center gap-1 text-xs font-semibold text-wood-warm hover:underline">
              {t('view')} <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          }
        >
          {recentAffectations.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noAffectations')}</p>
          ) : (
            <div className="space-y-2">
              {recentAffectations.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-wood-cream/40 px-3 py-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wood-btn text-white"><ClipboardList size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-wood-dark">{a.departmentName}</p>
                    <p className="truncate text-[11px] text-wood-medium">{a.reference} · {format(new Date(a.date), 'dd/MM/yyyy')} · {a.lines.map((l) => l.productName).join(', ')}</p>
                  </div>
                  <span className="text-mono shrink-0 text-sm font-bold text-sage">{formatMoney(a.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('mostAffected')} icon={<Boxes size={18} className="text-wood-warm" />} className="lg:col-span-2">
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#56627A' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: '#56627A' }} />
                <Tooltip formatter={(v: number) => formatNumber(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
                <Bar dataKey="quantity" name={t('affectedQty')} radius={[0, 6, 6, 0]}>
                  {topProducts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Alerts & debts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('stockAlerts')} icon={<AlertTriangle size={18} className="text-terracotta" />}>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-terracotta/5 px-3 py-2">
                  <span className="truncate text-sm font-medium text-wood-dark">{p.name}</span>
                  <Badge tone="unpaid">{p.quantity} / {p.minQuantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('recentPurchases')} icon={<ShoppingCart size={18} className="text-wood-medium" />}>
          <div className="space-y-2">
            {recentPurchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-wood-cream/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-wood-dark">{p.supplierName}</p>
                  <p className="text-[11px] text-wood-medium">{p.reference} · {format(new Date(p.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono text-sm font-bold text-wood-warm">{formatMoney(p.total)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t('supplierDebts')} icon={<ShoppingCart size={18} className="text-wood-medium" />}>
          {supplierDebts.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="space-y-2">
              {supplierDebts.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-wood-cream/40 px-3 py-2">
                  <span className="truncate text-sm font-medium text-wood-dark">{s.name}</span>
                  <span className="text-mono text-sm font-bold text-terracotta">{formatMoney(s.totalDebt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Employees + expenses */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('workers')} icon={<HardHat size={18} className="text-gold" />}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sage/10 p-3 text-center">
              <p className="text-mono text-2xl font-bold text-sage">{activeWorkers}</p>
              <p className="text-xs text-wood-medium">{t('activeWorkers')}</p>
            </div>
            <div className="rounded-xl bg-terracotta/10 p-3 text-center">
              <p className="text-mono text-2xl font-bold text-terracotta">{workers.length - activeWorkers}</p>
              <p className="text-xs text-wood-medium">{t('inactive')}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-gold/10 p-3 text-center">
              <p className="text-mono text-xl font-bold text-[#B45309]">{formatMoney(salaryDue)}</p>
              <p className="text-xs text-wood-medium">{t('salariesToPay')}</p>
            </div>
          </div>
        </Panel>

        <Panel title={t('recentExpenses')} icon={<Wallet size={18} className="text-terracotta" />} className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-wood-cream/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-wood-dark">{e.name}</p>
                  <p className="text-[11px] text-wood-medium">{format(new Date(e.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono text-sm font-bold text-terracotta">{formatMoney(e.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </motion.div>
  )
}
