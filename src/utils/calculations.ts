import type {
  Affectation,
  Department,
  Purchase,
  Worker,
  Expense,
  Product,
  CaisseTransaction,
} from '@/types'
import { round2, monthKey } from './helpers'
import { isDivisible, totalContent } from './retail'
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subMonths,
  format,
} from 'date-fns'

export const remaining = (total: number, paid: number): number => round2(Math.max(0, total - paid))

export interface PartyStats {
  totalAmount: number
  totalPaid: number
  totalDebt: number
  count: number
}

export const supplierStats = (supplierId: string, purchases: Purchase[]): PartyStats => {
  const list = purchases.filter((p) => p.supplierId === supplierId)
  const totalAmount = round2(list.reduce((s, x) => s + x.total, 0))
  const totalPaid = round2(list.reduce((s, x) => s + x.paid, 0))
  return { totalAmount, totalPaid, totalDebt: remaining(totalAmount, totalPaid), count: list.length }
}

export const inRange = (dateStr: string, start: Date, end: Date): boolean => {
  const d = new Date(dateStr)
  return isWithinInterval(d, { start, end })
}

export const sumPurchases = (purchases: Purchase[], start: Date, end: Date): number =>
  round2(purchases.filter((p) => inRange(p.date, start, end)).reduce((acc, p) => acc + p.total, 0))

export const sumExpenses = (expenses: Expense[], start: Date, end: Date): number =>
  round2(expenses.filter((e) => inRange(e.date, start, end)).reduce((acc, e) => acc + e.amount, 0))

export const sumSalaries = (workers: Worker[], start: Date, end: Date): number =>
  round2(
    workers.reduce(
      (acc, w) => acc + w.payments.filter((p) => inRange(p.date, start, end)).reduce((s, p) => s + p.amount, 0),
      0,
    ),
  )

/** Value (at purchase cost) of everything handed to departments in range. */
export const sumAffectations = (affectations: Affectation[], start: Date, end: Date): number =>
  round2(affectations.filter((a) => inRange(a.date, start, end)).reduce((acc, a) => acc + a.total, 0))

// ----------------------------------------------------------------------------
// Budget (allocations, withdrawals and every expense of the organisation)
// ----------------------------------------------------------------------------

/** Sum the money actually disbursed on purchases whose date falls in range. */
export const sumPurchasesPaid = (purchases: Purchase[], start: Date, end: Date): number =>
  round2(purchases.filter((p) => inRange(p.date, start, end)).reduce((acc, p) => acc + p.paid, 0))

export const sumCaisse = (
  transactions: CaisseTransaction[],
  type: 'deposit' | 'withdrawal',
  start: Date,
  end: Date,
): number =>
  round2(
    transactions
      .filter((t) => t.type === type && inRange(t.date, start, end))
      .reduce((acc, t) => acc + t.amount, 0),
  )

export interface BudgetPeriodStats {
  /** Total invoiced purchases (billed). */
  purchasesTotal: number
  /** Money disbursed for purchases. */
  purchasesPaid: number
  expenses: number
  salaries: number
  /** Budget allocations received. */
  deposits: number
  withdrawals: number
  /** Value of the stock handed to the departments. */
  affectedValue: number
  /** Money entering the budget: allocations. */
  cashIn: number
  /** Money leaving the budget: purchases paid + expenses + salaries + withdrawals. */
  cashOut: number
  /** cashIn − cashOut. */
  netFlow: number
}

/** Aggregate every budget movement over a date range. */
export const budgetPeriodStats = (
  transactions: CaisseTransaction[],
  purchases: Purchase[],
  expenses: Expense[],
  workers: Worker[],
  affectations: Affectation[],
  start: Date,
  end: Date,
): BudgetPeriodStats => {
  const purchasesTotal = sumPurchases(purchases, start, end)
  const purchasesPaid = sumPurchasesPaid(purchases, start, end)
  const expensesSum = sumExpenses(expenses, start, end)
  const salaries = sumSalaries(workers, start, end)
  const deposits = sumCaisse(transactions, 'deposit', start, end)
  const withdrawals = sumCaisse(transactions, 'withdrawal', start, end)
  const cashIn = deposits
  const cashOut = round2(purchasesPaid + expensesSum + salaries + withdrawals)
  return {
    purchasesTotal,
    purchasesPaid,
    expenses: expensesSum,
    salaries,
    deposits,
    withdrawals,
    affectedValue: sumAffectations(affectations, start, end),
    cashIn,
    cashOut,
    netFlow: round2(cashIn - cashOut),
  }
}

