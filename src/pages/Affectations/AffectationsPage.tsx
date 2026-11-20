import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import { useReactToPrint } from 'react-to-print'
import toast from 'react-hot-toast'
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  ClipboardList,
  Building2,
  Package,
  Coins,
  CalendarDays,
  Printer,
  History,
  User,
  FilePlus2,
  FilePen,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeader, SearchInput, EmptyState } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatCard } from '@/components/ui/StatCard'
import { AffectationFormModal } from './AffectationFormModal'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useProductStore } from '@/store/useProductStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/i18n/useTranslation'
import { can, formatMoney, round2 } from '@/utils/helpers'
import { staggerContainer } from '@/utils/animations'
import type { Affectation } from '@/types'

export const AffectationsPage = () => {
  const { t } = useTranslation()
  const { affectations, deleteAffectation } = useAffectationStore()
  const departments = useDepartmentStore((s) => s.departments)
  const products = useProductStore((s) => s.products)
  const settings = useSettingsStore((s) => s.settings)
  const perms = useAuthStore((s) => s.currentUser?.permissions)

  const [search, setSearch] = useState('')
  const [depFilter, setDepFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Affectation | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Affectation | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ content: () => printRef.current })

  const viewing = affectations.find((a) => a.id === viewingId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const start = from ? new Date(from) : null
    const end = to ? new Date(`${to}T23:59:59`) : null
    return affectations
      .filter((a) => {
        const d = new Date(a.date)
        if (start && d < start) return false
        if (end && d > end) return false
        if (depFilter && a.departmentId !== depFilter) return false
        if (!q) return true
        return (
          a.reference.toLowerCase().includes(q) ||
          a.departmentName.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.receivedBy ?? '').toLowerCase().includes(q) ||
          a.lines.some((l) => l.productName.toLowerCase().includes(q) || l.barcode.includes(q))
        )
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }, [affectations, search, depFilter, from, to])

  const stats = useMemo(() => {
    const ms = startOfMonth(new Date())
    const me = endOfMonth(new Date())
    const month = affectations.filter((a) => {
      const d = new Date(a.date)
      return d >= ms && d <= me
    })
    return {
      total: affectations.length,
      month: month.length,
      units: affectations.reduce((s, a) => s + a.lines.reduce((x, l) => x + l.quantity, 0), 0),
      value: round2(affectations.reduce((s, a) => s + a.total, 0)),
      monthValue: round2(month.reduce((s, a) => s + a.total, 0)),
      filteredValue: round2(filtered.reduce((s, a) => s + a.total, 0)),
    }
  }, [affectations, filtered])

  const canCreate = can(perms, 'affectations', 'create')
  const canEdit = can(perms, 'affectations', 'edit')
  const canDelete = can(perms, 'affectations', 'delete')

  const openNew = () => {
    if (departments.length === 0) {
      toast.error(t('noDepartments'))
      return
    }
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: Affectation) => {
    setEditing(a)
    setFormOpen(true)
  }

  const units = (a: Affectation) => a.lines.reduce((s, l) => s + l.quantity, 0)

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <PageHeader
        title={t('affectations')}
        subtitle={t('affectationsSubtitle')}
        actions={
          canCreate && (
            <Button onClick={openNew}>
              <Plus size={18} />
              {t('newAffectation')}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon={<ClipboardList size={22} />} label={t('affectations')} value={stats.total} accent="from-wood-warm to-gold" />
        <StatCard index={1} icon={<CalendarDays size={22} />} label={t('affectationsMonth')} value={stats.month} accent="from-sky-500 to-indigo-600" hint={formatMoney(stats.monthValue)} />
        <StatCard index={2} icon={<Package size={22} />} label={t('units')} value={stats.units} accent="from-wood-medium to-wood-light" />
        <StatCard index={3} icon={<Coins size={22} />} label={t('affectedValue')} value={stats.value} suffix="DA" decimals accent="from-sage to-emerald-500" />
      </div>

      {/* Filters */}
      <div className="card-wood mt-5 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}… (${t('reference')}, ${t('productName').toLowerCase()}, ${t('department').toLowerCase()})`} className="min-w-[220px] flex-1" />
        <Select value={depFilter} onChange={(e) => setDepFilter(e.target.value)} className="max-w-[220px]">
          <option value="">{t('all')} — {t('departments')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-wood-medium">{t('from')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-wood py-1.5" />
          <span className="text-xs text-wood-medium">{t('to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-wood py-1.5" />
        </div>
      </div>

      {/* History */}
      <div className="card-wood mt-5 rounded-xl p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <History size={18} className="text-wood-warm" />
          <h3 className="text-display text-lg font-bold text-wood-dark">{t('affectationHistory')}</h3>
          <Badge tone="info" className="ms-auto">{filtered.length} · {formatMoney(stats.filteredValue)}</Badge>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={t('noAffectations')}
            hint={t('noAffectationsHint')}
            icon={<ClipboardList size={40} />}
            action={canCreate && <Button onClick={openNew}><Plus size={18} />{t('newAffectation')}</Button>}
          />
        ) : (
          <>
            {/* Table — PC */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-3 text-start">{t('reference')}</th>
                    <th className="px-3 py-3 text-start">{t('date')}</th>
                    <th className="px-3 py-3 text-start">{t('department')}</th>
                    <th className="px-3 py-3 text-start">{t('items')}</th>
                    <th className="px-3 py-3 text-center">{t('units')}</th>
                    <th className="px-3 py-3 text-end">{t('value')}</th>
                    <th className="px-3 py-3 text-center">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: Math.min(i, 12) * 0.025 } }}
                      className="border-b border-wood-light/15 hover:bg-wood-cream/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5"><Badge tone="info">{a.reference}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-wood-medium">{format(new Date(a.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-wood-dark">{a.departmentName}</p>
                        <p className="max-w-[260px] truncate text-[11px] text-wood-medium">{a.description || '—'}</p>
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5 text-xs text-wood-medium">
                        <span className="line-clamp-2">{a.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ')}</span>
                      </td>
                      <td className="text-mono px-3 py-2.5 text-center font-bold">{units(a)}</td>
                      <td className="text-mono whitespace-nowrap px-3 py-2.5 text-end font-bold text-sage">{formatMoney(a.total)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewingId(a.id)} title={t('details')} className="rounded-lg p-1.5 text-wood-medium hover:bg-wood-cream"><Eye size={16} /></button>
                          {canEdit && <button onClick={() => openEdit(a)} title={t('edit')} className="rounded-lg p-1.5 text-wood-warm hover:bg-wood-cream"><Pencil size={16} /></button>}
                          {canDelete && <button onClick={() => setDeleting(a)} title={t('delete')} className="rounded-lg p-1.5 text-terracotta hover:bg-terracotta/10"><Trash2 size={16} /></button>}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards — phone */}
            <div className="space-y-3 md:hidden">
              <AnimatePresence initial={false}>
                {filtered.map((a) => (
                  <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-wood-light/25 bg-white/80 p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{a.reference}</Badge>
                      <span className="text-[11px] text-wood-medium">{format(new Date(a.date), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 font-semibold text-wood-dark"><Building2 size={14} className="text-wood-warm" />{a.departmentName}</p>
                    <p className="mt-0.5 text-xs text-wood-medium">{a.description || '—'}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-wood-medium">{a.lines.length} {t('items').toLowerCase()} · {units(a)} {t('units').toLowerCase()}</span>
                      <span className="text-mono font-bold text-sage">{formatMoney(a.total)}</span>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-wood-light/20 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewingId(a.id)}><Eye size={15} /></Button>
                      {canEdit && <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(a)}><Pencil size={15} /></Button>}
                      {canDelete && <Button size="sm" variant="danger" className="flex-1" onClick={() => setDeleting(a)}><Trash2 size={15} /></Button>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <AffectationFormModal open={formOpen} onClose={() => setFormOpen(false)} affectation={editing} />

      {/* Details + history */}
      <Modal
        open={!!viewing}
        onClose={() => setViewingId(null)}
        title={viewing ? `${t('affectationDetails')} · ${viewing.reference}` : ''}
        subtitle={viewing ? format(new Date(viewing.date), 'EEEE dd MMMM yyyy · HH:mm', { locale: frLocale }) : undefined}
        icon={<ClipboardList size={20} />}
        size="lg"
        footer={
          viewing && (
            <>
              {canEdit && (
                <Button variant="outline" onClick={() => { const a = viewing; setViewingId(null); openEdit(a) }}>
                  <Pencil size={16} />{t('edit')}
                </Button>
              )}
              <Button variant="gold" onClick={handlePrint}><Printer size={16} />{t('print')}</Button>
            </>
          )
        }
      >
        {viewing && (
          <div ref={printRef} className="print-area space-y-5">
            <div className="hidden print:block">
              <h1 className="text-display text-xl font-bold">{settings.name || t('appName')}</h1>
              <p className="text-sm">{t('affectation')} {viewing.reference} — {format(new Date(viewing.date), 'dd/MM/yyyy HH:mm')}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-wood-cream/40 p-3">
                <p className="flex items-center gap-1.5 text-xs text-wood-medium"><Building2 size={13} />{t('department')}</p>
                <p className="mt-0.5 font-bold text-wood-dark">{viewing.departmentName}</p>
                {(() => {
                  const d = departments.find((x) => x.id === viewing.departmentId)
                  return d ? <p className="text-[11px] text-wood-medium">{[d.code, d.manager, d.location].filter(Boolean).join(' · ')}</p> : null
                })()}
              </div>
              <div className="rounded-xl bg-wood-cream/40 p-3">
                <p className="flex items-center gap-1.5 text-xs text-wood-medium"><User size={13} />{t('receivedBy')}</p>
                <p className="mt-0.5 font-bold text-wood-dark">{viewing.receivedBy || '—'}</p>
                <p className="text-[11px] text-wood-medium">{t('created')} {t('by')} {viewing.createdBy || '—'}</p>
              </div>
            </div>
            <div className="rounded-xl bg-wood-cream/40 p-3">
              <p className="text-xs text-wood-medium">{t('description')}</p>
              <p className="mt-0.5 text-sm text-wood-dark">{viewing.description || '—'}</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-wood-light/20">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-2 text-start">{t('productName')}</th>
                    <th className="px-3 py-2 text-start">{t('barcode')}</th>
                    <th className="px-3 py-2 text-end">{t('quantity')}</th>
                    <th className="px-3 py-2 text-end">{t('unitPrice')}</th>
                    <th className="px-3 py-2 text-end">{t('total')}</th>
                    <th className="px-3 py-2 text-end print:hidden">{t('inStock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.lines.map((l) => (
                    <tr key={l.productId} className="border-t border-wood-light/15">
                      <td className="px-3 py-2 font-medium text-wood-dark">{l.productName}</td>
                      <td className="text-mono px-3 py-2 text-xs text-wood-medium">{l.barcode}</td>
                      <td className="text-mono px-3 py-2 text-end font-bold">{l.quantity}</td>
                      <td className="text-mono px-3 py-2 text-end">{formatMoney(l.unitCost)}</td>
                      <td className="text-mono px-3 py-2 text-end">{formatMoney(l.quantity * l.unitCost)}</td>
                      <td className="text-mono px-3 py-2 text-end text-wood-medium print:hidden">{products.find((p) => p.id === l.productId)?.quantity ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-wood-light/40 font-bold">
                    <td className="px-3 py-2" colSpan={2}>{t('total')}</td>
                    <td className="text-mono px-3 py-2 text-end">{units(viewing)}</td>
                    <td />
                    <td className="text-mono px-3 py-2 text-end text-sage">{formatMoney(viewing.total)}</td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures (print) */}
            <div className="hidden grid-cols-2 gap-6 pt-8 text-sm print:grid">
              <div className="border-t border-black pt-1">{t('workers')} — magasin</div>
              <div className="border-t border-black pt-1">{t('receivedBy')} : {viewing.receivedBy}</div>
            </div>

            {/* History timeline */}
            <div className="print:hidden">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-wood-dark"><History size={16} className="text-wood-warm" />{t('timeline')}</h4>
              <ol className="relative space-y-3 border-s-2 border-wood-light/30 ps-5">
                {[...(viewing.history ?? [])]
                  .sort((a, b) => +new Date(b.date) - +new Date(a.date))
                  .map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className={`absolute -start-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-white ${ev.type === 'created' ? 'bg-sage' : 'bg-wood-warm'}`}>
                        {ev.type === 'created' ? <FilePlus2 size={12} /> : <FilePen size={12} />}
                      </span>
                      <p className="text-sm font-semibold text-wood-dark">
                        {ev.type === 'created' ? t('created') : t('updated')}
                        <span className="font-normal text-wood-medium"> · {t('by')} {ev.by}</span>
                      </p>
                      <p className="text-[11px] text-wood-medium">{format(new Date(ev.date), 'dd/MM/yyyy HH:mm')}</p>
                      {ev.note && <p className="mt-0.5 text-xs text-wood-dark">{ev.note}</p>}
                    </li>
                  ))}
                <li className="relative">
                  <span className="absolute -start-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white ring-4 ring-white"><ArrowUpRight size={12} /></span>
                  <p className="text-sm font-semibold text-wood-dark">{t('affectationsOut')}</p>
                  <p className="text-xs text-wood-medium">
                    {viewing.lines.length} {t('items').toLowerCase()} · {units(viewing)} {t('units').toLowerCase()} → {viewing.departmentName}
                  </p>
                </li>
              </ol>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteAffectation(deleting.id)
            toast.success(t('deleted'))
          }
        }}
      />
    </motion.div>
  )
}
