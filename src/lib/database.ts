import { create } from 'zustand'
import { useProductStore } from '@/store/useProductStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCaisseStore } from '@/store/useCaisseStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import type {
  Affectation,
  CaisseTransaction,
  Department,
  Expense,
  LocalUser,
  Product,
  Purchase,
  StoreSettings,
  Supplier,
  Worker,
} from '@/types'

// ============================================================================
// Local database
//
// The inventory is stored on this PC by the Altech server (`data/` folder, see
// server/db.mjs). When the page is opened without that server (a plain static
// host), the same data is kept in the browser's IndexedDB instead.
//
// Stores stay plain Zustand stores: this module loads them at boot, then
// watches them and writes only the rows that changed. A row "changed" when its
// object identity changed — every store action already replaces the objects it
// touches, so the diff is exact and cheap.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Snapshot {
  products: Product[]
  brands: string[]
  categories: string[]
  units: string[]
  suppliers: Supplier[]
  purchases: Purchase[]
  departments: Department[]
  affectations: Affectation[]
  workers: Worker[]
  workerRoles: string[]
  expenses: Expense[]
  caisse: CaisseTransaction[]
  settings: StoreSettings
  users: LocalUser[]
}

export const emptySettings = (): StoreSettings => ({
  logo: '',
  name: '',
  description: '',
  email: '',
  phone: '',
  address: '',
  nif: '',
  nis: '',
  article: '',
  rc: '',
  currency: 'DA',
})

// ----------------------------------------------------------------------------
// Store ⇄ database bindings
// ----------------------------------------------------------------------------

interface AnyStore {
  getState: () => any
  setState: (partial: any) => void
  subscribe: (listener: (state: any, prev: any) => void) => () => void
}

interface Binding {
  /** Key in the snapshot and name in the database. */
  name: keyof Snapshot
  store: AnyStore
  /** Field of the store state holding the data. */
  field: string
  /** `rows` = a collection of `{ id }` records, `value` = one document. */
  kind: 'rows' | 'value'
}

const rows = (name: keyof Snapshot, store: AnyStore, field: string): Binding => ({ name, store, field, kind: 'rows' })
const value = (name: keyof Snapshot, store: AnyStore, field: string): Binding => ({ name, store, field, kind: 'value' })

// Built on first use: the stores import this module back (circular imports).
let bindingsCache: Binding[] | null = null
const bindings = (): Binding[] => (bindingsCache ??= [
  rows('products', useProductStore, 'products'),
  value('brands', useProductStore, 'brands'),
  value('categories', useProductStore, 'categories'),
  value('units', useProductStore, 'units'),
  rows('suppliers', useSupplierStore, 'suppliers'),
  rows('purchases', usePurchaseStore, 'purchases'),
  rows('departments', useDepartmentStore, 'departments'),
  rows('affectations', useAffectationStore, 'affectations'),
  rows('workers', useWorkerStore, 'workers'),
  value('workerRoles', useWorkerStore, 'roles'),
  rows('expenses', useExpenseStore, 'expenses'),
  rows('caisse', useCaisseStore, 'transactions'),
  value('settings', useSettingsStore, 'settings'),
  rows('users', useAuthStore, 'users'),
])

