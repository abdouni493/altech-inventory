import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useReactToPrint } from 'react-to-print'
import toast from 'react-hot-toast'
import {
  Plus,
  RefreshCw,
  Printer,
  Check,
  Boxes,
  Info,
  Coins,
  CalendarClock,
  PackageOpen,
  Package,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Barcode } from '@/components/shared/BarcodeGenerator'
import { useProductStore } from '@/store/useProductStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, generateEAN13, round2 } from '@/utils/helpers'
import { clsx } from '@/utils/clsx'
import type { Product } from '@/types'

// Creating a product captures its identity and its stock: purchase price,
// alert threshold and expiration are filled in by the first purchase.
// Editing unlocks every field.
//
// Detail stock: a box of 20 pieces is stocked as boxes and can also be handed
// out piece by piece. The box is the stock unit, the piece the detail unit,
// `capacity` the number of pieces per box and `openRemaining` the pieces left
// in the box already opened.
const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().min(1),
  category: z.string().min(1),
  stockUnit: z.string().optional(),
  quantity: z.coerce.number().min(0),
  openRemaining: z.coerce.number().min(0).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  minQuantity: z.coerce.number().min(0).optional(),
  hasExpiration: z.boolean().optional(),
  expirationDate: z.string().optional(),
  isDivisible: z.boolean().optional(),
  unit: z.string().optional(),
  capacity: z.coerce.number().min(0).optional(),
  retailStep: z.coerce.number().min(0).optional(),
  retailBarcode: z.string().optional(),
})
type FormData = z.infer<typeof schema>

/** Units every shop needs — the lists grow with whatever the user creates. */
const DEFAULT_STOCK_UNITS = ['boîte', 'paquet', 'flacon', 'carton', 'pièce', 'sachet', 'tube', 'bouteille']
const DEFAULT_DETAIL_UNITS = ['pièce', 'ml', 'L', 'g', 'kg', 'm', 'cm']

/** A select whose list can be extended in place with the "+" button. */
const SelectCreate = ({
  label,
  value,
  options,
  onChange,
  onCreate,
  placeholder,
  emptyLabel,
  error,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  onCreate: (v: string) => void
  placeholder: string
  emptyLabel?: string
  error?: string
}) => {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const confirm = () => {
    const name = draft.trim()
    if (!name) return
    onCreate(name)
    onChange(name)
    setDraft('')
    setAdding(false)
  }
  return (
    <div>
      <label className="label-wood">{label}</label>
      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirm()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setAdding(false)
              }
            }}
            placeholder={placeholder}
            className="input-wood"
          />
          <Button type="button" size="icon" onClick={confirm} title="Entrée">
            <Check size={17} />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => setAdding(false)}>
            <X size={17} />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx('input-wood cursor-pointer', error && 'border-terracotta')}>
            {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="icon" onClick={() => setAdding(true)} title={placeholder}>
            <Plus size={17} />
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </div>
  )
}

/** iOS-like switch bound to a react-hook-form checkbox. */
const Toggle = ({ input, label, icon }: { input: React.InputHTMLAttributes<HTMLInputElement>; label: string; icon: React.ReactNode }) => (
  <label className="flex cursor-pointer select-none items-center gap-2.5">
    <span className="relative inline-flex">
      <input type="checkbox" className="peer sr-only" {...input} />
      <span className="h-6 w-11 rounded-full bg-[#D5DBE8] transition peer-checked:bg-wood-warm" />
      <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
    </span>
    <span className="flex items-center gap-1.5 text-sm font-bold text-wood-dark">
      {icon}
      {label}
    </span>
  </label>
)

interface ProductModalProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  onSaved?: (product: Product) => void
  presetName?: string
}

