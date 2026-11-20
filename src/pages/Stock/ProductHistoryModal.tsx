import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, History, Package, ShoppingCart, ClipboardList, Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useTranslation } from '@/i18n/useTranslation'
import { productHistory } from '@/utils/calculations'
import { formatMoney, round2 } from '@/utils/helpers'
import type { Product } from '@/types'

type Tab = 'all' | 'purchase' | 'affectation'

/** Every movement of one product: purchases (in) and affectations (out). */
export const ProductHistoryModal = ({ product, onClose }: { product: Product | null; onClose: () => void }) => {
  const { t } = useTranslation()
  const purchases = usePurchaseStore((s) => s.purchases)
  const affectations = useAffectationStore((s) => s.affectations)
  const [tab, setTab] = useState<Tab>('all')

  const rows = useMemo(
    () => (product ? productHistory(product.id, purchases, affectations) : []),
    [product, purchases, affectations],
  )
  const shown = tab === 'all' ? rows : rows.filter((r) => r.kind === tab)

  const totals = useMemo(() => {
    const ins = rows.filter((r) => r.kind === 'purchase')
    const outs = rows.filter((r) => r.kind === 'affectation')
    const byDep = new Map<string, number>()
    outs.forEach((r) => byDep.set(r.party, (byDep.get(r.party) ?? 0) + r.quantity))
    return {
      inQty: ins.reduce((s, r) => s + r.quantity, 0),
      inValue: round2(ins.reduce((s, r) => s + r.total, 0)),
      outQty: outs.reduce((s, r) => s + r.quantity, 0),
      outValue: round2(outs.reduce((s, r) => s + r.total, 0)),
      avgPrice: ins.length ? round2(ins.reduce((s, r) => s + r.total, 0) / Math.max(1, ins.reduce((s, r) => s + r.quantity, 0))) : 0,
      lastPurchase: ins[0],
      byDep: [...byDep.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [rows])

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product ? `${t('productHistory')} — ${product.name}` : ''}
      subtitle={product ? `${product.barcode} · ${product.brand} · ${product.category}` : undefined}
      icon={<History size={20} />}
      size="xl"
    >
      {product && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-wood-cream/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-wood-medium"><Package size={13} />{t('quantity')}</p>
              <p className="text-mono text-xl font-bold text-wood-dark">{product.quantity}</p>
              <p className="text-[10px] text-wood-medium">min {product.minQuantity}</p>
            </div>
            <div className="rounded-xl bg-sky-500/10 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-wood-medium"><ArrowDownLeft size={13} />{t('purchasesIn')}</p>
              <p className="text-mono text-xl font-bold text-sky-700">{totals.inQty}</p>
              <p className="text-mono text-[10px] text-wood-medium">{formatMoney(totals.inValue)}</p>
            </div>
            <div className="rounded-xl bg-wood-warm/10 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-wood-medium"><ArrowUpRight size={13} />{t('affectationsOut')}</p>
              <p className="text-mono text-xl font-bold text-wood-warm">{totals.outQty}</p>
              <p className="text-mono text-[10px] text-wood-medium">{formatMoney(totals.outValue)}</p>
            </div>
            <div className="rounded-xl bg-sage/10 p-3">
              <p className="text-[11px] text-wood-medium">{t('purchasePrice')}</p>
              <p className="text-mono text-lg font-bold text-sage">{formatMoney(product.purchasePrice)}</p>
              <p className="text-[10px] text-wood-medium">moy. {formatMoney(totals.avgPrice)}</p>
            </div>
          </div>

          {totals.byDep.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-wood-dark"><Building2 size={15} className="text-wood-warm" />{t('departments')}</h4>
              <div className="flex flex-wrap gap-2">
                {totals.byDep.map(([name, qty]) => (
                  <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-wood-warm/25 bg-wood-warm/5 px-3 py-1 text-xs font-semibold text-wood-dark">
                    {name} <b className="text-mono text-wood-warm">{qty}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="segmented">
            {([
              { k: 'all', l: `${t('all')} (${rows.length})` },
              { k: 'purchase', l: t('purchasesIn') },
              { k: 'affectation', l: t('affectationsOut') },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => setTab(o.k)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === o.k ? 'bg-white text-wood-warm shadow-wood' : 'text-wood-medium hover:text-wood-dark'}`}
              >
                {o.l}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <ol className="relative space-y-3 border-s-2 border-wood-light/30 ps-5">
              {shown.map((r, i) => {
                const isIn = r.kind === 'purchase'
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                    className="relative rounded-xl border border-wood-light/20 bg-white/80 px-3 py-2.5"
                  >
                    <span className={`absolute -start-[31px] top-3 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-white ${isIn ? 'bg-sky-500' : 'bg-wood-warm'}`}>
                      {isIn ? <ShoppingCart size={12} /> : <ClipboardList size={12} />}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={isIn ? 'info' : 'gold'}>{isIn ? t('purchase') : t('affectation')}</Badge>
                      <span className="text-mono text-xs font-semibold text-wood-dark">{r.reference}</span>
                      <span className="text-[11px] text-wood-medium">{format(new Date(r.date), 'dd/MM/yyyy HH:mm')}</span>
                      <span className={`text-mono ms-auto text-sm font-bold ${isIn ? 'text-sky-700' : 'text-wood-warm'}`}>
                        {isIn ? '+' : '−'}{r.quantity}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-wood-dark">
                        {isIn ? `${t('supplier')} : ` : `${t('department')} : `}
                        <b>{r.party}</b>
                      </span>
                      <span className="text-mono text-wood-medium">{r.quantity} × {formatMoney(r.unitPrice)} = <b className="text-wood-dark">{formatMoney(r.total)}</b></span>
                    </div>
                    {r.note && <p className="mt-1 text-[11px] text-wood-medium">{r.note}</p>}
                  </motion.li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </Modal>
  )
}