export interface OrgWealth {
  /** All-time budget still available. */
  budgetBalance: number
  /** Purchase-cost value of everything currently in stock. */
  stockValue: number
  /** Value of everything ever handed to departments. */
  affectedValue: number
  /** Money still owed to suppliers. */
  supplierPayables: number
  /** budget + stock − payables. */
  totalWealth: number
}

const VERY_EARLY = new Date(0)
const VERY_LATE = new Date(8640000000000000)

/** Purchase-cost value of the products on the shelves. */
export const stockValueOf = (products: Product[]): number =>
  round2(
    products.reduce((s, p) => {
      const base = p.quantity * p.purchasePrice
      const open =
        p.isDivisible && (p.capacity ?? 0) > 0
          ? ((p.openRemaining ?? 0) / (p.capacity ?? 1)) * p.purchasePrice
          : 0
      return s + base + open
    }, 0),
  )

/** Global financial snapshot of the organisation (date-independent). */
export const orgWealth = (
  transactions: CaisseTransaction[],
  purchases: Purchase[],
  expenses: Expense[],
  workers: Worker[],
  products: Product[],
  affectations: Affectation[],
): OrgWealth => {
  const all = budgetPeriodStats(transactions, purchases, expenses, workers, affectations, VERY_EARLY, VERY_LATE)
  const stockValue = stockValueOf(products)
  const supplierPayables = round2(purchases.reduce((s, x) => s + Math.max(0, x.total - x.paid), 0))
  return {
    budgetBalance: all.netFlow,
    stockValue,
    affectedValue: all.affectedValue,
    supplierPayables,
    totalWealth: round2(all.netFlow + stockValue - supplierPayables),
  }
}

/**
 * Is this article really on the shelf right now? A divisible product still
 * counts while its opened container holds something, even with 0 sealed units.
 */
export const isInStock = (p: Product): boolean =>
  isDivisible(p) ? totalContent(p) > 0 : p.quantity > 0

export interface DashboardStats {
  affectationsToday: number
  affectationsMonth: number
  affectedValueMonth: number
  /** How many DIFFERENT articles are actually available. */
  productsInStock: number
  stockAlertCount: number
  purchasesMonth: number
  expensesMonth: number
  salariesMonth: number
  spentMonth: number
}

export const dashboardStats = (
  purchases: Purchase[],
  expenses: Expense[],
  products: Product[],
  workers: Worker[],
  affectations: Affectation[],
): DashboardStats => {
  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monStart = startOfMonth(now)
  const monEnd = endOfMonth(now)

  const purchasesMonth = sumPurchases(purchases, monStart, monEnd)
  const expensesMonth = sumExpenses(expenses, monStart, monEnd)
  const salariesMonth = sumSalaries(workers, monStart, monEnd)

  return {
    affectationsToday: affectations.filter((a) => inRange(a.date, dayStart, dayEnd)).length,
    affectationsMonth: affectations.filter((a) => inRange(a.date, monStart, monEnd)).length,
    affectedValueMonth: sumAffectations(affectations, monStart, monEnd),
    productsInStock: products.filter(isInStock).length,
    stockAlertCount: products.filter((p) => p.quantity <= p.minQuantity).length,
    purchasesMonth,
    expensesMonth,
    salariesMonth,
    spentMonth: round2(purchasesMonth + expensesMonth + salariesMonth),
  }
}

export interface MonthPoint {
  month: string
  purchases: number
  affectations: number
  expenses: number
}

export const last12Months = (
  purchases: Purchase[],
  expenses: Expense[],
  affectations: Affectation[],
): MonthPoint[] => {
  const points: MonthPoint[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const ref = subMonths(now, i)
    const start = startOfMonth(ref)
    const end = endOfMonth(ref)
    points.push({
      month: format(ref, 'MMM yy'),
      purchases: sumPurchases(purchases, start, end),
      affectations: sumAffectations(affectations, start, end),
      expenses: sumExpenses(expenses, start, end),
    })
  }
  return points
}

// ----------------------------------------------------------------------------
// Per-product, per-department & per-category analytics (Budget + Reports)
// ----------------------------------------------------------------------------

const productIndex = (products: Product[]): Map<string, Product> =>
  new Map(products.map((p) => [p.id, p]))

export interface ProductPurchaseAgg {
  productId: string
  name: string
  category: string
  quantity: number
  total: number
}

