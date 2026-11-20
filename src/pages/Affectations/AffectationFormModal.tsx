import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Building2,
  Check,
  ClipboardList,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  X,
  Package,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { PhoneScanModal, type ScanFeedItem } from '@/components/shared/PhoneScanModal'
import { beep } from '@/components/shared/CameraScanner'
import { usePhoneScan } from '@/lib/usePhoneScan'
import { useProductStore } from '@/store/useProductStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, round2, uid } from '@/utils/helpers'
import type { Affectation, AffectationLine, Product } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  /** The affectation being edited, or null to create one. */
  affectation: Affectation | null
}

const sameCode = (a: string | undefined, b: string) =>
  !!a && (a === b || a.replace(/^0+/, '') === b.replace(/^0+/, ''))

export const AffectationFormModal = ({ open, onClose, affectation }: Props) => {
  const { t } = useTranslation()
  const products = useProductStore((s) => s.products)
  const departments = useDepartmentStore((s) => s.departments)
  const { addAffectation, updateAffectation } = useAffectationStore()
  const currentUser = useAuthStore((s) => s.currentUser)

  const [departmentId, setDepartmentId] = useState('')
  const [depSearch, setDepSearch] = useState('')
  const [depOpen, setDepOpen] = useState(false)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [receivedBy, setReceivedBy] = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<AffectationLine[]>([])
  const [search, setSearch] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [feed, setFeed] = useState<ScanFeedItem[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDepartmentId(affectation?.departmentId ?? '')
    setDepSearch('')
    setDepOpen(false)
    setDate(format(affectation ? new Date(affectation.date) : new Date(), "yyyy-MM-dd'T'HH:mm"))
    setReceivedBy(affectation?.receivedBy ?? '')
    setDescription(affectation?.description ?? '')
    setNote('')
    setLines(affectation ? affectation.lines.map((l) => ({ ...l })) : [])
    setSearch('')
    setFeed([])
  }, [open, affectation])

  /** Stock available for this affectation: shelf + what it already holds when editing. */
  const availableOf = (productId: string) => {
    const shelf = products.find((p) => p.id === productId)?.quantity ?? 0
    const held = affectation?.lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0) ?? 0
    return shelf + held
  }

  const department = departments.find((d) => d.id === departmentId)
  const depResults = useMemo(() => {
    const q = depSearch.trim().toLowerCase()
    return departments.filter(
      (d) => !q || d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q) || (d.manager ?? '').toLowerCase().includes(q),
    )
  }, [departments, depSearch])

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8)
  }, [products, search])

  const addProduct = (product: Product, qty = 1): boolean => {
    const current = lines.find((l) => l.productId === product.id)?.quantity ?? 0
    if (current + qty > availableOf(product.id)) {
      toast.error(`${product.name} — ${t('insufficientStock')} (${t('available')}: ${availableOf(product.id)})`)
      return false
    }
    setLines((prev) =>
      prev.some((l) => l.productId === product.id)
        ? prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + qty } : l))
        : [
            ...prev,
            { productId: product.id, productName: product.name, barcode: product.barcode, quantity: qty, unitCost: product.purchasePrice },
          ],
    )
    return true
  }

  /** A barcode typed, scanned with a USB gun, the phone or this device's camera. */
  const handleBarcode = (raw: string, source: 'phone' | 'local') => {
    const code = raw.trim()
    if (!code) return
    const product = products.find((p) => sameCode(p.barcode, code) || sameCode(p.retailBarcode, code))
    setFeed((prev) =>
      [{ id: uid('scan'), barcode: code, label: product ? product.name : t('productNotFound'), found: !!product, source }, ...prev].slice(0, 20),
    )
    if (!product) {
      beep(false)
      toast.error(`${t('productNotFound')} · ${code}`)
      return
    }
    if (addProduct(product)) {
      beep(true)
      toast.success(`${t('productAdded')} — ${product.name}`, { duration: 1300 })
    } else beep(false)
  }

  const phone = usePhoneScan((code) => handleBarcode(code, 'phone'))
  useEffect(() => {
    if (!open && phone.status !== 'off') phone.stop()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const setQty = (productId: string, qty: number) => {
    const max = availableOf(productId)
    const next = Math.max(1, Math.min(max, Math.floor(qty) || 1))
    if (qty > max) toast.error(`${t('insufficientStock')} (${t('available')}: ${max})`)
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: next } : l)))
  }

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0)
  const totalValue = round2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0))

  const save = () => {
    if (!department) {
      toast.error(t('selectDepartment'))
      return
    }
    if (lines.length === 0) {
      toast.error(t('noItems'))
      return
    }
    for (const l of lines) {
      if (l.quantity > availableOf(l.productId)) {
        toast.error(`${l.productName} — ${t('insufficientStock')}`)
        return
      }
    }
    const by = currentUser?.fullName ?? '—'
    const payload = {
      departmentId: department.id,
      departmentName: department.name,
      lines,
      description: description.trim(),
      receivedBy: receivedBy.trim(),
      date: new Date(date).toISOString(),
    }
    if (affectation) updateAffectation(affectation.id, payload, by, note.trim())
    else addAffectation(payload, by)
    toast.success(t('saved'))
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={affectation ? `${t('editAffectation')} · ${affectation.reference}` : t('newAffectation')}
        icon={<ClipboardList size={20} />}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={save}><Check size={16} />{t('save')}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Department + information */}
          <div className="space-y-4 lg:col-span-2">
            <div className="relative">
              <label className="label-wood">{t('department')} *</label>
              {department && !depOpen ? (
                <button
                  type="button"
                  onClick={() => setDepOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-wood-warm/40 bg-wood-warm/5 px-3 py-2.5 text-start transition hover:bg-wood-warm/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wood-btn text-xs font-bold text-white">
                    {department.code || <Building2 size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-wood-dark">{department.name}</span>
                    <span className="block truncate text-[11px] text-wood-medium">{department.manager || department.description}</span>
                  </span>
                  <X size={16} className="text-wood-medium" />
                </button>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/60" />
                    <input
                      value={depSearch}
                      onChange={(e) => setDepSearch(e.target.value)}
                      onFocus={() => setDepOpen(true)}
                      placeholder={t('searchDepartment')}
                      className="input-wood ps-9"
                    />
                  </div>
                  <div className="mt-1 max-h-52 overflow-auto rounded-xl border border-wood-light/30 bg-white shadow-wood">
                    {depResults.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-wood-medium">{t('noDepartments')}</p>
                    ) : (
                      depResults.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setDepartmentId(d.id)
                            setDepOpen(false)
                            setDepSearch('')
                            if (!receivedBy && d.manager) setReceivedBy(d.manager)
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-wood-cream/60 ${d.id === departmentId ? 'bg-wood-cream/60' : ''}`}
                        >
                          <Building2 size={14} className="shrink-0 text-wood-warm" />
                          <span className="truncate font-medium text-wood-dark">{d.name}</span>
                          {d.code && <span className="ms-auto text-[10px] font-bold text-wood-medium">{d.code}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Input label={t('date')} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label={t('receivedBy')} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </div>
            <Textarea label={t('description')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            {affectation && (
              <Input label={t('modificationNote')} value={note} onChange={(e) => setNote(e.target.value)} />
            )}
          </div>

          {/* Products */}
          <div className="space-y-3 lg:col-span-3">
            <label className="label-wood">{t('itemsToAffect')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/60" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (results.length === 1) {
                        if (addProduct(results[0])) setSearch('')
                      } else if (search.trim()) {
                        handleBarcode(search, 'local')
                        setSearch('')
                      }
                    }
                  }}
                  placeholder={t('searchProductOrBarcode')}
                  className="input-wood ps-9"
                />
                <AnimatePresence>
                  {results.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-wood-light/30 bg-white shadow-xl"
                    >
                      {results.map((p) => {
                        const avail = availableOf(p.id) - (lines.find((l) => l.productId === p.id)?.quantity ?? 0)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={avail <= 0}
                            onClick={() => {
                              if (addProduct(p)) {
                                setSearch('')
                                searchRef.current?.focus()
                              }
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-wood-cream/60 disabled:opacity-40"
                          >
                            <Package size={16} className="shrink-0 text-wood-warm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-wood-dark">{p.name}</span>
                              <span className="text-mono block text-[10px] text-wood-medium">{p.barcode} · {p.category}</span>
                            </span>
                            <span className={`text-mono shrink-0 text-xs font-bold ${avail > 0 ? 'text-sage' : 'text-terracotta'}`}>
                              {avail} {t('available').toLowerCase()}
                            </span>
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Button variant="gold" onClick={() => setScanOpen(true)} title={t('scanWithPhone')}>
                <ScanBarcode size={18} />
                <span className="hidden sm:inline">{t('scanWithPhone')}</span>
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-wood-light/40 py-10 text-center">
                <ScanBarcode size={32} className="text-wood-light" />
                <p className="max-w-xs text-sm text-wood-medium">{t('noItems')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <motion.div
                      key={l.productId}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-wood-light/25 bg-white/80 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-wood-dark">{l.productName}</p>
                        <p className="text-mono text-[10px] text-wood-medium">
                          {l.barcode} · {t('available')}: {availableOf(l.productId)} · {formatMoney(l.unitCost)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setQty(l.productId, l.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-wood-cream text-wood-dark hover:bg-wood-light/30"><Minus size={14} /></button>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => setQty(l.productId, Number(e.target.value))}
                          className="input-wood text-mono h-8 w-16 px-1 py-0 text-center"
                        />
                        <button type="button" onClick={() => setQty(l.productId, l.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-wood-cream text-wood-dark hover:bg-wood-light/30"><Plus size={14} /></button>
                      </div>
                      <span className="text-mono w-28 text-end text-sm font-bold text-wood-dark">{formatMoney(l.quantity * l.unitCost)}</span>
                      <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))} className="rounded-lg p-1.5 text-terracotta hover:bg-terracotta/10"><Trash2 size={15} /></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-wood-btn px-4 py-3 text-white">
                  <span className="text-sm">{lines.length} {t('items').toLowerCase()} · {totalUnits} {t('units').toLowerCase()}</span>
                  <span className="text-mono text-lg font-bold">{formatMoney(totalValue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <PhoneScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        phone={phone}
        onLocalBarcode={(code) => handleBarcode(code, 'local')}
        feed={feed}
      />
    </>
  )
}
