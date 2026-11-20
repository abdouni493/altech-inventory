import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  SprayCan,
  Barcode as BarcodeIcon,
  CalendarClock,
  CalendarX,
  PackageOpen,
  Boxes,
  AlertTriangle,
  Coins,
  Package,
  History,
} from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, SearchInput, EmptyState, ViewToggle, ProgressBar } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProductModal } from './ProductModal'
import { ProductHistoryModal } from './ProductHistoryModal'
import { Barcode } from '@/components/shared/BarcodeGenerator'
import { useProductStore } from '@/store/useProductStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, expiryInfo, round2 } from '@/utils/helpers'
import { isInStock } from '@/utils/calculations'
import {
  isDivisible,
  contentUnitCost,
  capacityOf,
  shelfBreakdown,
  stockCountLabel,
  stockUnitName,
} from '@/utils/retail'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

/** Compact pill showing a product's expiration date, coloured by urgency. */
const ExpiryPill = ({ product, full = false }: { product: Product; full?: boolean }) => {
  const { t } = useTranslation()
  if (!product.hasExpiration || !product.expirationDate) return null
  const info = expiryInfo(product.expirationDate)
  if (!info) return null
  const dateLabel = format(new Date(product.expirationDate), 'dd/MM/yyyy')
  const tone =
    info.status === 'expired'
      ? 'bg-terracotta/15 text-terracotta border-terracotta/30'
      : info.status === 'soon'
        ? 'bg-gold/15 text-[#B45309] border-gold/40'
        : 'bg-sage/12 text-sage border-sage/25'
  const Icon = info.status === 'expired' ? CalendarX : CalendarClock
  const note =
    info.status === 'expired'
      ? info.days === 0
        ? t('expiresToday')
        : t('expiredSinceDays').replace('{n}', String(Math.abs(info.days)))
      : info.days === 0
        ? t('expiresToday')
        : t('expiresInDays').replace('{n}', String(info.days))
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone} ${
        info.status === 'expired' ? 'animate-pulse-glow' : ''
      }`}
      title={`${t('expiresOn')} ${dateLabel}`}
    >
      <Icon size={13} />
      {full ? `${dateLabel} · ${note}` : dateLabel}
    </span>
  )
}

/**
 * Detail stock read-out: sealed boxes on the shelf and the pieces left in the
 * box opened at the counter, e.g. "12 boîtes + 7 cigarettes" — with a gauge of
 * the opened box and a one-click "open a box".
 */
const RetailStock = ({ product, compact = false }: { product: Product; compact?: boolean }) => {
  const { t } = useTranslation()
  const openBox = useProductStore((s) => s.openBox)
  if (!isDivisible(product)) return null
  const { boxes, loose, total, capacity, unit, openRatio } = shelfBreakdown(product)
  if (compact)
    return (
      <span className="text-[11px] text-wood-medium">
        {stockCountLabel(product, boxes)}
        {loose > 0 && <span className="font-semibold text-wood-warm"> + {loose} {unit}</span>}
      </span>
    )
  const canOpen = boxes > 0 && loose <= 0
  return (
    <div className="mt-3 rounded-lg border border-wood-warm/20 bg-wood-warm/[0.04] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-wood-warm">
          <PackageOpen size={13} />
          {t('retailSelling')}
        </span>
        <span className="text-[10px] font-semibold text-wood-medium">
          1 {stockUnitName(product)} = {capacity} {unit}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md bg-white px-1 py-1.5 ring-1 ring-woodborder">
          <p className="text-[10px] text-wood-medium">{stockUnitName(product, true)}</p>
          <p className="text-mono text-sm font-bold text-wood-dark">{boxes}</p>
        </div>
        <div className="rounded-md bg-white px-1 py-1.5 ring-1 ring-woodborder">
          <p className="text-[10px] text-wood-medium">{t('openedBox')}</p>
          <p className="text-mono text-sm font-bold text-wood-warm">
            {loose}
            <span className="text-[10px] font-normal text-wood-medium">/{capacity}</span>
          </p>
        </div>
        <div className="rounded-md bg-white px-1 py-1.5 ring-1 ring-woodborder">
          <p className="text-[10px] text-wood-medium">{t('totalWord')} {unit}</p>
          <p className="text-mono text-sm font-bold text-sage">{total}</p>
        </div>
      </div>
      {/* gauge of the opened box */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-woodborder">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${openRatio * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-wood-warm to-aqua"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {product.purchasePrice > 0 ? (
          <p className="text-[10px] text-wood-medium">
            {t('costPerUnit')} {unit} : <b className="text-wood-dark">{formatMoney(contentUnitCost(product))}</b>
          </p>
        ) : (
          <span />
        )}
        {canOpen && (
          <button
            type="button"
            onClick={() => {
              if (openBox(product.id)) toast.success(`${t('boxOpened')} — ${product.name}`)
            }}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-wood-warm ring-1 ring-wood-warm/30 transition hover:bg-wood-warm hover:text-white"
          >
            <PackageOpen size={11} />
            {t('openABox').replace('{box}', stockUnitName(product))}
          </button>
        )}
      </div>
    </div>
  )
}

/** Small KPI tile of the stock summary strip. */
const StockStat = ({
  icon,
  label,
  value,
  accent,
  index,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  index: number
}) => (
  <motion.div
    variants={cardVariants}
    custom={index}
    initial="initial"
    animate="animate"
    className="card-wood flex items-center gap-3 rounded-xl p-3.5"
  >
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-wood ${accent}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="truncate text-[11px] text-wood-medium">{label}</p>
      <p className="text-mono truncate text-lg font-bold text-wood-dark">{value}</p>
    </div>
  </motion.div>
)

export const StockPage = () => {
  const { t } = useTranslation()
  const { products, brands, categories, deleteProduct } = useProductStore()
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'retail' | 'whole' | 'low'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [historyOf, setHistoryOf] = useState<Product | null>(null)

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase()
        const matchSearch = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)
        const matchBrand = !brandFilter || p.brand === brandFilter
        const matchCat = !catFilter || p.category === catFilter
        const matchKind =
          kindFilter === 'all' ||
          (kindFilter === 'retail' && isDivisible(p)) ||
          (kindFilter === 'whole' && !isDivisible(p)) ||
          (kindFilter === 'low' && p.quantity <= p.minQuantity)
        return matchSearch && matchBrand && matchCat && matchKind
      }),
    [products, search, brandFilter, catFilter, kindFilter],
  )

  // Summary strip — the shape of the stock at a glance.
  const summary = useMemo(() => {
    const retail = products.filter(isDivisible)
    const stockValue = products.reduce((s, p) => {
      const open = isDivisible(p) ? (p.openRemaining ?? 0) * contentUnitCost(p) : 0
      return s + p.quantity * p.purchasePrice + open
    }, 0)
    return {
      count: products.length,
      // Articles really available — not the accumulated unit total, which used
      // to read as a product count and never matched what is on the shelf.
      inStock: products.filter(isInStock).length,
      retailCount: retail.length,
      lowCount: products.filter((p) => p.quantity <= p.minQuantity).length,
      stockValue: round2(stockValue),
    }
  }, [products])

  const stockBadge = (p: Product) => {
    // A retail product with an opened container is still on sale, even at 0 sealed units.
    if (!isInStock(p)) return <Badge tone="unpaid">{t('outOfStock')}</Badge>
    if (p.quantity <= p.minQuantity) return <Badge tone="partial">{t('lowStock')}</Badge>
    return <Badge tone="paid">{t('inStock')}</Badge>
  }

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (p: Product) => {
    setEditing(p)
    setModalOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={t('stock')}
        subtitle={`${products.length} ${t('products').toLowerCase()}`}
        actions={
          <Button onClick={openNew}>
            <Plus size={18} />
            {t('newProduct')}
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StockStat index={0} icon={<SprayCan size={18} />} label={t('products')} value={`${summary.count}`} accent="from-sky-500 to-indigo-600" />
        <StockStat index={1} icon={<Boxes size={18} />} label={t('productsInStock')} value={`${summary.inStock}`} accent="from-wood-warm to-gold" />
        <StockStat index={2} icon={<PackageOpen size={18} />} label={t('retailProducts')} value={`${summary.retailCount}`} accent="from-cyan-500 to-sky-600" />
        <StockStat index={3} icon={<AlertTriangle size={18} />} label={t('stockAlerts')} value={`${summary.lowCount}`} accent="from-terracotta to-rose-600" />
        <StockStat index={4} icon={<Coins size={18} />} label={t('stockValue')} value={formatMoney(summary.stockValue)} accent="from-sage to-emerald-500" />
      </div>

      {/* Filters */}
      <div className="card-wood mb-5 space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} className="min-w-[220px] flex-1" />
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="max-w-[200px]">
            <option value="">{t('all')} — {t('brand')}</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="max-w-[200px]">
            <option value="">{t('all')} — {t('category')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <ViewToggle view={view} onChange={setView} labels={{ cards: t('cardView'), table: t('tableView') }} />
        </div>
        <div className="inline-flex flex-wrap rounded-xl border border-wood-light/40 bg-white/70 p-1">
          {([
            { k: 'all', l: t('all') },
            { k: 'retail', l: t('retailProducts') },
            { k: 'whole', l: t('sealedUnits') },
            { k: 'low', l: t('stockAlerts') },
          ] as const).map((o) => (
            <button
              key={o.k}
              onClick={() => setKindFilter(o.k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kindFilter === o.k ? 'bg-wood-btn text-white shadow-wood' : 'text-wood-medium hover:bg-wood-cream'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<SprayCan size={40} />} action={<Button onClick={openNew}><Plus size={18} />{t('newProduct')}</Button>} />
      ) : view === 'cards' ? (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                variants={cardVariants}
                custom={i}
                layout
                whileHover={{ y: -5 }}
                className="card-wood card-hover flex flex-col rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-wood-dark">{p.name}</h3>
                    <p className="text-xs text-wood-medium">{p.brand} · {p.category}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {stockBadge(p)}
                    {isDivisible(p) && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-wood-warm/25 bg-wood-warm/10 px-1.5 py-0.5 text-[10px] font-bold text-wood-warm">
                        <PackageOpen size={11} />
                        {t('detailBadge')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-wood-medium/70">
                  <BarcodeIcon size={13} />
                  <span className="text-mono">{p.barcode}</span>
                </div>

                {p.hasExpiration && p.expirationDate && (
                  <div className="mt-2">
                    <ExpiryPill product={p} full />
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-wood-cream/40 px-2 py-1.5">
                    <p className="text-[10px] text-wood-medium">{t('purchasePrice')}</p>
                    <p className="text-mono font-semibold text-wood-dark">{formatMoney(p.purchasePrice)}</p>
                  </div>
                  <div className="rounded-lg bg-sage/10 px-2 py-1.5">
                    <p className="text-[10px] text-wood-medium">{t('stockValue')}</p>
                    <p className="text-mono font-semibold text-sage">{formatMoney(round2(p.quantity * p.purchasePrice))}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-wood-medium"><Package size={12} />{t('quantity')}</span>
                    <span className="text-mono font-bold text-wood-dark">{stockCountLabel(p, p.quantity)} <span className="font-normal text-wood-medium/60">/ min {p.minQuantity}</span></span>
                  </div>
                  <ProgressBar value={p.quantity} max={Math.max(p.minQuantity * 3, p.quantity)} danger={p.quantity <= p.minQuantity} />
                </div>

                <RetailStock product={p} />

                <div className="mt-4 flex gap-2 border-t border-wood-light/20 pt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewing(p)} title={t('view')}>
                    <Eye size={15} />
                  </Button>
                  <Button size="sm" variant="gold" className="flex-1" onClick={() => setHistoryOf(p)} title={t('productHistory')}>
                    <History size={15} />
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil size={15} />
                  </Button>
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => setDeleting(p)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="card-wood overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-start">{t('productName')}</th>
                  <th className="px-4 py-3 text-start">{t('brand')}</th>
                  <th className="px-4 py-3 text-start">{t('category')}</th>
                  <th className="px-4 py-3 text-end">{t('purchasePrice')}</th>
                  <th className="px-4 py-3 text-end">{t('stockValue')}</th>
                  <th className="px-4 py-3 text-center">{t('quantity')}</th>
                  <th className="px-4 py-3 text-center">{t('status')}</th>
                  <th className="px-4 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                    className="border-b border-wood-light/15 hover:bg-wood-cream/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-wood-dark">
                      <span className="flex items-center gap-1.5">
                        {p.name}
                        {isDivisible(p) && <PackageOpen size={13} className="shrink-0 text-wood-warm" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-wood-medium">{p.brand}</td>
                    <td className="px-4 py-2.5 text-wood-medium">{p.category}</td>
                    <td className="text-mono px-4 py-2.5 text-end">{formatMoney(p.purchasePrice)}</td>
                    <td className="text-mono px-4 py-2.5 text-end text-sage">
                      {formatMoney(round2(p.quantity * p.purchasePrice))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <p className="text-mono font-bold">{p.quantity}</p>
                      <RetailStock product={p} compact />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-center gap-1">
                        {stockBadge(p)}
                        <ExpiryPill product={p} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setViewing(p)} title={t('view')} className="rounded-lg p-1.5 text-wood-medium hover:bg-wood-cream"><Eye size={16} /></button>
                        <button onClick={() => setHistoryOf(p)} title={t('productHistory')} className="rounded-lg p-1.5 text-[#B45309] hover:bg-gold/10"><History size={16} /></button>
                        <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-wood-warm hover:bg-wood-cream"><Pencil size={16} /></button>
                        <button onClick={() => setDeleting(p)} className="rounded-lg p-1.5 text-terracotta hover:bg-terracotta/10"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} product={editing} />
      <ProductHistoryModal product={historyOf} onClose={() => setHistoryOf(null)} />

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name} subtitle={`${viewing?.brand} · ${viewing?.category}`} size="md">
        {viewing && (
          <div className="space-y-4">
            <p className="text-sm text-wood-medium">{viewing.description || '—'}</p>
            <div className="flex justify-center rounded-xl bg-white p-3">
              <Barcode value={viewing.barcode} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-wood-cream/40 p-3"><p className="text-xs text-wood-medium">{t('purchasePrice')}</p><p className="text-mono font-bold text-wood-dark">{formatMoney(viewing.purchasePrice)}</p></div>
              <div className="rounded-xl bg-sage/10 p-3"><p className="text-xs text-wood-medium">{t('stockValue')}</p><p className="text-mono font-bold text-sage">{formatMoney(round2(viewing.quantity * viewing.purchasePrice))}</p></div>
              <div className="rounded-xl bg-wood-cream/40 p-3"><p className="text-xs text-wood-medium">{t('mainQuantity')}</p><p className="text-mono font-bold">{viewing.quantity}</p></div>
              <div className="rounded-xl bg-wood-cream/40 p-3"><p className="text-xs text-wood-medium">{t('minQuantity')}</p><p className="text-mono font-bold">{viewing.minQuantity}</p></div>
            </div>
            {isDivisible(viewing) && (
              <div className="space-y-3">
                <RetailStock product={viewing} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-wood-cream/40 p-3">
                    <p className="text-xs text-wood-medium">{t('portionSize')}</p>
                    <p className="text-mono font-bold">{viewing.retailStep} {viewing.unit}</p>
                  </div>
                  <div className="rounded-xl bg-wood-cream/40 p-3">
                    <p className="text-xs text-wood-medium">{t('costPerUnit')} {viewing.unit}</p>
                    <p className="text-mono font-bold">{formatMoney(contentUnitCost(viewing))}</p>
                  </div>
                </div>
              </div>
            )}
            {viewing.hasExpiration && viewing.expirationDate && (
              <div className="flex items-center justify-between rounded-xl bg-wood-cream/40 p-3">
                <span className="flex items-center gap-1.5 text-xs text-wood-medium"><CalendarClock size={14} />{t('expirationDate')}</span>
                <ExpiryPill product={viewing} full />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteProduct(deleting.id)
            toast.success(t('deleted'))
          }
        }}
      />
    </div>
  )
}
