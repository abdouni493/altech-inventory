// ============================================================================
// Altech Inventory — Core domain types
// ============================================================================

export type Lang = 'fr' | 'ar'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

// ----------------------------------------------------------------------------
// Auth / Users
// ----------------------------------------------------------------------------

export interface AppUser {
  id: string
  fullName: string
  username: string
  email: string
  password: string
  role: string
  permissions: Permissions | 'ALL'
  isDemo?: boolean
}

/**
 * A login stored in the local database. Passwords are never stored, only a
 * salted hash. Employee logins point at their worker record, which carries
 * the permissions.
 */
export interface LocalUser {
  id: string
  role: 'admin' | 'worker'
  workerId?: string
  fullName: string
  username: string
  email: string
  passwordHash: string
  salt: string
  createdAt: string
}

/** A permission set: which modules are enabled and which actions inside them. */
export type ModuleKey =
  | 'dashboard'
  | 'stock'
  | 'purchase'
  | 'departments'
  | 'affectations'
  | 'suppliers'
  | 'workers'
  | 'expenses'
  | 'budget'
  | 'reports'
  | 'settings'

export type ActionKey = 'view' | 'create' | 'edit' | 'delete' | 'print' | 'pay'

export type Permissions = {
  [key in ModuleKey]?: {
    enabled: boolean
    actions: ActionKey[]
  }
}

// ----------------------------------------------------------------------------
// Products / Stock
// ----------------------------------------------------------------------------

export interface Product {
  id: string
  name: string
  description: string
  barcode: string
  brand: string
  category: string
  purchasePrice: number
  quantity: number // current quantity in stock (sealed / whole units)
  minQuantity: number // alert threshold
  /** Unit a whole article is counted in — boîte, paquet, flacon… (optional). */
  stockUnit?: string
  hasExpiration?: boolean // whether this product tracks an expiration date
  expirationDate?: string // ISO / YYYY-MM-DD date when the product expires
  // -- Retail ("vente au détail") ---------------------------------------------
  // A perfume bottle holds 100 ml and is also sold by 10 ml portions: the unit
  // is the container, `capacity` its content, `openRemaining` what is left in
  // the container currently opened at the counter.
  /** Whether this product can be sold by fractions of one unit. */
  isDivisible?: boolean
  /** Measure unit of the content — ml, g, L… */
  unit?: string
  /** Content of ONE whole unit, e.g. 100 (ml). */
  capacity?: number
  /** Reference portion sold at the counter, e.g. 10 (ml). */
  retailStep?: number
  /** Content still available inside the currently opened unit. */
  openRemaining?: number
  /** Optional barcode printed on ONE piece — scanning it sells one portion. */
  retailBarcode?: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Purchases
// ----------------------------------------------------------------------------

export interface PurchaseLine {
  productId: string
  productName: string
  barcode: string
  quantity: number
  purchasePrice: number
  minQuantity: number
  hasExpiration?: boolean
  expirationDate?: string
  /** Retail settings pushed onto the product when the purchase is saved. */
  isDivisible?: boolean
  unit?: string
  capacity?: number
  retailStep?: number
}

export interface Payment {
  id: string
  amount: number
  date: string
  note?: string
}

export interface Purchase {
  id: string
  reference: string
  supplierId: string | null
  supplierName: string
  lines: PurchaseLine[]
  total: number
  paid: number
  payments: Payment[]
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Suppliers
// ----------------------------------------------------------------------------

export interface Supplier {
  id: string
  name: string
  phone: string
  address: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Workers
// ----------------------------------------------------------------------------

export type SalaryType = 'monthly' | 'daily'

export interface WorkerAdvance {
  id: string
  date: string
  description: string
  amount: number
  deducted: boolean
}

export interface WorkerAbsence {
  id: string
  date: string
  description: string
  cost: number
}

export interface WorkerPayment {
  id: string
  period: string // e.g. "2026-06"
  baseSalary: number
  absencesDeducted: number
  advancesDeducted: number
  amount: number
  date: string
  note?: string
}

export interface Worker {
  id: string
  fullName: string
  birthDate: string
  idCard: string
  phone: string
  role: string
  hasSalary: boolean
  salaryType: SalaryType
  salaryAmount: number
  hasAccount: boolean
  email: string
  username: string
  password: string
  permissions: Permissions
  startDate: string
  active: boolean
  advances: WorkerAdvance[]
  absences: WorkerAbsence[]
  payments: WorkerPayment[]
  createdAt: string
}

// ----------------------------------------------------------------------------
// Expenses
// ----------------------------------------------------------------------------

export interface Expense {
  id: string
  name: string
  description: string
  amount: number
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Budget (allocations / withdrawals)
// ----------------------------------------------------------------------------

export type CaisseType = 'deposit' | 'withdrawal'

/** A manual budget movement: an allocation received (deposit) or a withdrawal. */
export interface CaisseTransaction {
  id: string
  type: CaisseType
  amount: number
  description: string
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Departments & affectations (assignment of stock to a department)
// ----------------------------------------------------------------------------

export interface Department {
  id: string
  name: string
  description: string
  /** Optional details. */
  code?: string
  manager?: string
  phone?: string
  email?: string
  location?: string
  createdAt: string
}

export interface AffectationLine {
  productId: string
  productName: string
  barcode: string
  quantity: number
  /** Purchase cost of one unit at the time of the affectation. */
  unitCost: number
}

export type AffectationEventType = 'created' | 'updated'

/** One entry of the audit trail of an affectation. */
export interface AffectationEvent {
  id: string
  type: AffectationEventType
  date: string
  by: string
  note: string
}

export interface Affectation {
  id: string
  reference: string
  departmentId: string
  departmentName: string
  lines: AffectationLine[]
  description: string
  /** Person of the department who received the items. */
  receivedBy?: string
  total: number
  date: string
  history: AffectationEvent[]
  createdBy?: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

export interface StoreSettings {
  logo: string // base64 or empty
  name: string
  description: string
  email: string
  phone: string
  address: string
  nif: string
  nis: string
  article: string
  rc: string
  currency: string
}
