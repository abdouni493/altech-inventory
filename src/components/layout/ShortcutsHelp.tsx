import { Keyboard } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { NAV_ITEMS } from './navConfig'
import { useTranslation } from '@/i18n/useTranslation'

const Row = ({ keys, label }: { keys: string[]; label: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 odd:bg-wood-cream/50">
    <span className="text-sm text-wood-dark">{label}</span>
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="kbd">
          {k}
        </kbd>
      ))}
    </span>
  </div>
)

export const ShortcutsHelp = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('keyboardShortcuts')} subtitle={t('keyboardShortcutsHint')} icon={<Keyboard size={20} />} size="lg">
      <div className="grid grid-cols-1 gap-5">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-wood-medium">{t('navigation')}</h4>
          <Row keys={['F1']} label={t('keyboardShortcuts')} />
          <Row keys={['Alt', 'M']} label={t('menu')} />
          {NAV_ITEMS.map((i) => (
            <Row key={i.key} keys={['Alt', i.hotkey]} label={t(i.labelKey)} />
          ))}
        </div>
      </div>
    </Modal>
  )
}
