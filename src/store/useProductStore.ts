import { create } from 'zustand'
import type { Product } from '@/types'
import { uid } from '@/utils/helpers'
import { consumeContent, restoreContent, isDivisible, openOneBox } from '@/utils/retail'

interface ProductState {
  products: Product[]
  brands: string[]
  categories: string[]
  /** Measure units available for retail products (ml, g, L…). */
  units: string[]
  addProduct: (data: Omit<Product, 'id' | 'createdAt'>) => Product
  updateProduct: (id: string, data: Partial<Product>) => void
  deleteProduct: (id: string) => void
  /** Increase stock + refresh prices/min (and optional expiration) after a purchase line. */
  receiveStock: (
    productId: string,
    qty: number,
    patch: {
      purchasePrice: number
      minQuantity: number
      hasExpiration?: boolean
      expirationDate?: string
      isDivisible?: boolean
      unit?: string
      capacity?: number
      retailStep?: number
    },
  ) => void
  /** Decrease stock after a sale. */
  reduceStock: (productId: string, qty: number) => void
  /** Sell a fraction of a divisible product: eats the opened container first. */
  consumeRetail: (productId: string, amount: number) => void
  /** Give a fraction back (sale cancelled, production recovered). */
  restoreRetail: (productId: string, amount: number) => void
  /** Break a sealed box at the counter: its content becomes loose pieces. */
  openBox: (productId: string) => boolean
  /** Production consumption — whole units, or content when `byContent`. */
  consumeComponent: (productId: string, quantity: number, byContent?: boolean) => void
  restoreComponent: (productId: string, quantity: number, byContent?: boolean) => void
  addBrand: (name: string) => void
  addCategory: (name: string) => void
  addUnit: (name: string) => void
}

export const useProductStore = create<ProductState>()(
  (set, get) => ({
    products: [],
    brands: [],
    categories: [],
    units: [],
    addProduct: (data) => {
      const product: Product = { ...data, id: uid('p'), createdAt: new Date().toISOString() }
      set((s) => ({ products: [product, ...s.products] }))
      return product
    },
    updateProduct: (id, data) => {
      set((s) => ({
        products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
      }))
    },
    deleteProduct: (id) => {
      set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
    },
    receiveStock: (productId, qty, patch) =>
      set((s) => ({
        products: s.products.map((p) =>
          p.id === productId
            ? {
                ...p,
                quantity: p.quantity + qty,
                purchasePrice: patch.purchasePrice,
                minQuantity: patch.minQuantity,
                // Only overwrite expiration fields when the purchase line carries them,
                // so re-stocking without expiry keeps the product's existing setting.
                ...(patch.hasExpiration !== undefined ? { hasExpiration: patch.hasExpiration } : {}),
                ...(patch.hasExpiration
                  ? { expirationDate: patch.expirationDate }
                  : patch.hasExpiration === false
                    ? { expirationDate: undefined }
                    : {}),
                // Retail settings follow the same rule: a purchase line that does
                // not mention them leaves the product's configuration alone.
                ...(patch.isDivisible !== undefined ? { isDivisible: patch.isDivisible } : {}),
                ...(patch.isDivisible
                  ? {
                      unit: patch.unit ?? p.unit,
                      capacity: patch.capacity ?? p.capacity,
                      retailStep: patch.retailStep ?? p.retailStep,
                      openRemaining: p.openRemaining ?? 0,
                    }
                  : {}),
              }
            : p,
        ),
      })),
    reduceStock: (productId, qty) =>
      set((s) => ({
        products: s.products.map((p) =>
          p.id === productId ? { ...p, quantity: Math.max(0, p.quantity - qty) } : p,
        ),
      })),
    consumeRetail: (productId, amount) =>
      set((s) => ({
        products: s.products.map((p) =>
          p.id === productId && isDivisible(p) ? { ...p, ...consumeContent(p, amount) } : p,
        ),
      })),
    restoreRetail: (productId, amount) =>
      set((s) => ({
        products: s.products.map((p) =>
          p.id === productId && isDivisible(p) ? { ...p, ...restoreContent(p, amount) } : p,
        ),
      })),
    openBox: (productId) => {
      const product = get().products.find((p) => p.id === productId)
      const next = product ? openOneBox(product) : null
      if (!next) return false
      set((s) => ({ products: s.products.map((p) => (p.id === productId ? { ...p, ...next } : p)) }))
      return true
    },
    consumeComponent: (productId, quantity, byContent) => {
      const product = get().products.find((p) => p.id === productId)
      if (!product) return
      if (byContent && isDivisible(product)) get().consumeRetail(productId, quantity)
      else get().reduceStock(productId, quantity)
    },
    restoreComponent: (productId, quantity, byContent) => {
      const product = get().products.find((p) => p.id === productId)
      if (!product) return
      if (byContent && isDivisible(product)) get().restoreRetail(productId, quantity)
      else
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, quantity: p.quantity + quantity } : p,
          ),
        }))
    },
    addBrand: (name) =>
      set((s) => {
        if (s.brands.includes(name)) return s
        return { brands: [...s.brands, name] }
      }),
    addCategory: (name) =>
      set((s) => {
        if (s.categories.includes(name)) return s
        return { categories: [...s.categories, name] }
      }),
    addUnit: (name) =>
      set((s) => {
        if (s.units.includes(name)) return s
        return { units: [...s.units, name] }
      }),
  }),
)