/** Aggregate every purchase LINE whose purchase falls in range, grouped by product. */
export const periodPurchasedProducts = (
  purchases: Purchase[],
  products: Product[],
  start: Date,
  end: Date,
): ProductPurchaseAgg[] => {
  const idx = productIndex(products)
  const map = new Map<string, ProductPurchaseAgg>()
  purchases
    .filter((p) => inRange(p.date, start, end))
    .forEach((p) =>
      p.lines.forEach((l) => {
        const cur =
          map.get(l.productId) ??
          { productId: l.productId, name: l.productName, category: idx.get(l.productId)?.category ?? '—', quantity: 0, total: 0 }
        cur.quantity += l.quantity
        cur.total = round2(cur.total + l.quantity * l.purchasePrice)
        map.set(l.productId, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export interface ProductAffectedAgg {
  productId: string
  name: string
  category: string
  quantity: number
  value: number
  /** Number of affectations the product appears in. */
  count: number
  /** Distinct departments that received it. */
  departments: number
}

/** Every affectation LINE in range, grouped by product. */
export const periodAffectedProducts = (
  affectations: Affectation[],
  products: Product[],
  start: Date,
  end: Date,
): ProductAffectedAgg[] => {
  const idx = productIndex(products)
  const map = new Map<string, ProductAffectedAgg & { deps: Set<string> }>()
  affectations
    .filter((a) => inRange(a.date, start, end))
    .forEach((a) =>
      a.lines.forEach((l) => {
        const cur =
          map.get(l.productId) ??
          {
            productId: l.productId,
            name: l.productName,
            category: idx.get(l.productId)?.category ?? '—',
            quantity: 0,
            value: 0,
            count: 0,
            departments: 0,
            deps: new Set<string>(),
          }
        cur.quantity += l.quantity
        cur.value = round2(cur.value + l.quantity * l.unitCost)
        cur.count += 1
        cur.deps.add(a.departmentId)
        cur.departments = cur.deps.size
        map.set(l.productId, cur)
      }),
    )
  return [...map.values()]
    .map(({ deps: _deps, ...r }) => r)
    .sort((a, b) => b.quantity - a.quantity)
}

/**
 * Movement table over a period: EVERY product, including those never handed
 * out, sorted by quantity affected — fast movers on top, dormant stock below.
 */
export const productAffectationAnalysis = (
  affectations: Affectation[],
  products: Product[],
  start: Date,
  end: Date,
): ProductAffectedAgg[] => {
  const moved = new Map(periodAffectedProducts(affectations, products, start, end).map((r) => [r.productId, r]))
  return products
    .map(
      (p) =>
        moved.get(p.id) ?? {
          productId: p.id,
          name: p.name,
          category: p.category,
          quantity: 0,
          value: 0,
          count: 0,
          departments: 0,
        },
    )
    .sort((a, b) => b.quantity - a.quantity || b.value - a.value)
}

export interface DepartmentAgg {
  departmentId: string
  name: string
  count: number
  quantity: number
  value: number
  lastDate: string | null
}

/** What each department received over a period. */
export const departmentBreakdown = (
  affectations: Affectation[],
  departments: Department[],
  start: Date,
  end: Date,
): DepartmentAgg[] => {
  const map = new Map<string, DepartmentAgg>()
  departments.forEach((d) =>
    map.set(d.id, { departmentId: d.id, name: d.name, count: 0, quantity: 0, value: 0, lastDate: null }),
  )
  affectations
    .filter((a) => inRange(a.date, start, end))
    .forEach((a) => {
      const cur =
        map.get(a.departmentId) ??
        { departmentId: a.departmentId, name: a.departmentName, count: 0, quantity: 0, value: 0, lastDate: null }
      cur.count += 1
      cur.quantity += a.lines.reduce((s, l) => s + l.quantity, 0)
      cur.value = round2(cur.value + a.total)
      if (!cur.lastDate || a.date > cur.lastDate) cur.lastDate = a.date
      map.set(a.departmentId, cur)
    })
  return [...map.values()].sort((a, b) => b.value - a.value)
}

export interface CategoryAgg {
  category: string
  qtyPurchased: number
  purchasesCost: number
  qtyAffected: number
  affectedValue: number
  /** Units still on the shelves (all-time). */
  stockQty: number
  stockValue: number
}

/** Per-category purchases, affectations and current stock over a date range. */
export const categoryBreakdown = (
  purchases: Purchase[],
  affectations: Affectation[],
  products: Product[],
  start: Date,
  end: Date,
): CategoryAgg[] => {
  const map = new Map<string, CategoryAgg>()
  const get = (category: string): CategoryAgg => {
    const cur =
      map.get(category) ??
      { category, qtyPurchased: 0, purchasesCost: 0, qtyAffected: 0, affectedValue: 0, stockQty: 0, stockValue: 0 }
    map.set(category, cur)
    return cur
  }
  periodPurchasedProducts(purchases, products, start, end).forEach((r) => {
    const cur = get(r.category)
    cur.qtyPurchased += r.quantity
    cur.purchasesCost = round2(cur.purchasesCost + r.total)
  })
  periodAffectedProducts(affectations, products, start, end).forEach((r) => {
    const cur = get(r.category)
    cur.qtyAffected += r.quantity
    cur.affectedValue = round2(cur.affectedValue + r.value)
  })
  products.forEach((p) => {
    const cur = get(p.category || '—')
    cur.stockQty += p.quantity
    cur.stockValue = round2(cur.stockValue + p.quantity * p.purchasePrice)
  })
  return [...map.values()].sort((a, b) => b.affectedValue - a.affectedValue || b.purchasesCost - a.purchasesCost)
}

// ----------------------------------------------------------------------------
// Product history (purchases in, affectations out)
// ----------------------------------------------------------------------------

export interface ProductMovement {
  id: string
  kind: 'purchase' | 'affectation'
  date: string
  reference: string
  /** Supplier name or department name. */
  party: string
  quantity: number
  unitPrice: number
  total: number
  note?: string
}

export const productHistory = (
  productId: string,
  purchases: Purchase[],
  affectations: Affectation[],
): ProductMovement[] => {
  const rows: ProductMovement[] = []
  purchases.forEach((p) =>
    p.lines
      .filter((l) => l.productId === productId)
      .forEach((l, i) =>
        rows.push({
          id: `${p.id}-${i}`,
          kind: 'purchase',
          date: p.date,
          reference: p.reference,
          party: p.supplierName || '—',
          quantity: l.quantity,
          unitPrice: l.purchasePrice,
          total: round2(l.quantity * l.purchasePrice),
        }),
      ),
  )
  affectations.forEach((a) =>
    a.lines
      .filter((l) => l.productId === productId)
      .forEach((l, i) =>
        rows.push({
          id: `${a.id}-${i}`,
          kind: 'affectation',
          date: a.date,
          reference: a.reference,
          party: a.departmentName,
          quantity: l.quantity,
          unitPrice: l.unitCost,
          total: round2(l.quantity * l.unitCost),
          note: a.description,
        }),
      ),
  )
  return rows.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

// ----------------------------------------------------------------------------
// Worker cash movements (advances / payments / absences) over a period
// ----------------------------------------------------------------------------

export interface WorkerMovement {
  id: string
  workerId: string
  workerName: string
  role: string
  date: string
  description: string
  amount: number
}

export interface PeriodWorkerMovements {
  advances: WorkerMovement[]
  payments: WorkerMovement[]
  absences: WorkerMovement[]
  totalAdvances: number
  totalPayments: number
  totalAbsences: number
}

export const periodWorkerMovements = (
  workers: Worker[],
  start: Date,
  end: Date,
): PeriodWorkerMovements => {
  const advances: WorkerMovement[] = []
  const payments: WorkerMovement[] = []
  const absences: WorkerMovement[] = []
  workers.forEach((w) => {
    w.advances
      .filter((a) => inRange(a.date, start, end))
      .forEach((a) =>
        advances.push({ id: a.id, workerId: w.id, workerName: w.fullName, role: w.role, date: a.date, description: a.description, amount: a.amount }),
      )
    w.payments
      .filter((p) => inRange(p.date, start, end))
      .forEach((p) =>
        payments.push({ id: p.id, workerId: w.id, workerName: w.fullName, role: w.role, date: p.date, description: p.note ?? p.period, amount: p.amount }),
      )
    w.absences
      .filter((a) => inRange(a.date, start, end))
      .forEach((a) =>
        absences.push({ id: a.id, workerId: w.id, workerName: w.fullName, role: w.role, date: a.date, description: a.description, amount: a.cost }),
      )
  })
  const sortDesc = (a: WorkerMovement, b: WorkerMovement) => +new Date(b.date) - +new Date(a.date)
  advances.sort(sortDesc)
  payments.sort(sortDesc)
  absences.sort(sortDesc)
  return {
    advances,
    payments,
    absences,
    totalAdvances: round2(advances.reduce((s, x) => s + x.amount, 0)),
    totalPayments: round2(payments.reduce((s, x) => s + x.amount, 0)),
    totalAbsences: round2(absences.reduce((s, x) => s + x.amount, 0)),
  }
}

/** Compute a worker's payable salary for a given month key (YYYY-MM). */
export const computeSalary = (worker: Worker, period: string) => {
  const base =
    worker.salaryType === 'monthly' ? worker.salaryAmount : worker.salaryAmount * 26 // ~26 working days
  const absences = round2(
    worker.absences.filter((a) => monthKey(a.date) === period).reduce((s, a) => s + a.cost, 0),
  )
  const advances = round2(worker.advances.filter((a) => !a.deducted).reduce((s, a) => s + a.amount, 0))
  const toPay = round2(Math.max(0, base - absences - advances))
  return { base, absences, advances, toPay }
}