/** Newest first, like the lists of every screen. */
const byDateDesc = (a: any, b: any) => String(b.date ?? '').localeCompare(String(a.date ?? ''))
const byCreatedDesc = (a: any, b: any) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
const SORTERS: Partial<Record<keyof Snapshot, (a: any, b: any) => number>> = {
  purchases: byDateDesc,
  affectations: byDateDesc,
  expenses: byDateDesc,
  caisse: byDateDesc,
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Turns a database document into a complete, sorted snapshot. */
const toSnapshot = (doc: { tables?: Record<string, unknown>; values?: Record<string, unknown> }): Snapshot => {
  const out: Record<string, unknown> = {}
  for (const b of bindings()) {
    if (b.kind === 'rows') {
      const list = asArray<any>(doc.tables?.[b.name]).filter((r) => r && typeof r.id === 'string')
      out[b.name] = [...list].sort(SORTERS[b.name] ?? byCreatedDesc)
    } else if (b.name === 'settings') {
      out.settings = { ...emptySettings(), ...((doc.values?.settings as object) ?? {}) }
    } else {
      out[b.name] = asArray<string>(doc.values?.[b.name])
    }
  }
  return out as unknown as Snapshot
}

/** Everything currently on screen. */
export const readSnapshot = (): Snapshot => {
  const out: Record<string, unknown> = {}
  for (const b of bindings()) out[b.name] = b.store.getState()[b.field]
  return out as unknown as Snapshot
}

let applying = false

/** Puts a snapshot in the stores without writing it back. */
const applySnapshot = (snapshot: Snapshot) => {
  applying = true
  try {
    const perStore = new Map<AnyStore, Record<string, unknown>>()
    for (const b of bindings()) {
      const patch = perStore.get(b.store) ?? {}
      patch[b.field] = snapshot[b.name]
      perStore.set(b.store, patch)
    }
    perStore.forEach((patch, store) => store.setState(patch))
  } finally {
    applying = false
  }
}

const snapshotToDoc = (snapshot: Snapshot) => {
  const tables: Record<string, unknown[]> = {}
  const values: Record<string, unknown> = {}
  for (const b of bindings()) {
    if (b.kind === 'rows') tables[b.name] = snapshot[b.name] as unknown[]
    else values[b.name] = snapshot[b.name]
  }
  return { tables, values }
}

// ----------------------------------------------------------------------------
// Backends
// ----------------------------------------------------------------------------

export type Op =
  | { type: 'upsert'; table: string; rows: unknown[] }
  | { type: 'delete'; table: string; ids: string[] }
  | { type: 'set'; key: string; value: unknown }

interface DbDoc {
  rev: number
  tables: Record<string, unknown[]>
  values: Record<string, unknown>
}

interface Backend {
  kind: 'server' | 'browser'
  load: () => Promise<DbDoc>
  write: (ops: Op[]) => Promise<{ rev: number; prevRev: number }>
  replace: (doc: { tables: Record<string, unknown[]>; values: Record<string, unknown> }) => Promise<{ rev: number }>
  rev: () => Promise<number>
}

const json = async (res: Response) => {
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
  return res.json()
}

const serverBackend: Backend = {
  kind: 'server',
  load: () => fetch('/api/db', { cache: 'no-store' }).then(json),
  write: (ops) =>
    fetch('/api/db/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    }).then(json),
  replace: (doc) =>
    fetch('/api/db/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    }).then(json),
  rev: () => fetch('/api/db/rev', { cache: 'no-store' }).then(json).then((r) => Number(r.rev) || 0),
}

/** IndexedDB fallback — the whole database under one key. */
const browserBackend = (): Backend => {
  const DB_NAME = 'altech-inventory'
  const KEY = 'db'
  let doc: { rev: number; tables: Record<string, Record<string, unknown>>; values: Record<string, unknown> } = {
    rev: 0,
    tables: {},
    values: {},
  }

  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore('kv')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

  const persist = async () => {
    const idb = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(doc, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    idb.close()
  }

  const exportDoc = (): DbDoc => ({
    rev: doc.rev,
    tables: Object.fromEntries(Object.entries(doc.tables).map(([k, t]) => [k, Object.values(t)])),
    values: doc.values,
  })

  return {
    kind: 'browser',
    load: async () => {
      const idb = await open()
      const stored = await new Promise<any>((resolve, reject) => {
        const req = idb.transaction('kv', 'readonly').objectStore('kv').get(KEY)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      idb.close()
      if (stored) doc = stored
      return exportDoc()
    },
    write: async (ops) => {
      const prevRev = doc.rev
      for (const op of ops) {
        if (op.type === 'set') doc.values[op.key] = op.value
        else {
          const table = (doc.tables[op.table] ??= {})
          if (op.type === 'upsert') op.rows.forEach((r: any) => (table[r.id] = r))
          else op.ids.forEach((id) => delete table[id])
        }
      }
      doc.rev += 1
      await persist()
      return { rev: doc.rev, prevRev }
    },
    replace: async (next) => {
      doc = {
        rev: doc.rev + 1,
        tables: Object.fromEntries(
          Object.entries(next.tables).map(([k, list]) => [k, Object.fromEntries((list as any[]).map((r) => [r.id, r]))]),
        ),
        values: next.values,
      }
      await persist()
      return { rev: doc.rev }
    },
    rev: async () => doc.rev,
  }
}

// ----------------------------------------------------------------------------
// Status (header indicator, settings page)
// ----------------------------------------------------------------------------

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface DbStatusState {
  backend: 'server' | 'browser' | null
  status: SaveStatus
  lastSavedAt: number | null
  error: string
  dataDir: string
  lanUrls: string[]
}

export const useDbStatus = create<DbStatusState>()(() => ({
  backend: null,
  status: 'idle',
  lastSavedAt: null,
  error: '',
  dataDir: '',
  lanUrls: [],
}))

// ----------------------------------------------------------------------------
// Write queue
// ----------------------------------------------------------------------------

let backend: Backend | null = null
let knownRev = 0
let queue: Op[] = []
let flushing = false
let flushTimer: number | undefined
let started = false

const scheduleFlush = (delay = 120) => {
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => void flush(), delay)
}

const flush = async (): Promise<boolean> => {
  if (!backend || flushing || queue.length === 0) return queue.length === 0
  flushing = true
  const batch = queue
  queue = []
  useDbStatus.setState({ status: 'saving' })
  try {
    const { rev, prevRev } = await backend.write(batch)
    // Another till / tab wrote in between: pick its changes up.
    const someoneElseWrote = prevRev !== knownRev
    knownRev = rev
    useDbStatus.setState({ status: 'saved', lastSavedAt: Date.now(), error: '' })
    if (someoneElseWrote) window.setTimeout(() => void checkForExternalChanges(), 300)
    return true
  } catch (e) {
    // Keep the changes and try again: nothing typed in the app is ever dropped.
    queue = [...batch, ...queue]
    useDbStatus.setState({ status: 'error', error: (e as Error).message })
    scheduleFlush(3000)
    return false
  } finally {
    flushing = false
    if (queue.length && useDbStatus.getState().status !== 'error') scheduleFlush(30)
  }
}

/** Writes everything still pending. Resolves to false if the database is unreachable. */
export const flushDatabase = async (): Promise<boolean> => {
  window.clearTimeout(flushTimer)
  for (let i = 0; i < 20 && (queue.length || flushing); i++) {
    if (flushing) await new Promise((r) => setTimeout(r, 50))
    else if (!(await flush())) return false
  }
  return queue.length === 0
}

const diffRows = (table: string, prev: any[] = [], next: any[] = []): Op[] => {
  const before = new Map(prev.map((r) => [r.id, r]))
  const upserts = next.filter((r) => before.get(r.id) !== r)
  const nextIds = new Set(next.map((r) => r.id))
  const deletes = prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id)
  const ops: Op[] = []
  if (upserts.length) ops.push({ type: 'upsert', table, rows: upserts })
  if (deletes.length) ops.push({ type: 'delete', table, ids: deletes })
  return ops
}

const watchStores = () => {
  const stores = new Set(bindings().map((b) => b.store))
  stores.forEach((store) => {
    const own = bindings().filter((b) => b.store === store)
    store.subscribe((state, prev) => {
      if (applying) return
      const ops: Op[] = []
      for (const b of own) {
        if (state[b.field] === prev[b.field]) continue
        if (b.kind === 'rows') ops.push(...diffRows(b.name, prev[b.field], state[b.field]))
        else ops.push({ type: 'set', key: b.name, value: state[b.field] })
      }
      if (ops.length) {
        queue.push(...ops)
        useDbStatus.setState({ status: 'saving' })
        scheduleFlush()
      }
    })
  })
}

// ----------------------------------------------------------------------------
// Changes made elsewhere (another tab, another till on the network)
// ----------------------------------------------------------------------------

const reloadFromDatabase = async () => {
  if (!backend) return
  const doc = await backend.load()
  if (queue.length || flushing) return // our own writes first — checked again later
  knownRev = doc.rev
  applySnapshot(toSnapshot(doc))
}

export const checkForExternalChanges = async () => {
  if (!backend || queue.length || flushing) return
  try {
    const rev = await backend.rev()
    if (rev !== knownRev) await reloadFromDatabase()
  } catch {
    /* server briefly unreachable — next tick */
  }
}

// ----------------------------------------------------------------------------
// Legacy data — the very first, browser-only version of the app
// ----------------------------------------------------------------------------

const readLegacy = (key: string): any => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state ?? parsed
  } catch {
    return null
  }
}

const readLegacyBrowserData = (): Partial<Snapshot> | null => {
  if (localStorage.getItem('altech-legacy-imported')) return null
  const products = readLegacy('cosmetics-products-v1')
  const workers = readLegacy('cosmetics-workers-v1')
  const legacy: Partial<Snapshot> = {
    products: products?.products ?? [],
    brands: products?.brands ?? [],
    categories: products?.categories ?? [],
    units: products?.units ?? [],
    suppliers: readLegacy('cosmetics-suppliers-v1')?.suppliers ?? [],
    purchases: readLegacy('cosmetics-purchases-v1')?.purchases ?? [],
    workers: workers?.workers ?? [],
    workerRoles: workers?.roles ?? [],
    expenses: readLegacy('cosmetics-expenses-v1')?.expenses ?? [],
    caisse: readLegacy('cosmetics-caisse')?.transactions ?? [],
    settings: readLegacy('cosmetics-settings-v1')?.settings,
  }
  const hasData = ['products', 'purchases', 'workers', 'expenses'].some(
    (k) => ((legacy as any)[k] ?? []).length > 0,
  )
  return hasData ? legacy : null
}

const isEmpty = (s: Snapshot) =>
  s.products.length === 0 &&
  s.purchases.length === 0 &&
  s.departments.length === 0 &&
  s.affectations.length === 0 &&
  s.users.length === 0

// ----------------------------------------------------------------------------
// Boot / restore
// ----------------------------------------------------------------------------

const detectBackend = async (): Promise<Backend> => {
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal })
    window.clearTimeout(timer)
    const body = await res.json()
    if (body?.app === 'altech-pos') return serverBackend
  } catch {
    /* no local server — the browser keeps the data */
  }
  return browserBackend()
}