export const ProductModal = ({ open, onClose, product, onSaved, presetName }: ProductModalProps) => {
  const { t } = useTranslation()
  const { brands, categories, units, addProduct, updateProduct, addBrand, addCategory, addUnit } =
    useProductStore()
  const printRef = useRef<HTMLDivElement>(null)

  const stockUnitOptions = [...new Set([...DEFAULT_STOCK_UNITS, ...units])]
  const detailUnitOptions = [...new Set([...DEFAULT_DETAIL_UNITS, ...units])]

  const emptyValues = (): FormData => ({
    name: presetName ?? '',
    description: '',
    barcode: '', // empty by default — generate on demand
    brand: brands[0] ?? '',
    category: categories[0] ?? '',
    stockUnit: '',
    quantity: 0,
    openRemaining: 0,
    purchasePrice: 0,
    minQuantity: 0,
    hasExpiration: false,
    expirationDate: '',
    isDivisible: false,
    unit: 'pièce',
    capacity: 0,
    retailStep: 1,
    retailBarcode: '',
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: emptyValues() })

  useEffect(() => {
    if (!open) return
    if (product) {
      const step = product.retailStep && product.retailStep > 0 ? product.retailStep : 1
      reset({
        name: product.name,
        description: product.description ?? '',
        barcode: product.barcode ?? '',
        brand: product.brand,
        category: product.category,
        stockUnit: product.stockUnit ?? '',
        quantity: product.quantity,
        openRemaining: product.openRemaining ?? 0,
        purchasePrice: product.purchasePrice ?? 0,
        minQuantity: product.minQuantity ?? 0,
        hasExpiration: !!product.hasExpiration,
        expirationDate: (product.expirationDate ?? '').slice(0, 10),
        isDivisible: !!product.isDivisible,
        unit: product.unit || 'pièce',
        capacity: product.capacity ?? 0,
        retailStep: step,
        retailBarcode: product.retailBarcode ?? '',
      })
    } else {
      reset(emptyValues())
    }
  }, [open, product, presetName]) // eslint-disable-line react-hooks/exhaustive-deps

  const barcode = watch('barcode')
  const isDivisible = watch('isDivisible')
  const hasExpiration = watch('hasExpiration')
  const stockUnit = watch('stockUnit') ?? ''
  const unit = watch('unit') ?? ''
  const quantity = Number(watch('quantity') ?? 0)
  const openRemaining = Number(watch('openRemaining') ?? 0)
  const capacity = Number(watch('capacity') ?? 0)
  const purchasePrice = Number(watch('purchasePrice') ?? product?.purchasePrice ?? 0)

  const boxName = stockUnit || t('unitWord')
  const totalPieces = round2(quantity * capacity + openRemaining)
  const costPerPiece = capacity > 0 ? round2(purchasePrice / capacity) : 0

  const handlePrint = useReactToPrint({ content: () => printRef.current })

  const retailFields = (data: FormData) => {
    const step = data.retailStep && data.retailStep > 0 ? data.retailStep : 1
    return {
      isDivisible: !!data.isDivisible,
      unit: data.isDivisible ? (data.unit ?? '') : '',
      capacity: data.isDivisible ? (data.capacity ?? 0) : 0,
      retailStep: data.isDivisible ? step : 0,
      openRemaining: data.isDivisible ? (data.openRemaining ?? 0) : 0,
      retailBarcode: data.isDivisible ? (data.retailBarcode ?? '').trim() : '',
    }
  }

  const onSubmit = (data: FormData) => {
    if (data.isDivisible) {
      if ((data.capacity ?? 0) <= 0) {
        toast.error(`${t('piecesPerBox')} — ${t('required')}`)
        return
      }
      if ((data.openRemaining ?? 0) >= (data.capacity ?? 0)) {
        toast.error(t('loosePiecesTooMany'))
        return
      }
    }
    const identity = {
      name: data.name.trim(),
      description: data.description ?? '',
      barcode: (data.barcode ?? '').trim(),
      brand: data.brand,
      category: data.category,
      stockUnit: (data.stockUnit ?? '').trim(),
      quantity: data.quantity,
      ...retailFields(data),
    }
    if (product) {
      const patch = {
        ...identity,
        purchasePrice: data.purchasePrice ?? 0,
        minQuantity: data.minQuantity ?? 0,
        hasExpiration: !!data.hasExpiration,
        expirationDate: data.hasExpiration ? data.expirationDate || undefined : undefined,
      }
      updateProduct(product.id, patch)
      toast.success(t('saved'))
      onSaved?.({ ...product, ...patch })
    } else {
      // Prices, alert threshold and expiration arrive with the first purchase.
      const created = addProduct({
        ...identity,
        purchasePrice: 0,
        minQuantity: 0,
        hasExpiration: false,
        expirationDate: undefined,
      })
      toast.success(t('saved'))
      onSaved?.(created)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? t('editProduct') : t('newProduct')}
      subtitle={product ? product.name : t('newProductSubtitle')}
      icon={<Package size={20} />}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit(onSubmit)} kbd="Ctrl+↵">
            <Check size={16} />
            {t('save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSubmit(onSubmit)()
          }
        }}
        className="space-y-5"
      >
        {/* 1 — identity */}
        <section className="space-y-4">
          <Input label={t('productName')} autoFocus {...register('name')} error={errors.name && t('required')} />
          <Textarea label={t('description')} {...register('description')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectCreate
              label={t('brand')}
              value={watch('brand')}
              options={brands}
              onChange={(v) => setValue('brand', v, { shouldValidate: true })}
              onCreate={addBrand}
              placeholder={t('newBrand')}
              error={errors.brand && t('required')}
            />
            <SelectCreate
              label={t('category')}
              value={watch('category')}
              options={categories}
              onChange={(v) => setValue('category', v, { shouldValidate: true })}
              onCreate={addCategory}
              placeholder={t('newCategory')}
              error={errors.category && t('required')}
            />
            <SelectCreate
              label={`${t('stockUnitLabel')} (${t('optional')})`}
              value={stockUnit}
              options={stockUnitOptions}
              onChange={(v) => setValue('stockUnit', v)}
              onCreate={addUnit}
              placeholder={t('newUnit')}
              emptyLabel={`— ${t('unitWord')} —`}
            />
          </div>
        </section>

        {/* 2 — detail stock (boxes of pieces) */}
        <section
          className={clsx(
            'rounded-xl border p-4 transition-colors',
            isDivisible ? 'border-wood-warm/40 bg-wood-warm/[0.04]' : 'border-woodborder bg-[#F8FAFD]',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Toggle input={register('isDivisible')} label={t('enableDetailSelling')} icon={<PackageOpen size={16} className="text-wood-warm" />} />
            <span className="text-xs text-wood-medium">{t('detailSellingExample')}</span>
          </div>

          {isDivisible && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectCreate
                  label={`1. ${t('detailUnit')}`}
                  value={unit}
                  options={detailUnitOptions}
                  onChange={(v) => setValue('unit', v)}
                  onCreate={addUnit}
                  placeholder={t('newUnit')}
                />
                <div>
                  <label className="label-wood">{`2. ${t('piecesPerBox').replace('{box}', boxName).replace('{unit}', unit)}`}</label>
                  <input type="number" min={0} step="any" className="input-wood text-mono" {...register('capacity')} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-wood">{`${t('defaultPortion')} (${unit})`}</label>
                  <input type="number" min={0} step="any" className="input-wood text-mono" {...register('retailStep')} />
                  <p className="mt-1 text-xs text-wood-medium/80">{t('defaultPortionHint')}</p>
                </div>
                <Input
                  label={`${t('detailBarcode')} (${t('optional')})`}
                  className="font-mono"
                  {...register('retailBarcode')}
                  hint={t('detailBarcodeHint')}
                />
              </div>

              {/* Live summary */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-woodborder bg-white p-2.5">
                  <p className="text-[11px] font-semibold text-wood-medium">{`1 ${boxName}`}</p>
                  <p className="text-mono text-sm font-bold text-wood-dark">{`${capacity || 0} ${unit}`}</p>
                </div>
                <div className="rounded-lg border border-woodborder bg-white p-2.5">
                  <p className="text-[11px] font-semibold text-wood-medium">{`${t('costPerUnit')} ${unit}`}</p>
                  <p className="text-mono text-sm font-bold text-wood-warm">{formatMoney(costPerPiece)}</p>
                </div>
                <div className="rounded-lg border border-woodborder bg-white p-2.5">
                  <p className="text-[11px] font-semibold text-wood-medium">{t('totalPieces').replace('{unit}', unit)}</p>
                  <p className="text-mono text-sm font-bold text-wood-dark">{totalPieces}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3 — stock (and, when editing, prices / alert / expiry) */}
        <section className="rounded-xl border border-woodborder p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-wood-dark">
            <Boxes size={16} className="text-wood-warm" />
            {product ? t('stockAndPricing') : t('currentStock')}
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-wood">{`${t('currentStock')} (${isDivisible ? t('sealedWord') + ' ' : ''}${stockUnit || t('unitWord')})`}</label>
              <input type="number" min={0} className="input-wood text-mono" {...register('quantity')} />
            </div>
            {isDivisible && (
              <div>
                <label className="label-wood">{t('loosePieces').replace('{unit}', unit)}</label>
                <input type="number" min={0} step="any" className="input-wood text-mono" {...register('openRemaining')} />
                <p className="mt-1 text-xs text-wood-medium/80">{t('loosePiecesHint').replace('{box}', boxName)}</p>
              </div>
            )}

            {product && (
              <>
                <div>
                  <label className="label-wood">{t('minQuantity')}</label>
                  <input type="number" min={0} className="input-wood text-mono" {...register('minQuantity')} />
                </div>
                <div>
                  <label className="label-wood flex items-center gap-1.5">
                    <Coins size={14} className="text-wood-warm" />
                    {`${t('purchasePrice')} — 1 ${boxName} (DA)`}
                  </label>
                  <input type="number" min={0} step="0.01" className="input-wood text-mono" {...register('purchasePrice')} />
                </div>
              </>
            )}
          </div>

          {isDivisible && capacity > 0 && (
            <p className="mt-3 rounded-lg bg-wood-cream/60 px-3 py-2 text-xs text-wood-medium">
              {t('stockReadsAs')}{' '}
              <b className="text-wood-dark">
                {quantity} {boxName}
                {openRemaining > 0 && ` + ${openRemaining} ${unit}`}
              </b>{' '}
              = <b className="text-mono text-wood-dark">{totalPieces} {unit}</b>
            </p>
          )}

          {product && (
            <div className="mt-4 space-y-2">
              <Toggle input={register('hasExpiration')} label={t('enableExpiration')} icon={<CalendarClock size={15} className="text-wood-warm" />} />
              {hasExpiration && (
                <div className="sm:max-w-[50%]">
                  <label className="label-wood">{t('expirationDate')}</label>
                  <input type="date" className="input-wood" {...register('expirationDate')} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4 — barcode (optional) */}
        <section className="rounded-xl border border-woodborder bg-[#F8FAFD] p-4">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-[200px] flex-1">
              <Input label={`${t('barcode')} (${t('optional')})`} className="font-mono" {...register('barcode')} />
            </div>
            <Button type="button" variant="outline" onClick={() => setValue('barcode', generateEAN13())}>
              <RefreshCw size={15} />
              {t('generateBarcode')}
            </Button>
            <Button type="button" variant="gold" onClick={handlePrint} disabled={!barcode}>
              <Printer size={15} />
              {t('printBarcode')}
            </Button>
          </div>
          {barcode ? (
            <div className="mt-3 flex justify-center rounded-lg border border-woodborder bg-white p-2">
              <Barcode value={barcode} />
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-wood-medium/80">
              <Info size={13} /> {t('barcodeOptionalHint')}
            </p>
          )}
          <div className="hidden">
            <div ref={printRef} className="print-area flex flex-col items-center p-6">
              <p className="mb-2 text-center text-lg font-bold">{watch('name')}</p>
              {barcode && <Barcode value={barcode} height={80} />}
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-lg border border-wood-warm/20 bg-wood-warm/5 px-3.5 py-3 text-xs text-wood-medium">
          <Info size={15} className="mt-0.5 shrink-0 text-wood-warm" />
          <span>{product ? t('editProductHint') : t('pricingLaterHint')}</span>
        </div>
      </form>
    </Modal>
  )
}
