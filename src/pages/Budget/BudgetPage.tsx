import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  Plus,
  Minus,
  Landmark,
  Wallet,
  Boxes,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  ShoppingCart,
  HardHat,
  Pencil,
  Trash2,
  Check,
  Scale,
  ArrowRightLeft,
  Tags,
  Package,
  HandCoins,
  Receipt,
  Layers,
  Building2,
  ClipboardList,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader, EmptyState } from '@/components/ui/Misc'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCaisseStore } from '@/store/useCaisseStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useProductStore } from '@/store/useProductStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useTranslation } from '@/i18n/useTranslation'
import {
  budgetPeriodStats,
  orgWealth,
  categoryBreakdown,
  periodAffectedProducts,
  periodPurchasedProducts,
  periodWorkerMovements,
  departmentBreakdown,
} from '@/utils/calculations'
import { formatMoney } from '@/utils/helpers'
import { cardVariants, fadeUp, staggerContainer } from '@/utils/animations'
import type { CaisseTransaction, CaisseType } from '@/types'

type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom'

const Panel = ({ title, icon, action, children, className = '' }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
  <motion.div variants={fadeUp} className={`card-wood rounded-xl p-5 ${className}`}>
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h3 className="text-display text-lg font-bold text-wood-dark">{title}</h3>
      {action && <div className="ms-auto">{action}</div>}
    </div>
    {children}
  </motion.div>
)

