import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Check,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  ClipboardList,
  Package,
  Coins,
  Hash,
} from 'lucide-react'
import { PageHeader, SearchInput, EmptyState, ViewToggle } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { useAffectationStore } from '@/store/useAffectationStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/i18n/useTranslation'
import { can, formatMoney, initials, round2 } from '@/utils/helpers'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Department } from '@/types'

type Form = Omit<Department, 'id' | 'createdAt'>
const emptyForm = (): Form => ({ name: '', description: '', code: '', manager: '', phone: '', email: '', location: '' })

export const DepartmentsPage = () => {
  const { t } = useTranslation()
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useDepartmentStore()
  const affectations = useAffectationStore((s) => s.affectations)
  const perms = useAuthStore((s) => s.currentUser?.permissions)

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [viewing, setViewing] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)

  const statsById = useMemo(() => {
    const map = new Map<string, { count: number; units: number; value: number; last: string | null }>()
    affectations.forEach((a) => {
      const cur = map.get(a.departmentId) ?? { count: 0, units: 0, value: 0, last: null }
      cur.count += 1
      cur.units += a.lines.reduce((s, l) => s + l.quantity, 0)
      cur.value = round2(cur.value + a.total)
      if (!cur.last || a.date > cur.last) cur.last = a.date
      map.set(a.departmentId, cur)
    })
    return map
  }, [affectations])
  const statsOf = (id: string) => statsById.get(id) ?? { count: 0, units: 0, value: 0, last: null }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return departments.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.code ?? '').toLowerCase().includes(q) ||
        (d.manager ?? '').toLowerCase().includes(q),
    )
  }, [departments, search])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
  }
  const openEdit = (d: Department) => {
    setEditing(d)
    setForm({
      name: d.name,
      description: d.description,
      code: d.code ?? '',
      manager: d.manager ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
      location: d.location ?? '',
    })
    setFormOpen(true)
  }
  const save = () => {
    if (!form.name.trim()) {
      toast.error(t('required'))
      return
    }
    const payload: Form = {
      name: form.name.trim(),
      description: form.description.trim(),
      code: form.code?.trim(),
      manager: form.manager?.trim(),
      phone: form.phone?.trim(),
      email: form.email?.trim(),
      location: form.location?.trim(),
    }
    if (editing) updateDepartment(editing.id, payload)
    else addDepartment(payload)
    toast.success(t('saved'))
    setFormOpen(false)
  }
  const confirmDelete = () => {
    if (!deleting) return
    if (statsOf(deleting.id).count > 0) {
      toast.error(t('departmentHasAffectations'))
      return
    }
    deleteDepartment(deleting.id)
    toast.success(t('deleted'))
  }

  const viewingAffectations = useMemo(
    () =>
      viewing
        ? affectations
            .filter((a) => a.departmentId === viewing.id)
            .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        : [],
    [viewing, affectations],
  )
  const viewingProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; value: number }>()
    viewingAffectations.forEach((a) =>
      a.lines.forEach((l) => {
        const cur = map.get(l.productId) ?? { name: l.productName, quantity: 0, value: 0 }
        cur.quantity += l.quantity
        cur.value = round2(cur.value + l.quantity * l.unitCost)
        map.set(l.productId, cur)
      }),
    )
    return [...map.values()].sort((a, b) => b.quantity - a.quantity)
  }, [viewingAffectations])

  const canCreate = can(perms, 'departments', 'create')
  const canEdit = can(perms, 'departments', 'edit')
  const canDelete = can(perms, 'departments', 'delete')

  const actions = (d: Department, compact = false) => (
    <div className={compact ? 'flex justify-center gap-1' : 'mt-4 flex gap-2 border-t border-wood-light/20 pt-3'}>
      <Button size="sm" variant="outline" className={compact ? '' : 'flex-1'} onClick={() => setViewing(d)} title={t('details')}>
        <Eye size={15} />
      </Button>
      {canEdit && (
        <Button size="sm" variant="outline" className={compact ? '' : 'flex-1'} onClick={() => openEdit(d)} title={t('edit')}>
          <Pencil size={15} />
        </Button>
      )}
      {canDelete && (
        <Button size="sm" variant="danger" className={compact ? '' : 'flex-1'} onClick={() => setDeleting(d)} title={t('delete')}>
          <Trash2 size={15} />
        </Button>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        title={t('departments')}
        subtitle={`${departments.length} ${t('departments').toLowerCase()} · ${t('departmentsSubtitle')}`}
        actions={
          canCreate && (
            <Button onClick={openNew}>
              <Plus size={18} />
              {t('newDepartment')}
            </Button>
          )
        }
      />

      <div className="card-wood mb-5 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} className="min-w-[220px] flex-1" />
        <ViewToggle view={view} onChange={setView} labels={{ cards: t('cardView'), table: t('tableView') }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('noDepartments')}
          hint={t('noDataHint')}
          icon={<Building2 size={40} />}
          action={canCreate && <Button onClick={openNew}><Plus size={18} />{t('newDepartment')}</Button>}
        />
      ) : view === 'cards' ? (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((d, i) => {
              const st = statsOf(d.id)
              return (
                <motion.div key={d.id} variants={cardVariants} custom={i} layout whileHover={{ y: -5 }} className="card-wood card-hover flex flex-col rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wood-btn text-sm font-bold text-white shadow-wood">
                      {d.code || initials(d.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-wood-dark">{d.name}</h3>
                      <p className="line-clamp-2 text-xs text-wood-medium">{d.description || '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-wood-medium">
                    {d.manager && <p className="flex items-center gap-1.5"><User size={13} />{d.manager}</p>}
                    {d.phone && <p className="flex items-center gap-1.5"><Phone size={13} />{d.phone}</p>}
                    {d.location && <p className="flex items-center gap-1.5"><MapPin size={13} />{d.location}</p>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-wood-cream/50 px-1 py-1.5">
                      <p className="text-[10px] text-wood-medium">{t('affectations')}</p>
                      <p className="text-mono text-sm font-bold text-wood-dark">{st.count}</p>
                    </div>
                    <div className="rounded-lg bg-wood-cream/50 px-1 py-1.5">
                      <p className="text-[10px] text-wood-medium">{t('units')}</p>
                      <p className="text-mono text-sm font-bold text-wood-dark">{st.units}</p>
                    </div>
                    <div className="rounded-lg bg-sage/10 px-1 py-1.5">
                      <p className="text-[10px] text-wood-medium">{t('value')}</p>
                      <p className="text-mono truncate text-sm font-bold text-sage">{formatMoney(st.value).replace(',00', '')}</p>
                    </div>
                  </div>
                  {actions(d)}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="card-wood overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-start">{t('departmentCode')}</th>
                  <th className="px-4 py-3 text-start">{t('name')}</th>
                  <th className="px-4 py-3 text-start">{t('manager')}</th>
                  <th className="px-4 py-3 text-center">{t('affectations')}</th>
                  <th className="px-4 py-3 text-end">{t('affectedValue')}</th>
                  <th className="px-4 py-3 text-start">{t('lastAffectation')}</th>
                  <th className="px-4 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const st = statsOf(d.id)
                  return (
                    <tr key={d.id} className="border-b border-wood-light/15 hover:bg-wood-cream/30">
                      <td className="px-4 py-2.5"><Badge tone="info">{d.code || '—'}</Badge></td>
                      <td className="px-4 py-2.5 font-medium text-wood-dark">{d.name}</td>
                      <td className="px-4 py-2.5 text-wood-medium">{d.manager || '—'}</td>
                      <td className="text-mono px-4 py-2.5 text-center">{st.count}</td>
                      <td className="text-mono px-4 py-2.5 text-end text-sage">{formatMoney(st.value)}</td>
                      <td className="px-4 py-2.5 text-wood-medium">{st.last ? format(new Date(st.last), 'dd/MM/yyyy') : '—'}</td>
                      <td className="px-4 py-2.5">{actions(d, true)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('editDepartment') : t('newDepartment')}
        icon={<Building2 size={20} />}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}><Check size={16} />{t('save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={`${t('name')} *`} autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <p className="border-t border-wood-light/20 pt-3 text-xs font-bold uppercase tracking-wide text-wood-medium">{t('optionalDetails')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('departmentCode')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex. DRH" />
            <Input label={t('manager')} value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
            <Input label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input label={t('location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
      </Modal>

      {/* Details */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        subtitle={viewing?.code ? `${t('departmentCode')} : ${viewing.code}` : undefined}
        icon={<Building2 size={20} />}
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <p className="text-sm text-wood-medium">{viewing.description || '—'}</p>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {[
                { icon: <Hash size={14} />, l: t('departmentCode'), v: viewing.code },
                { icon: <User size={14} />, l: t('manager'), v: viewing.manager },
                { icon: <Phone size={14} />, l: t('phone'), v: viewing.phone },
                { icon: <Mail size={14} />, l: t('email'), v: viewing.email },
                { icon: <MapPin size={14} />, l: t('location'), v: viewing.location },
                { icon: <ClipboardList size={14} />, l: t('date'), v: format(new Date(viewing.createdAt), 'dd/MM/yyyy') },
              ].map((r) => (
                <div key={r.l} className="flex items-center gap-2 rounded-lg bg-wood-cream/40 px-3 py-2">
                  <span className="text-wood-warm">{r.icon}</span>
                  <span className="text-xs text-wood-medium">{r.l}</span>
                  <span className="ms-auto truncate font-medium text-wood-dark">{r.v || '—'}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-wood-cream/50 p-3 text-center">
                <ClipboardList size={16} className="mx-auto text-wood-warm" />
                <p className="text-mono mt-1 text-lg font-bold">{statsOf(viewing.id).count}</p>
                <p className="text-[11px] text-wood-medium">{t('affectations')}</p>
              </div>
              <div className="rounded-xl bg-wood-cream/50 p-3 text-center">
                <Package size={16} className="mx-auto text-wood-warm" />
                <p className="text-mono mt-1 text-lg font-bold">{statsOf(viewing.id).units}</p>
                <p className="text-[11px] text-wood-medium">{t('units')}</p>
              </div>
              <div className="rounded-xl bg-sage/10 p-3 text-center">
                <Coins size={16} className="mx-auto text-sage" />
                <p className="text-mono mt-1 text-sm font-bold text-sage sm:text-lg">{formatMoney(statsOf(viewing.id).value)}</p>
                <p className="text-[11px] text-wood-medium">{t('affectedValue')}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-wood-dark">{t('mostAffected')}</h4>
              {viewingProducts.length === 0 ? (
                <p className="py-3 text-center text-sm text-wood-medium">{t('noAffectations')}</p>
              ) : (
                <div className="max-h-56 overflow-auto rounded-xl border border-wood-light/20">
                  <table className="w-full text-sm">
                    <thead className="table-head sticky top-0">
                      <tr><th className="px-3 py-2 text-start">{t('productName')}</th><th className="px-3 py-2 text-end">{t('quantity')}</th><th className="px-3 py-2 text-end">{t('value')}</th></tr>
                    </thead>
                    <tbody>
                      {viewingProducts.map((p) => (
                        <tr key={p.name} className="border-t border-wood-light/15">
                          <td className="px-3 py-2 font-medium text-wood-dark">{p.name}</td>
                          <td className="text-mono px-3 py-2 text-end">{p.quantity}</td>
                          <td className="text-mono px-3 py-2 text-end">{formatMoney(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-wood-dark">{t('affectationHistory')}</h4>
              {viewingAffectations.length === 0 ? (
                <p className="py-3 text-center text-sm text-wood-medium">{t('noAffectations')}</p>
              ) : (
                <div className="space-y-2">
                  {viewingAffectations.map((a) => (
                    <div key={a.id} className="rounded-xl border border-wood-light/20 bg-white/70 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{a.reference}</Badge>
                        <span className="text-xs text-wood-medium">{format(new Date(a.date), 'dd/MM/yyyy HH:mm')}</span>
                        <span className="text-mono ms-auto text-sm font-bold text-sage">{formatMoney(a.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-wood-medium">{a.description || '—'}</p>
                      <p className="mt-1 text-[11px] text-wood-dark">
                        {a.lines.map((l) => `${l.productName} × ${l.quantity}`).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  )
}
