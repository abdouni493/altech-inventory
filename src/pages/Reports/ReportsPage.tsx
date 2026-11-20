import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactToPrint } from 'react-to-print'
import { format, startOfYear } from 'date-fns'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  BarChart3,
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  HardHat,
  Boxes,
  Tags,
  Landmark,
  ClipboardList,
  Building2,
  Coins,
  Package,
  Truck,
  CalendarX,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useProductStore } from '@/store/useProductStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCaisseStore } from '@/store/useCaisseStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, round2, expiryInfo } from '@/utils/helpers'
import {
  sumPurchases,
  sumExpenses,
  sumSalaries,
  supplierStats,
  remaining,
  budgetPeriodStats,
  orgWealth,
  categoryBreakdown,
  periodAffectedProducts,
  periodPurchasedProducts,
  productAffectationAnalysis,
  departmentBreakdown,
  periodWorkerMovements,
  stockValueOf,
} from '@/utils/calculations'

const CAT_COLORS = ['#2F5BFF', '#00B8D9', '#6366F1', '#0EA5E9', '#F5A524', '#12B76A', '#14B8A6', '#F97316', '#64748B']

const SummaryCard = ({ label, value, color, icon, money = true }: { label: string; value: number; color: string; icon: React.ReactNode; money?: boolean }) => (
  <div className="card-wood rounded-xl p-4">
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${color}`}>{icon}</div>
    <p className="mt-3 text-xs text-wood-medium">{label}</p>
    <p className="text-mono text-xl font-bold text-wood-dark">{money ? formatMoney(value) : value.toLocaleString('fr-FR')}</p>
  </div>
)

const Section = ({ title, icon, children, extra }: { title: string; icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) => (
  <section className="card-wood break-inside-avoid rounded-xl p-5">
    <h2 className="mb-4 flex flex-wrap items-center gap-2 text-display text-lg font-bold text-wood-dark">
      {icon}
      {title}
      {extra && <span className="ms-auto text-sm font-normal">{extra}</span>}
    </h2>
    {children}
  </section>
)

export const ReportsPage = () => {
  const { t } = useTranslation()
  const purchases = usePurchaseStore((s) => s.purchases)
  const expenses = useExpenseStore((s) => s.expenses)
  const workers = useWorkerStore((s) => s.workers)
  const products = useProductStore((s) => s.products)
  const suppliers = useSupplierStore((s) => s.suppliers)
  const settings = useSettingsStore((s) => s.settings)
  const transactions = useCaisseStore((s) => s.transactions)
  const affectations = useAffectationStore((s) => s.affectations)
  const departments = useDepartmentStore((s) => s.departments)

  const [from, setFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReturnType<typeof buildReport> | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ content: () => printRef.current })

  function buildReport() {
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T23:59:59`)
    const inRange = (d: string) => new Date(d) >= start && new Date(d) <= end

    const periodPurchases = purchases.filter((p) => inRange(p.date)).sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const periodExpenses = expenses.filter((e) => inRange(e.date)).sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const periodAffectations = affectations.filter((a) => inRange(a.date)).sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const periodBudget = transactions.filter((x) => inRange(x.date)).sort((a, b) => +new Date(b.date) - +new Date(a.date))

    const totalPurchases = sumPurchases(purchases, start, end)
    const totalExpenses = sumExpenses(expenses, start, end)
    const totalSalaries = sumSalaries(workers, start, end)
    const budget = budgetPeriodStats(transactions, purchases, expenses, workers, affectations, start, end)
    const wealth = orgWealth(transactions, purchases, expenses, workers, products, affectations)

    const affected = periodAffectedProducts(affectations, products, start, end)
    const movement = productAffectationAnalysis(affectations, products, start, end)
    const mostAffected = movement.filter((r) => r.quantity > 0).slice(0, 10)
    const dormant = [...movement].filter((r) => (products.find((p) => p.id === r.productId)?.quantity ?? 0) > 0).sort((a, b) => a.quantity - b.quantity).slice(0, 10)
    const purchased = periodPurchasedProducts(purchases, products, start, end)
    const deps = departmentBreakdown(affectations, departments, start, end)
    const cats = categoryBreakdown(purchases, affectations, products, start, end)
    const workerMov = periodWorkerMovements(workers, start, end)

    const unitsAffected = affected.reduce((s, r) => s + r.quantity, 0)
    const unitsPurchased = purchased.reduce((s, r) => s + r.quantity, 0)
    const totalSpent = round2(budget.purchasesPaid + totalExpenses + totalSalaries + budget.withdrawals)

    const stockRows = [...products]
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((p) => {
        const exp = p.hasExpiration && p.expirationDate ? expiryInfo(p.expirationDate) : null
        return {
          ...p,
          value: round2(p.quantity * p.purchasePrice),
          status: p.quantity <= 0 ? t('outOfStock') : p.quantity <= p.minQuantity ? t('lowStock') : t('inStock'),
          expiry: exp ? `${format(new Date(p.expirationDate!), 'dd/MM/yyyy')}${exp.status === 'expired' ? ' ⚠' : ''}` : '—',
        }
      })

    return {
      start,
      end,
      totalPurchases,
      totalExpenses,
      totalSalaries,
      totalSpent,
      budget,
      wealth,
      periodPurchases,
      periodExpenses,
      periodAffectations,
      periodBudget,
      affected,
      mostAffected,
      dormant,
      purchased,
      deps,
      cats,
      workerMov,
      unitsAffected,
      unitsPurchased,
      stockRows,
      stockValue: stockValueOf(products),
      supplierDebts: suppliers.map((s) => ({ ...s, ...supplierStats(s.id, purchases) })).filter((s) => s.totalDebt > 0),
      lowStock: products.filter((p) => p.quantity <= p.minQuantity),
      expired: products.filter((p) => p.hasExpiration && p.expirationDate && expiryInfo(p.expirationDate)?.status !== 'ok'),
    }
  }

  const generate = () => {
    setLoading(true)
    setReport(null)
    setTimeout(() => {
      setReport(buildReport())
      setLoading(false)
    }, 500)
  }

  return (
    <div>
      <PageHeader
        title={t('reports')}
        actions={report && <Button variant="gold" onClick={handlePrint}><Printer size={16} />{t('printReport')}</Button>}
      />

      <div className="card-wood mb-5 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div>
          <label className="label-wood">{t('from')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-wood" />
        </div>
        <div>
          <label className="label-wood">{t('to')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-wood" />
        </div>
        <Button onClick={generate}><BarChart3 size={16} />{t('generateReport')}</Button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="animate-spin text-wood-warm" size={40} />
            <p className="text-sm text-wood-medium">{t('loading')}</p>
          </motion.div>
        ) : report ? (
          <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} ref={printRef} className="print-area space-y-6">
            {/* Print header */}
            <div className="hidden print:block">
              <h1 className="text-display text-2xl font-bold text-wood-dark">{settings.name || t('appName')}</h1>
              <p className="text-sm text-wood-medium">{t('reports')} — {format(report.start, 'dd/MM/yyyy')} → {format(report.end, 'dd/MM/yyyy')}</p>
            </div>

            {/* Summary */}
            <section>
              <h2 className="mb-3 text-display text-xl font-bold text-wood-dark">{t('financialSummary')}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryCard label={t('affectations')} value={report.periodAffectations.length} money={false} color="bg-wood-btn" icon={<ClipboardList size={18} />} />
                <SummaryCard label={t('affectedValue')} value={report.budget.affectedValue} color="bg-sage" icon={<Coins size={18} />} />
                <SummaryCard label={t('totalPurchasesReport')} value={report.totalPurchases} color="bg-wood-warm" icon={<ShoppingCart size={18} />} />
                <SummaryCard label={t('totalExpenses')} value={report.totalExpenses} color="bg-terracotta" icon={<Wallet size={18} />} />
                <SummaryCard label={t('totalSalaries')} value={report.totalSalaries} color="bg-gold" icon={<HardHat size={18} />} />
                <div className="card-wood rounded-xl bg-wood-btn p-4 text-white">
                  <p className="text-xs opacity-90">{t('caisseBalance')}</p>
                  <p className="text-mono mt-2 text-xl font-bold">{formatMoney(report.wealth.budgetBalance)}</p>
                  <p className="mt-1 text-[11px] opacity-80">{t('inventoryValue')}: {formatMoney(report.stockValue)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  { l: t('units') + ' — ' + t('affectations').toLowerCase(), v: `${report.unitsAffected}` },
                  { l: t('qtyPurchased'), v: `${report.unitsPurchased}` },
                  { l: t('departments'), v: `${report.deps.filter((d) => d.count > 0).length} / ${departments.length}` },
                  { l: t('products'), v: `${products.length}` },
                  { l: t('stockAlerts'), v: `${report.lowStock.length}` },
                  { l: t('supplierPayables'), v: formatMoney(report.wealth.supplierPayables) },
                ].map((x) => (
                  <div key={x.l} className="card-wood rounded-xl p-3"><p className="truncate text-[11px] text-wood-medium">{x.l}</p><p className="text-mono text-lg font-bold text-wood-dark">{x.v}</p></div>
                ))}
              </div>
            </section>

            {/* Budget */}
            <Section title={`${t('budget')} — ${t('financialSummary')}`} icon={<Landmark size={18} className="text-wood-warm" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  { l: t('allocationsTotal'), v: report.budget.deposits, c: 'text-sage' },
                  { l: t('withdrawalsTotal'), v: report.budget.withdrawals, c: 'text-terracotta' },
                  { l: `${t('paid')} ${t('purchase')}`, v: report.budget.purchasesPaid, c: 'text-wood-dark' },
                  { l: t('expenses'), v: report.budget.expenses, c: 'text-wood-dark' },
                  { l: t('salariesPaid'), v: report.budget.salaries, c: 'text-wood-dark' },
                  { l: t('cashIn'), v: report.budget.cashIn, c: 'text-sage' },
                  { l: t('cashOut'), v: report.budget.cashOut, c: 'text-terracotta' },
                  { l: t('netFlow'), v: report.budget.netFlow, c: report.budget.netFlow >= 0 ? 'text-sage' : 'text-terracotta' },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl bg-wood-cream/40 p-3">
                    <p className="truncate text-[11px] text-wood-medium">{x.l}</p>
                    <p className={`text-mono text-sm font-bold ${x.c}`}>{formatMoney(x.v)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <ReportTable
                  head={[t('date'), t('type'), t('description'), t('amount')]}
                  rows={report.periodBudget.map((x) => [
                    format(new Date(x.date), 'dd/MM/yyyy'),
                    x.type === 'deposit' ? t('deposit') : t('withdrawal'),
                    x.description || '—',
                    `${x.type === 'deposit' ? '+' : '−'} ${formatMoney(x.amount)}`,
                  ])}
                />
              </div>
            </Section>

            {/* Departments */}
            <Section title={t('departmentAnalysis')} icon={<Building2 size={18} className="text-wood-warm" />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {report.deps.some((d) => d.value > 0) && (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={report.deps.filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                        {report.deps.map((_, i) => (
                          <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <ReportTable
                  head={[t('department'), t('affectations'), t('units'), t('value'), t('lastAffectation')]}
                  rows={report.deps.map((d) => [d.name, `${d.count}`, `${d.quantity}`, formatMoney(d.value), d.lastDate ? format(new Date(d.lastDate), 'dd/MM/yyyy') : '—'])}
                />
              </div>
            </Section>

            {/* Movement analysis — most affected / dormant */}
            <Section title={t('movementAnalysis')} icon={<BarChart3 size={18} className="text-wood-warm" />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-sage"><TrendingUp size={16} />{t('mostAffected')}</h3>
                  {report.mostAffected.length > 0 && (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={report.mostAffected} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#56627A' }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: '#56627A' }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
                        <Bar dataKey="quantity" name={t('affectedQty')} fill="#2F5BFF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <ReportTable
                    head={[t('productName'), t('affectedQty'), t('departments'), t('value')]}
                    rows={report.mostAffected.map((p) => [p.name, `${p.quantity}`, `${p.departments}`, formatMoney(p.value)])}
                  />
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-terracotta"><TrendingDown size={16} />{t('dormantStock')}</h3>
                  <ReportTable
                    head={[t('productName'), t('category'), t('affectedQty'), t('inStock')]}
                    rows={report.dormant.map((p) => [p.name, p.category, `${p.quantity}`, `${products.find((x) => x.id === p.productId)?.quantity ?? 0}`])}
                  />
                  <p className="mt-2 text-xs text-wood-medium/70">{t('dormantStockHint')}</p>
                </div>
              </div>
            </Section>

            {/* Category analysis */}
            <Section title={t('categoryAnalysis')} icon={<Tags size={18} className="text-wood-warm" />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {report.cats.some((c) => c.stockValue > 0) && (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report.cats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" />
                      <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#56627A' }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10, fill: '#56627A' }} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #2F5BFF40' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="purchasesCost" name={t('purchase')} fill="#00B8D9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="affectedValue" name={t('affectations')} fill="#2F5BFF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="stockValue" name={t('stockValue')} fill="#12B76A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <ReportTable
                  head={[t('category'), t('qtyPurchased'), t('purchase'), t('affectedQty'), t('affectedValue'), t('stockValue')]}
                  rows={report.cats.map((c) => [c.category, `${c.qtyPurchased}`, formatMoney(c.purchasesCost), `${c.qtyAffected}`, formatMoney(c.affectedValue), formatMoney(c.stockValue)])}
                />
              </div>
            </Section>

            {/* Affectations detail */}
            <Section
              title={t('affectationsDetailed')}
              icon={<ClipboardList size={18} className="text-sage" />}
              extra={<Badge tone="info">{report.periodAffectations.length} · {formatMoney(report.budget.affectedValue)}</Badge>}
            >
              <ReportTable
                head={[t('reference'), t('date'), t('department'), t('items'), t('units'), t('value')]}
                rows={report.periodAffectations.map((a) => [
                  a.reference,
                  format(new Date(a.date), 'dd/MM/yyyy'),
                  a.departmentName,
                  a.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', '),
                  `${a.lines.reduce((s, l) => s + l.quantity, 0)}`,
                  formatMoney(a.total),
                ])}
              />
              <h3 className="mb-2 mt-5 text-sm font-bold text-wood-dark">{t('affectationsOut')} — {t('products').toLowerCase()}</h3>
              <ReportTable
                head={[t('productName'), t('category'), t('affectations'), t('affectedQty'), t('value')]}
                rows={report.affected.map((r) => [r.name, r.category, `${r.count}`, `${r.quantity}`, formatMoney(r.value)])}
              />
            </Section>

            {/* Purchases detail */}
            <Section title={t('purchasesDetailed')} icon={<ShoppingCart size={18} className="text-wood-medium" />}>
              <ReportTable
                head={[t('reference'), t('supplier'), t('date'), t('total'), t('paid'), t('remaining')]}
                rows={report.periodPurchases.map((p) => [p.reference, p.supplierName, format(new Date(p.date), 'dd/MM/yyyy'), formatMoney(p.total), formatMoney(p.paid), formatMoney(remaining(p.total, p.paid))])}
              />
              <h3 className="mb-2 mt-5 text-sm font-bold text-wood-dark">{t('productsPurchased')}</h3>
              <ReportTable
                head={[t('productName'), t('category'), t('qtyPurchased'), t('total')]}
                rows={report.purchased.map((r) => [r.name, r.category, `${r.quantity}`, formatMoney(r.total)])}
              />
            </Section>

            {/* Suppliers debts + expenses */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Section title={t('supplierDebts')} icon={<Truck size={18} className="text-wood-warm" />}>
                <ReportTable head={[t('supplier'), t('total'), t('paid'), t('totalDebt')]} rows={report.supplierDebts.map((s) => [s.name, formatMoney(s.totalAmount), formatMoney(s.totalPaid), formatMoney(s.totalDebt)])} />
              </Section>
              <Section title={t('expenses')} icon={<Wallet size={18} className="text-terracotta" />} extra={<b className="text-mono text-terracotta">{formatMoney(report.totalExpenses)}</b>}>
                <ReportTable head={[t('name'), t('date'), t('description'), t('amount')]} rows={report.periodExpenses.map((e) => [e.name, format(new Date(e.date), 'dd/MM/yyyy'), e.description || '—', formatMoney(e.amount)])} />
              </Section>
            </div>

            {/* Workers */}
            <Section title={t('workersMovements')} icon={<HardHat size={18} className="text-gold" />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-bold text-wood-dark">{t('salariesPaid')} — {formatMoney(report.workerMov.totalPayments)}</h3>
                  <ReportTable head={[t('workers'), t('date'), t('description'), t('amount')]} rows={report.workerMov.payments.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), p.description, formatMoney(p.amount)])} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-bold text-wood-dark">{t('advances')} — {formatMoney(report.workerMov.totalAdvances)}</h3>
                  <ReportTable head={[t('workers'), t('date'), t('description'), t('amount')]} rows={report.workerMov.advances.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), p.description, formatMoney(p.amount)])} />
                  <h3 className="mb-2 mt-4 text-sm font-bold text-wood-dark">{t('absences')} — {formatMoney(report.workerMov.totalAbsences)}</h3>
                  <ReportTable head={[t('workers'), t('date'), t('description'), t('amount')]} rows={report.workerMov.absences.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), p.description, formatMoney(p.amount)])} />
                </div>
              </div>
            </Section>

            {/* Stock situation */}
            <Section
              title={t('stockSituation')}
              icon={<Boxes size={18} className="text-wood-warm" />}
              extra={<Badge tone="gold">{t('inventoryValue')}: {formatMoney(report.stockValue)}</Badge>}
            >
              <ReportTable
                head={[t('productName'), t('category'), t('quantity'), t('minQuantity'), t('purchasePrice'), t('value'), t('status'), t('expirationDate')]}
                rows={report.stockRows.map((p) => [p.name, p.category, `${p.quantity}`, `${p.minQuantity}`, formatMoney(p.purchasePrice), formatMoney(p.value), p.status, p.expiry])}
              />
            </Section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Section title={t('stockAlerts')} icon={<Package size={18} className="text-terracotta" />}>
                {report.lowStock.length === 0 ? (
                  <div className="py-4 text-center"><Badge tone="paid">{t('inStock')}</Badge></div>
                ) : (
                  <ReportTable head={[t('productName'), t('quantity'), t('minQuantity')]} rows={report.lowStock.map((p) => [p.name, `${p.quantity}`, `${p.minQuantity}`])} />
                )}
              </Section>
              <Section title={t('expiredProducts')} icon={<CalendarX size={18} className="text-terracotta" />}>
                <ReportTable head={[t('productName'), t('quantity'), t('expirationDate')]} rows={report.expired.map((p) => [p.name, `${p.quantity}`, format(new Date(p.expirationDate!), 'dd/MM/yyyy')])} />
              </Section>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-wood flex flex-col items-center gap-3 rounded-xl py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-wood-cream text-wood-light"><BarChart3 size={40} /></div>
            <p className="text-sm text-wood-medium">{t('selectPeriod')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const ReportTable = ({ head, rows }: { head: string[]; rows: string[][] }) => {
  const { t } = useTranslation()
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-wood-medium">{t('noData')}</p>
  const numeric = (s: string) => /^[+−-]?\s?[\d\s.,]+(\s?DA)?$/.test(s.trim())
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-wood-light/40 text-xs uppercase text-wood-medium">
            {head.map((h, i) => (
              <th key={i} className={`whitespace-nowrap px-2 py-2 ${i === 0 ? 'text-start' : rows[0] && numeric(rows[0][i] ?? '') ? 'text-end' : 'text-start'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-wood-cream">
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-2 ${j === 0 ? 'font-medium text-wood-dark' : numeric(cell) ? 'text-mono whitespace-nowrap text-end' : 'text-wood-medium'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