/** Compact, scrollable ledger table. Cells may be strings, numbers or nodes. */
const MiniTable = ({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) =>
  rows.length === 0 ? (
    <p className="py-6 text-center text-sm text-wood-medium">{empty}</p>
  ) : (
    <div className="max-h-72 overflow-auto rounded-xl border border-wood-light/20">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-wood-cream/90 backdrop-blur">
          <tr className="text-[11px] uppercase tracking-wide text-wood-medium">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i === 0 ? 'text-start' : 'text-end'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-wood-light/15 transition hover:bg-wood-cream/30">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-medium text-wood-dark' : 'text-mono text-end'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

export const BudgetPage = () => {
  const { t } = useTranslation()
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useCaisseStore()
  const purchases = usePurchaseStore((s) => s.purchases)
  const expenses = useExpenseStore((s) => s.expenses)
  const workers = useWorkerStore((s) => s.workers)
  const products = useProductStore((s) => s.products)
  const affectations = useAffectationStore((s) => s.affectations)
  const departments = useDepartmentStore((s) => s.departments)

  const [period, setPeriod] = useState<PeriodKey>('year')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [moveFilter, setMoveFilter] = useState<'all' | CaisseType>('all')
  const [catFilter, setCatFilter] = useState<string>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CaisseTransaction | null>(null)
  const [form, setForm] = useState<{ type: CaisseType; amount: number; description: string; date: string }>({
    type: 'deposit',
    amount: 0,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [deleting, setDeleting] = useState<CaisseTransaction | null>(null)

  const { start, end, label } = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now), label: format(now, 'dd MMMM yyyy', { locale: frLocale }) }
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: t('thisWeek') }
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now), label: format(now, 'yyyy') }
      case 'custom': {
        const s = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now)
        const e = customTo ? endOfDay(new Date(customTo)) : endOfDay(now)
        return { start: s, end: e, label: `${format(s, 'dd/MM/yyyy')} — ${format(e, 'dd/MM/yyyy')}` }
      }
      case 'month':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: frLocale }) }
    }
  }, [period, customFrom, customTo, t])

  const wealth = useMemo(
    () => orgWealth(transactions, purchases, expenses, workers, products, affectations),
    [transactions, purchases, expenses, workers, products, affectations],
  )

  const stats = useMemo(
    () => budgetPeriodStats(transactions, purchases, expenses, workers, affectations, start, end),
    [transactions, purchases, expenses, workers, affectations, start, end],
  )

  const periodTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => {
          const d = new Date(tx.date)
          const inRange = d >= start && d <= end
          const matchType = moveFilter === 'all' || tx.type === moveFilter
          return inRange && matchType
        })
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [transactions, start, end, moveFilter],
  )

  const chartData = useMemo(
    () => [
      { name: t('deposit'), value: stats.deposits, kind: 'in' as const },
      { name: t('purchase'), value: stats.purchasesPaid, kind: 'out' as const },
      { name: t('expenses'), value: stats.expenses, kind: 'out' as const },
      { name: t('workers'), value: stats.salaries, kind: 'out' as const },
      { name: t('withdrawal'), value: stats.withdrawals, kind: 'out' as const },
    ],
    [stats, t],
  )

  // ---- Detailed period ledger (every small movement of the organisation) --
  const catRows = useMemo(
    () => categoryBreakdown(purchases, affectations, products, start, end),
    [purchases, affectations, products, start, end],
  )
  const affectedRows = useMemo(
    () => periodAffectedProducts(affectations, products, start, end),
    [affectations, products, start, end],
  )
  const purchasedRows = useMemo(
    () => periodPurchasedProducts(purchases, products, start, end),
    [purchases, products, start, end],
  )
  const depRows = useMemo(
    () => departmentBreakdown(affectations, departments, start, end).filter((d) => d.count > 0),
    [affectations, departments, start, end],
  )
  const periodExpenses = useMemo(
    () =>
      expenses
        .filter((e) => { const d = new Date(e.date); return d >= start && d <= end })
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [expenses, start, end],
  )
  const workerMov = useMemo(() => periodWorkerMovements(workers, start, end), [workers, start, end])

  const affectedFiltered = catFilter === 'all' ? affectedRows : affectedRows.filter((r) => r.category === catFilter)
  const purchasedFiltered = catFilter === 'all' ? purchasedRows : purchasedRows.filter((r) => r.category === catFilter)
  const totalAffectedValue = affectedFiltered.reduce((s, r) => s + r.value, 0)
  const totalPurchasedCost = purchasedFiltered.reduce((s, r) => s + r.total, 0)
  const totalUnitsAffected = affectedFiltered.reduce((s, r) => s + r.quantity, 0)
  const consumption = stats.cashIn > 0 ? Math.min(100, (stats.cashOut / stats.cashIn) * 100) : 0

  const periods: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: t('today') },
    { key: 'week', label: t('thisWeek') },
    { key: 'month', label: t('thisMonth') },
    { key: 'year', label: t('thisYear') },
    { key: 'custom', label: t('period') },
  ]

  const openNew = (type: CaisseType) => {
    setEditing(null)
    setForm({ type, amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const openEdit = (tx: CaisseTransaction) => {
    setEditing(tx)
    setForm({ type: tx.type, amount: tx.amount, description: tx.description, date: format(new Date(tx.date), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const save = () => {
    if (form.amount <= 0) {
      toast.error(t('required'))
      return
    }
    const payload = {
      type: form.type,
      amount: form.amount,
      description: form.description.trim(),
      date: new Date(form.date).toISOString(),
    }
    if (editing) updateTransaction(editing.id, payload)
    else addTransaction(payload)
    toast.success(t('saved'))
    setFormOpen(false)
  }

  // Big-picture KPIs (all-time, date-independent)
  const kpis = [
    {
      icon: <Landmark size={22} />,
      label: t('caisseBalance'),
      value: wealth.budgetBalance,
      suffix: 'DA',
      decimals: true,
      accent: wealth.budgetBalance >= 0 ? 'from-sage to-emerald-500' : 'from-terracotta to-rose-600',
      hint: t('caisseSubtitle'),
    },
    {
      icon: <Scale size={22} />,
      label: t('storeMoney'),
      value: wealth.totalWealth,
      suffix: 'DA',
      decimals: true,
      accent: 'from-gold to-gold-light',
      hint: t('storeOverview'),
    },
    {
      icon: <Boxes size={22} />,
      label: t('stockValue'),
      value: wealth.stockValue,
      suffix: 'DA',
      decimals: true,
      accent: 'from-wood-medium to-wood-light',
      hint: t('stockValue'),
    },
    {
      icon: <Truck size={22} />,
      label: t('supplierPayables'),
      value: wealth.supplierPayables,
      suffix: 'DA',
      decimals: true,
      accent: 'from-wood-warm to-gold',
      hint: <span className="inline-flex items-center gap-1"><ClipboardList size={12} /> {t('affectedValue')}: {formatMoney(wealth.affectedValue)}</span>,
    },
  ]

  // Detailed period calculation cards
  const detailCards = [
    { icon: <ClipboardList size={20} />, label: t('affectations'), value: stats.affectedValue, sub: t('affectedValue'), tone: 'sage', accent: 'from-sky-500 to-indigo-600' },
    { icon: <ShoppingCart size={20} />, label: t('purchase'), value: stats.purchasesTotal, sub: `${t('paid')}: ${formatMoney(stats.purchasesPaid)}`, tone: 'wood', accent: 'from-wood-warm to-gold' },
    { icon: <Wallet size={20} />, label: t('expenses'), value: stats.expenses, sub: t('periodDetails'), tone: 'terracotta', accent: 'from-terracotta to-rose-600' },
    { icon: <HardHat size={20} />, label: t('salariesPaid'), value: stats.salaries, sub: t('periodDetails'), tone: 'gold', accent: 'from-gold to-gold-light' },
    { icon: <ArrowDownCircle size={20} />, label: t('depositsTotal'), value: stats.deposits, sub: t('movements'), tone: 'sage', accent: 'from-sage to-emerald-500' },
    { icon: <ArrowUpCircle size={20} />, label: t('withdrawalsTotal'), value: stats.withdrawals, sub: t('movements'), tone: 'terracotta', accent: 'from-terracotta to-rose-600' },
  ]

  // Cash breakdown (waterfall) rows for the selected period
  const breakdown = [
    { label: t('depositsTotal'), value: stats.deposits, positive: true },
    { label: `${t('paid')} — ${t('purchase')}`, value: -stats.purchasesPaid, positive: false },
    { label: t('expenses'), value: -stats.expenses, positive: false },
    { label: t('salariesPaid'), value: -stats.salaries, positive: false },
    { label: t('withdrawalsTotal'), value: -stats.withdrawals, positive: false },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <PageHeader
        title={t('budget')}
        subtitle={t('budgetSubtitle')}
        actions={
          <>
            <Button variant="sage" onClick={() => openNew('deposit')}><Plus size={18} />{t('newDeposit')}</Button>
            <Button variant="danger" onClick={() => openNew('withdrawal')}><Minus size={18} />{t('newWithdrawal')}</Button>
          </>
        }
      />

      {/* Global wealth KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <StatCard key={k.label} index={i} {...k} />
        ))}
      </div>

      {/* Period filter bar */}
      <motion.div variants={fadeUp} className="card-wood mt-5 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-wood-light/40 bg-white/60 p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                period === p.key ? 'bg-wood-btn text-white shadow-wood' : 'text-wood-medium hover:bg-wood-cream'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {period === 'custom' && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="text-xs text-wood-medium">{t('from')}</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-wood py-1.5" />
              <span className="text-xs text-wood-medium">{t('to')}</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-wood py-1.5" />
            </motion.div>
          )}
        </AnimatePresence>

        <Badge tone="gold" className="ms-auto capitalize">{label}</Badge>
      </motion.div>

      {/* Cash-flow summary */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div variants={cardVariants} custom={0} whileHover={{ y: -4 }} className="card-wood relative overflow-hidden rounded-xl p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-sage to-emerald-500 opacity-10" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sage to-emerald-500 text-white shadow-wood"><ArrowDownCircle size={20} /></div>
            <div>
              <p className="text-sm font-medium text-wood-medium">{t('cashIn')}</p>
              <p className="text-mono text-xl font-bold text-sage">{formatMoney(stats.cashIn)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} custom={1} whileHover={{ y: -4 }} className="card-wood relative overflow-hidden rounded-xl p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-terracotta to-rose-600 opacity-10" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-terracotta to-rose-600 text-white shadow-wood"><ArrowUpCircle size={20} /></div>
            <div>
              <p className="text-sm font-medium text-wood-medium">{t('cashOut')}</p>
              <p className="text-mono text-xl font-bold text-terracotta">{formatMoney(stats.cashOut)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} custom={2} whileHover={{ y: -4 }} className="card-wood relative overflow-hidden rounded-xl p-5">
          <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-10 ${stats.netFlow >= 0 ? 'from-gold to-gold-light' : 'from-terracotta to-rose-600'}`} />
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-wood ${stats.netFlow >= 0 ? 'from-gold to-gold-light' : 'from-terracotta to-rose-600'}`}><TrendingUp size={20} /></div>
            <div>
              <p className="text-sm font-medium text-wood-medium">{t('netFlow')}</p>
              <p className={`text-mono text-xl font-bold ${stats.netFlow >= 0 ? 'text-[#B45309]' : 'text-terracotta'}`}>{formatMoney(stats.netFlow)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detailed period calculation cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {detailCards.map((c, i) => (
          <motion.div key={c.label} variants={cardVariants} custom={i} whileHover={{ y: -4 }} className="card-wood relative overflow-hidden rounded-xl p-4">
            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-wood ${c.accent}`}>{c.icon}</div>
            <p className="text-xs font-medium text-wood-medium">{c.label}</p>
            <p className="text-mono mt-0.5 text-lg font-bold text-wood-dark">{formatMoney(c.value)}</p>
            <p className="mt-1 truncate text-[11px] text-wood-medium/70">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Breakdown + chart */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('caisseBreakdown')} icon={<Scale size={18} className="text-wood-warm" />}>
          <div className="space-y-1.5">
            {breakdown.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-wood-cream/40 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-wood-dark">
                  <span className={`text-base font-bold ${row.positive ? 'text-sage' : 'text-terracotta'}`}>{row.positive ? '+' : '−'}</span>
                  {row.label}
                </span>
                <span className={`text-mono text-sm font-bold ${row.positive ? 'text-sage' : 'text-terracotta'}`}>{formatMoney(Math.abs(row.value))}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-wood-header px-3 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-bold"><ArrowRightLeft size={16} /> {t('netFlow')}</span>
              <span className="text-mono text-base font-bold">{formatMoney(stats.netFlow)}</span>
            </div>
          </div>
        </Panel>

        <Panel title={t('inflowVsOutflow')} icon={<TrendingUp size={18} className="text-sage" />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#56627A' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#56627A' }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.kind === 'in' ? '#12B76A' : '#2F5BFF'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Per-category analysis — click a category to drill the tables below */}
      <motion.div variants={fadeUp} className="card-wood mt-5 rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-wood-warm" />
            <h3 className="text-display text-lg font-bold text-wood-dark">{t('categoryAnalysis')}</h3>
          </div>
          <Badge tone="gold">{t('stockValue')}: {formatMoney(catRows.reduce((s, r) => s + r.stockValue, 0))}</Badge>
        </div>
        {catRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setCatFilter('all')}
              className={`rounded-xl border p-3 text-start transition ${catFilter === 'all' ? 'border-wood-warm bg-wood-cream/60 shadow-wood' : 'border-wood-light/25 bg-white/60 hover:bg-wood-cream/40'}`}
            >
              <span className="flex items-center gap-1.5 font-semibold text-wood-dark"><Layers size={14} className="text-wood-warm" />{t('allCategories')}</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="text-wood-medium">{t('purchase')}: <b className="text-mono text-wood-dark">{formatMoney(catRows.reduce((s, r) => s + r.purchasesCost, 0))}</b></span>
                <span className="text-wood-medium">{t('affectations')}: <b className="text-mono text-sage">{formatMoney(catRows.reduce((s, r) => s + r.affectedValue, 0))}</b></span>
              </div>
            </button>
            {catRows.map((c) => (
              <button
                key={c.category}
                onClick={() => setCatFilter(catFilter === c.category ? 'all' : c.category)}
                className={`rounded-xl border p-3 text-start transition ${catFilter === c.category ? 'border-wood-warm bg-wood-cream/60 shadow-wood' : 'border-wood-light/25 bg-white/60 hover:bg-wood-cream/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-wood-dark"><Layers size={14} className="shrink-0 text-wood-warm" /><span className="truncate">{c.category}</span></span>
                  <span className="text-mono shrink-0 text-sm font-bold text-sage">{formatMoney(c.affectedValue)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="text-wood-medium">{t('purchase')}: <b className="text-mono text-wood-dark">{formatMoney(c.purchasesCost)}</b></span>
                  <span className="text-wood-medium">{t('stockValue')}: <b className="text-mono text-wood-dark">{formatMoney(c.stockValue)}</b></span>
                  <span className="text-wood-medium">{t('qtyPurchased')}: <b className="text-mono text-wood-dark">{c.qtyPurchased}</b></span>
                  <span className="text-wood-medium">{t('affectedQty')}: <b className="text-mono text-wood-dark">{c.qtyAffected}</b></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Products sold + purchased (filtered by selected category) */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={t('affectationsOut')}
          icon={<ClipboardList size={18} className="text-sage" />}
          action={<Badge tone={catFilter === 'all' ? 'gold' : 'sage'}>{catFilter === 'all' ? t('allCategories') : catFilter}</Badge>}
        >
          <MiniTable
            head={[t('productName'), t('affectedQty'), t('departments'), t('value')]}
            rows={affectedFiltered.map((r) => [
              <span key="n">{r.name}<span className="ms-1 text-[10px] text-wood-medium/60">· {r.category}</span></span>,
              r.quantity,
              r.departments,
              formatMoney(r.value),
            ])}
            empty={t('noAffectations')}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sage/10 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('units')}: <b className="text-mono text-wood-dark">{totalUnitsAffected}</b></span>
            <span className="text-mono font-bold text-sage">{formatMoney(totalAffectedValue)}</span>
          </div>
        </Panel>

        <Panel
          title={t('productsPurchased')}
          icon={<Package size={18} className="text-wood-warm" />}
          action={<Badge tone={catFilter === 'all' ? 'gold' : 'sage'}>{catFilter === 'all' ? t('allCategories') : catFilter}</Badge>}
        >
          <MiniTable
            head={[t('productName'), t('qtyPurchased'), t('total')]}
            rows={purchasedFiltered.map((r) => [
              <span key="n">{r.name}<span className="ms-1 text-[10px] text-wood-medium/60">· {r.category}</span></span>,
              r.quantity,
              formatMoney(r.total),
            ])}
            empty={t('noData')}
          />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-wood-cream/50 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('total')} — {t('purchase')}</span>
            <span className="text-mono font-bold text-wood-dark">{formatMoney(totalPurchasedCost)}</span>
          </div>
        </Panel>
      </div>

      {/* Departments served over the period + budget consumption */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('departmentAnalysis')} icon={<Building2 size={18} className="text-wood-warm" />} className="lg:col-span-2">
          <MiniTable
            head={[t('department'), t('affectations'), t('units'), t('value')]}
            rows={depRows.map((d) => [d.name, d.count, d.quantity, formatMoney(d.value)])}
            empty={t('noAffectations')}
          />
        </Panel>
        <Panel title={t('budgetConsumption')} icon={<Scale size={18} className="text-wood-warm" />}>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-wood-cream" />
                <motion.circle
                  cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" strokeLinecap="round"
                  stroke="url(#budgetGrad)"
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${consumption} 100` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="budgetGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2F5BFF" />
                    <stop offset="100%" stopColor="#00B8D9" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-mono text-2xl font-bold text-wood-dark">{consumption.toFixed(0)}%</span>
                <span className="text-[10px] text-wood-medium">{t('consumptionRate')}</span>
              </div>
            </div>
            <div className="w-full space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-wood-medium">{t('allocationsTotal')}</span><b className="text-mono text-sage">{formatMoney(stats.cashIn)}</b></div>
              <div className="flex justify-between"><span className="text-wood-medium">{t('cashOut')}</span><b className="text-mono text-terracotta">{formatMoney(stats.cashOut)}</b></div>
              <div className="flex justify-between"><span className="text-wood-medium">{t('affectedValue')}</span><b className="text-mono text-wood-dark">{formatMoney(stats.affectedValue)}</b></div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Expenses + worker movements ledger */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('expenses')} icon={<Receipt size={18} className="text-terracotta" />}>
          <MiniTable
            head={[t('name'), t('date'), t('amount')]}
            rows={periodExpenses.map((e) => [e.name, format(new Date(e.date), 'dd/MM/yyyy'), formatMoney(e.amount)])}
            empty={t('noData')}
          />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-terracotta/10 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('totalExpenses')}</span>
            <span className="text-mono font-bold text-terracotta">{formatMoney(stats.expenses)}</span>
          </div>
        </Panel>

        <Panel title={t('workerMovements')} icon={<HandCoins size={18} className="text-[#B45309]" />}>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
                <span>{t('salariesPaid')}</span>
                <span className="text-mono normal-case text-[#B45309]">{formatMoney(workerMov.totalPayments)}</span>
              </p>
              <MiniTable
                head={[t('workers'), t('date'), t('amount')]}
                rows={workerMov.payments.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), formatMoney(p.amount)])}
                empty={t('noData')}
              />
            </div>
            <div>
              <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
                <span>{t('advances')}</span>
                <span className="text-mono normal-case text-wood-warm">{formatMoney(workerMov.totalAdvances)}</span>
              </p>
              <MiniTable
                head={[t('workers'), t('date'), t('amount')]}
                rows={workerMov.advances.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), formatMoney(p.amount)])}
                empty={t('noData')}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Transactions history */}
      <motion.div variants={fadeUp} className="card-wood mt-5 rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-wood-warm" />
            <h3 className="text-display text-lg font-bold text-wood-dark">{t('transactionsHistory')}</h3>
          </div>
          <div className="inline-flex rounded-xl border border-wood-light/40 bg-white/60 p-1">
            {([
              { k: 'all', l: t('allMovements') },
              { k: 'deposit', l: t('deposit') },
              { k: 'withdrawal', l: t('withdrawal') },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => setMoveFilter(o.k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  moveFilter === o.k ? 'bg-wood-btn text-white shadow-wood' : 'text-wood-medium hover:bg-wood-cream'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {periodTransactions.length === 0 ? (
          <EmptyState
            title={t('noTransactions')}
            hint={t('noTransactionsHint')}
            icon={<Landmark size={40} />}
            action={<Button variant="sage" onClick={() => openNew('deposit')}><Plus size={18} />{t('newDeposit')}</Button>}
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {periodTransactions.map((tx, i) => {
                const isDeposit = tx.type === 'deposit'
                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
                    exit={{ opacity: 0, x: 12 }}
                    className="group flex items-center gap-3 rounded-xl border border-wood-light/20 bg-wood-cream/30 px-3 py-2.5"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-wood ${isDeposit ? 'bg-gradient-to-br from-sage to-emerald-500' : 'bg-gradient-to-br from-terracotta to-rose-600'}`}>
                      {isDeposit ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={isDeposit ? 'sage' : 'unpaid'}>{isDeposit ? t('deposit') : t('withdrawal')}</Badge>
                        <span className="truncate text-sm font-medium text-wood-dark">{tx.description || '—'}</span>
                      </div>
                      <p className="text-[11px] text-wood-medium">{format(new Date(tx.date), 'EEEE dd MMMM yyyy', { locale: frLocale })}</p>
                    </div>
                    <span className={`text-mono text-base font-bold ${isDeposit ? 'text-sage' : 'text-terracotta'}`}>
                      {isDeposit ? '+' : '−'}{formatMoney(tx.amount)}
                    </span>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button size="sm" variant="outline" onClick={() => openEdit(tx)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleting(tx)}><Trash2 size={14} /></Button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? (form.type === 'deposit' ? t('editDeposit') : t('editWithdrawal')) : form.type === 'deposit' ? t('newDeposit') : t('newWithdrawal')}
        size="sm"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}
      >
        <div className="space-y-4">
          <Select label={t('type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CaisseType })}>
            <option value="deposit">{t('deposit')}</option>
            <option value="withdrawal">{t('withdrawal')}</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label={`${t('amount')} (DA)`} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <Textarea label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) { deleteTransaction(deleting.id); toast.success(t('deleted')) } }}
      />
    </motion.div>
  )
}
