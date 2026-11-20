import { create } from 'zustand'
import type { Affectation, AffectationEvent, AffectationLine } from '@/types'
import { uid, round2 } from '@/utils/helpers'
import { useProductStore } from './useProductStore'

type AffectationInput = Omit<Affectation, 'id' | 'reference' | 'createdAt' | 'history' | 'total'>

interface AffectationState {
  affectations: Affectation[]
  /** Creates an affectation and takes its quantities out of the stock. */
  addAffectation: (data: AffectationInput, by: string) => Affectation
  /** Edits an affectation; quantity changes are carried over to the stock. */
  updateAffectation: (id: string, data: Partial<AffectationInput>, by: string, note?: string) => void
  /** Deletes an affectation and puts its quantities back in the stock. */
  deleteAffectation: (id: string) => void
}

const nextRef = (list: Affectation[]): string => {
  const year = new Date().getFullYear()
  const max = list.reduce((m, a) => {
    const n = Number(a.reference.split('-').pop())
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `AFF-${year}-${String(max + 1).padStart(3, '0')}`
}

export const linesTotal = (lines: AffectationLine[]) =>
  round2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0))

const qtyByProduct = (lines: AffectationLine[]) => {
  const map = new Map<string, number>()
  lines.forEach((l) => l.productId && map.set(l.productId, (map.get(l.productId) ?? 0) + l.quantity))
  return map
}

/** Applies `after − before` (quantities leaving the stock) to every product. */
const shiftStock = (before: AffectationLine[], after: AffectationLine[]) => {
  const old = qtyByProduct(before)
  const next = qtyByProduct(after)
  const { reduceStock, restoreComponent } = useProductStore.getState()
  new Set([...old.keys(), ...next.keys()]).forEach((productId) => {
    const delta = (next.get(productId) ?? 0) - (old.get(productId) ?? 0)
    if (delta > 0) reduceStock(productId, delta)
    else if (delta < 0) restoreComponent(productId, -delta)
  })
}

const event = (type: AffectationEvent['type'], by: string, note: string): AffectationEvent => ({
  id: uid('ev'),
  type,
  date: new Date().toISOString(),
  by,
  note,
})

export const useAffectationStore = create<AffectationState>()((set, get) => ({
  affectations: [],
  addAffectation: (data, by) => {
    const affectation: Affectation = {
      ...data,
      id: uid('aff'),
      reference: nextRef(get().affectations),
      total: linesTotal(data.lines),
      history: [event('created', by, data.description)],
      createdBy: by,
      createdAt: new Date().toISOString(),
    }
    shiftStock([], data.lines)
    set((s) => ({ affectations: [affectation, ...s.affectations] }))
    return affectation
  },
  updateAffectation: (id, data, by, note) => {
    const before = get().affectations.find((a) => a.id === id)
    if (!before) return
    if (data.lines) shiftStock(before.lines, data.lines)
    set((s) => ({
      affectations: s.affectations.map((a) =>
        a.id === id
          ? {
              ...a,
              ...data,
              total: data.lines ? linesTotal(data.lines) : a.total,
              history: [...(a.history ?? []), event('updated', by, note ?? '')],
            }
          : a,
      ),
    }))
  },
  deleteAffectation: (id) => {
    const target = get().affectations.find((a) => a.id === id)
    if (target) shiftStock(target.lines, [])
    set((s) => ({ affectations: s.affectations.filter((a) => a.id !== id) }))
  },
}))
