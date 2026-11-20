import type { Product } from '@/types'
import { round2 } from './helpers'

/**
 * Retail ("vente au détail") maths.
 *
 * A divisible product is stocked as containers — a 100 ml perfume bottle — but
 * sold by portions of that content. Two numbers describe the stock:
 *
 *   `quantity`      sealed containers still closed
 *   `openRemaining` content left inside the container opened at the counter
 *
 * Everything below works on the TOTAL content (`quantity × capacity +
 * openRemaining`) and re-splits it afterwards, so a sale of 250 ml out of two
 * 100 ml bottles + one open at 90 ml resolves by itself.
 */

/** Content is stored with 3 decimals, like the `numeric(12,3)` columns. */
const round3 = (value: number): number => Math.round((value + Number.EPSILON) * 1000) / 1000

/** Is this product configured for retail selling? */
export const isDivisible = (p: Product): boolean => !!p.isDivisible && (p.capacity ?? 0) > 0

/** Content of one container (0 when the product is not divisible). */
export const capacityOf = (p: Product): number => (isDivisible(p) ? (p.capacity ?? 0) : 0)

/** Total content available, all containers included. */
export const totalContent = (p: Product): number =>
  isDivisible(p) ? round3(p.quantity * capacityOf(p) + (p.openRemaining ?? 0)) : 0

/** Purchase cost of ONE unit of content — used for exact retail margins. */
export const contentUnitCost = (p: Product): number => {
  const cap = capacityOf(p)
  if (cap <= 0) return 0
  return round2(p.purchasePrice / cap)
}

/** Re-split a total content into sealed containers + opened container. */
const split = (total: number, capacity: number): { quantity: number; openRemaining: number } => {
  if (capacity <= 0) return { quantity: 0, openRemaining: 0 }
  const safe = Math.max(0, round3(total))
  let quantity = Math.floor(safe / capacity)
  let open = round3(safe - quantity * capacity)
  // Rounding can leave a container that is in fact full labelled as "opened".
  if (open >= capacity) {
    quantity += 1
    open = round3(open - capacity)
  }
  return { quantity, openRemaining: Math.max(0, open) }
}

/** Stock after selling / consuming `amount` units of content. */
export const consumeContent = (
  p: Product,
  amount: number,
): { quantity: number; openRemaining: number } =>
  split(totalContent(p) - Math.max(0, amount), capacityOf(p))

/** Stock after giving `amount` units of content back (sale cancelled, recovery). */
export const restoreContent = (
  p: Product,
  amount: number,
): { quantity: number; openRemaining: number } =>
  split(totalContent(p) + Math.max(0, amount), capacityOf(p))

/** Name of a whole article — "boîte", "paquet", "flacon"… ("unité" when not set). */
export const stockUnitName = (p: Pick<Product, 'stockUnit'>, plural = false): string => {
  const name = (p.stockUnit ?? '').trim()
  if (!name) return plural ? 'unités' : 'unité'
  return plural && !/[sxz]$/i.test(name) ? `${name}s` : name
}

/** "12 boîtes" / "1 paquet" — a count with its stock unit. */
export const stockCountLabel = (p: Pick<Product, 'stockUnit'>, count: number): string =>
  `${count} ${stockUnitName(p, Math.abs(count) > 1)}`

/**
 * What is on the shelf, in the words of the counter: sealed boxes, pieces left
 * in the opened box, total pieces and how full the opened box is (0 → 1).
 */
export const shelfBreakdown = (p: Product) => {
  const capacity = capacityOf(p)
  const loose = round2(p.openRemaining ?? 0)
  return {
    boxes: p.quantity,
    loose,
    total: totalContent(p),
    capacity,
    unit: p.unit ?? '',
    openRatio: capacity > 0 ? Math.min(1, loose / capacity) : 0,
  }
}

/** "12 boîtes + 7 pièces" — how the shelf actually looks. */
export const contentLabel = (p: Product): string => {
  if (!isDivisible(p)) return stockCountLabel(p, p.quantity)
  const { boxes, loose, unit } = shelfBreakdown(p)
  const sealed = stockCountLabel(p, boxes)
  return loose > 0 ? `${sealed} + ${loose} ${unit}`.trim() : sealed
}

/** Splits an amount of content into whole boxes + remainder: 47 pcs → 2 × 20 + 7. */
export const splitAmount = (p: Product, amount: number): { boxes: number; rest: number } => {
  const cap = capacityOf(p)
  if (cap <= 0) return { boxes: 0, rest: amount }
  const boxes = Math.floor(round3(amount) / cap)
  return { boxes, rest: round3(amount - boxes * cap) }
}

/** Opens one sealed box at the counter: its content becomes loose pieces. */
export const openOneBox = (p: Product): { quantity: number; openRemaining: number } | null => {
  if (!isDivisible(p) || p.quantity <= 0 || (p.openRemaining ?? 0) > 0) return null
  return { quantity: p.quantity - 1, openRemaining: capacityOf(p) }
}

/** Cost of one whole unit, or of one content unit for a `byContent` usage. */
export const componentUnitCost = (p: Product, byContent: boolean): number =>
  byContent && isDivisible(p) ? contentUnitCost(p) : round2(p.purchasePrice)

/** How much of `p` a recipe can still draw from — content or whole units. */
export const componentAvailable = (p: Product, byContent: boolean): number =>
  byContent && isDivisible(p) ? totalContent(p) : p.quantity
