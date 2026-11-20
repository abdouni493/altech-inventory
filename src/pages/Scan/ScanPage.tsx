import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Gem,
  Keyboard,
  Loader2,
  Play,
  ScanBarcode,
  Square,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { CameraScanner, beep, vibrate } from '@/components/shared/CameraScanner'
import { Button } from '@/components/ui/Button'
import { fetchScanSessionInfo, pushScan, type ScanSessionInfo } from '@/lib/scanSession'
import { formatMoney } from '@/utils/helpers'

interface Entry {
  key: string
  barcode: string
  label: string
  stock?: number
  found: boolean
}

/**
 * Phone page — opened by flashing the QR code shown on the POS screen.
 * No account needed: the session id in the URL is the pairing secret and every
 * write goes through the SECURITY DEFINER function push_scan().
 */
export const ScanPage = () => {
  const { sessionId = '' } = useParams()
  const [info, setInfo] = useState<ScanSessionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [flash, setFlash] = useState<'ok' | 'ko' | null>(null)
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    let alive = true
    fetchScanSessionInfo(sessionId)
      .then((res) => alive && setInfo(res))
      .catch(() => alive && setInfo({ valid: false }))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [sessionId])

  const send = useCallback(
    async (barcode: string) => {
      const key = `${barcode}-${Date.now()}`
      try {
        const res = await pushScan(sessionId, barcode)
        if (!res.ok) {
          setInfo({ valid: false })
          return
        }
        setFlash(res.found ? 'ok' : 'ko')
        beep(res.found)
        vibrate(res.found ? 45 : [40, 60, 40])
        window.setTimeout(() => setFlash(null), 450)
        setEntries((prev) =>
          [
            {
              key,
              barcode,
              label: res.product?.name ?? 'Produit introuvable',
              stock: res.product?.quantity,
              found: res.found,
            },
            ...prev,
          ].slice(0, 30),
        )
      } catch {
        setEntries((prev) =>
          [{ key, barcode, label: 'Envoi impossible — réseau', found: false }, ...prev].slice(0, 30),
        )
      }
    },
    [sessionId],
  )

  const submitManual = () => {
    const code = manual.trim()
    if (!code) return
    send(code)
    setManual('')
  }

  return (
    <div className="wood-grain relative min-h-screen bg-wood-sidebar px-4 pb-8 pt-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-wood-light/20 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-shine shadow-gold">
            <Gem size={22} className="text-wood-dark" />
          </div>
          <div>
            <h1 className="text-display text-xl font-bold text-white">
              {info?.shop || 'Belle Cosmétiques'}
            </h1>
            <p className="text-xs text-wood-blonde/80">Scanner mobile · Caisse</p>
          </div>
        </div>

        {loading ? (
          <div className="glass flex items-center justify-center gap-2 rounded-3xl p-10 text-white">
            <Loader2 className="animate-spin" size={20} />
            Connexion…
          </div>
        ) : !info?.valid ? (
          <div className="glass rounded-3xl p-8 text-center text-white">
            <TriangleAlert className="mx-auto mb-3 text-gold-light" size={34} />
            <p className="font-semibold">Session de scan expirée</p>
            <p className="mt-1 text-sm text-white/70">
              Retournez sur la caisse, rouvrez « Scanner avec mon téléphone » et flashez le nouveau QR
              code.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Camera */}
            <div className="glass overflow-hidden rounded-3xl p-3">
              <div className="relative">
                <CameraScanner
                  active={scanning}
                  onDetect={send}
                  className="h-64 w-full"
                  hint="Cadrez le code-barres"
                />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-charcoal/80 text-white">
                    <ScanBarcode size={34} className="text-gold-light" />
                    <p className="px-6 text-center text-sm text-white/80">
                      Appuyez pour activer la caméra et ajouter les produits à la facture.
                    </p>
                  </div>
                )}

                {/* flash feedback */}
                <AnimatePresence>
                  {flash && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`pointer-events-none absolute inset-0 rounded-2xl ${
                        flash === 'ok' ? 'bg-sage/45' : 'bg-terracotta/45'
                      }`}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant={scanning ? 'danger' : 'gold'}
                  size="lg"
                  className="flex-1"
                  onClick={() => setScanning((v) => !v)}
                >
                  {scanning ? <Square size={18} /> : <Play size={18} />}
                  {scanning ? 'Arrêter' : 'Démarrer le scan'}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setShowManual((v) => !v)}>
                  <Keyboard size={18} />
                </Button>
              </div>

              {showManual && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    inputMode="numeric"
                    placeholder="Saisir le code-barres"
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-gold"
                  />
                  <Button onClick={submitManual}>OK</Button>
                </div>
              )}
            </div>

            {/* Counter */}
            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-white">
              <span className="text-sm text-white/80">Produits envoyés à la caisse</span>
              <span className="text-mono text-2xl font-bold text-gold-light">{entries.length}</span>
            </div>

            {/* History */}
            <div className="glass rounded-2xl p-3">
              {entries.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/60">Aucun produit scanné</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {entries.map((e) => (
                      <motion.div
                        key={e.key}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-white"
                      >
                        {e.found ? (
                          <CheckCircle2 size={17} className="shrink-0 text-sage" />
                        ) : (
                          <XCircle size={17} className="shrink-0 text-terracotta" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.label}</p>
                          <p className="text-mono text-[11px] text-white/60">{e.barcode}</p>
                        </div>
                        {e.stock !== undefined && (
                          <span className="text-mono shrink-0 text-sm font-bold text-gold-light">
                            {e.stock} en stock
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-white/50">
              Gardez cette page ouverte pendant la vente. Les produits apparaissent instantanément dans le
              panier de la caisse.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