const loadServerInfo = async () => {
  try {
    const info = await fetch('/api/info', { cache: 'no-store' }).then(json)
    useDbStatus.setState({ dataDir: info.dataDir ?? '', lanUrls: info.lanUrls ?? [] })
  } catch {
    /* informative only */
  }
}

/** Loads the shop into the stores and starts saving every change. Called once at boot. */
export const initDatabase = async (): Promise<void> => {
  if (started) return
  backend = await detectBackend()
  useDbStatus.setState({ backend: backend.kind })

  const doc = await backend.load()
  knownRev = doc.rev
  let snapshot = toSnapshot(doc)

  if (isEmpty(snapshot)) {
    const legacy = readLegacyBrowserData()
    if (legacy) {
      snapshot = normaliseSnapshot({ ...snapshot, ...legacy })
      const { rev } = await backend.replace(snapshotToDoc(snapshot))
      knownRev = rev
      localStorage.setItem('altech-legacy-imported', new Date().toISOString())
    }
  }

  // Demo version: an empty database starts filled with the demonstration data.
  if (isEmpty(snapshot)) {
    const { buildDemoSnapshot } = await import('@/data/demoData')
    snapshot = normaliseSnapshot(buildDemoSnapshot())
    const { rev } = await backend.replace(snapshotToDoc(snapshot))
    knownRev = rev
  }

  applySnapshot(snapshot)
  watchStores()
  started = true

  if (backend.kind === 'server') {
    void loadServerInfo()
    // Other tills / tabs: cheap revision check every few seconds while visible.
    window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkForExternalChanges()
    }, 4000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForExternalChanges()
    })
    // Closing the window with changes still in flight: hand them to the server anyway.
    window.addEventListener('pagehide', () => {
      if (queue.length) navigator.sendBeacon?.('/api/db/ops', JSON.stringify({ ops: queue }))
    })
  } else {
    window.addEventListener('beforeunload', (e) => {
      if (queue.length || flushing) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }
}

/** Fills the gaps of a partial snapshot (old backups, legacy data). */
export const normaliseSnapshot = (partial: Partial<Snapshot>): Snapshot => {
  const doc = snapshotToDoc({
    ...toSnapshot({}),
    ...Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined && v !== null)),
  } as Snapshot)
  return toSnapshot(doc)
}

/**
 * Restores a backup: the database is replaced (the server keeps a copy of the
 * previous state in data/backups/) and every screen reloads from it.
 */
export const replaceDatabase = async (partial: Partial<Snapshot>): Promise<void> => {
  if (!backend) throw new Error('DATABASE_NOT_READY')
  await flushDatabase()
  // Backups of the former cloud version carry no logins: keep the current ones
  // so restoring one never locks the shop out.
  const users = partial.users?.length ? partial.users : useAuthStore.getState().users
  const snapshot = normaliseSnapshot({ ...partial, users })
  const { rev } = await backend.replace(snapshotToDoc(snapshot))
  knownRev = rev
  applySnapshot(snapshot)
}
