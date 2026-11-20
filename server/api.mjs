// ============================================================================
// Altech POS — local HTTP API
//
// Mounted by the production server (server/server.mjs) and by the Vite dev
// server (vite.config.ts), so `npm run dev` and the desktop shortcut share the
// very same database.
//
//   GET  /api/health                     is the local server up?
//   GET  /api/info                       LAN addresses (phone scanner) + data folder
//   GET  /api/db                         the whole database
//   GET  /api/db/rev                     revision counter (change detection)
//   POST /api/db/ops                     apply a batch of changes
//   POST /api/db/replace                 restore a full backup
//   POST   /api/scan/sessions            POS opens a phone-scanner session
//   GET    /api/scan/sessions/:id        phone checks the session
//   DELETE /api/scan/sessions/:id        POS closes it
//   POST   /api/scan/sessions/:id/scans  phone sends a barcode
//   GET    /api/scan/sessions/:id/scans  POS pulls new barcodes (?after=n)
//
// The database endpoints only answer to this PC (loopback). Other devices on
// the shop network can reach the phone-scanner endpoints only — unless
// ALTECH_LAN_DB=1 is set to let several tills share this PC's database.
// ============================================================================

import os from 'node:os'
import crypto from 'node:crypto'
import { LocalDatabase } from './db.mjs'

const MAX_BODY = 64 * 1024 * 1024
const SCAN_TTL_MS = 12 * 60 * 60 * 1000

const send = (res, status, body) => {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('INVALID_JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })

const isLoopback = (req) => {
  const ip = req.socket?.remoteAddress ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

export const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address)

const sameBarcode = (a, b) => {
  const x = String(a ?? '').trim()
  const y = String(b ?? '').trim()
  return !!x && (x === y || x.replace(/^0+/, '') === y.replace(/^0+/, ''))
}

export function createApi({ dataDir, lanDatabase = process.env.ALTECH_LAN_DB === '1' }) {
  const db = new LocalDatabase(dataDir).open()
  const scans = new Map()

  const pruneScans = () => {
    const now = Date.now()
    for (const [id, s] of scans) if (s.expiresAt < now) scans.delete(id)
  }

  const scanSession = (id) => {
    pruneScans()
    return scans.get(id) ?? null
  }

  async function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const p = url.pathname
    if (!p.startsWith('/api/')) return next ? next() : false

    try {
      // -- health / info -----------------------------------------------------
      if (p === '/api/health') return send(res, 200, { ok: true, app: 'altech-pos', rev: db.rev })
      if (p === '/api/info') {
        const port = req.socket?.localPort
        return send(res, 200, {
          app: 'altech-pos',
          port,
          lanUrls: lanAddresses().map((ip) => `http://${ip}:${port}`),
          dataDir: isLoopback(req) ? dataDir : undefined,
        })
      }

      // -- phone scanner relay ----------------------------------------------
      if (p === '/api/scan/sessions' && req.method === 'POST') {
        const body = await readBody(req)
        const id = crypto.randomUUID()
        const session = {
          id,
          label: String(body.label ?? 'POS').slice(0, 40),
          expiresAt: Date.now() + SCAN_TTL_MS,
          seq: 0,
          events: [],
        }
        scans.set(id, session)
        return send(res, 200, { id, expiresAt: new Date(session.expiresAt).toISOString() })
      }

      const scanMatch = p.match(/^\/api\/scan\/sessions\/([0-9a-f-]{36})(\/scans)?$/)
      if (scanMatch) {
        const [, id, sub] = scanMatch
        const session = scanSession(id)

        if (!sub && req.method === 'DELETE') {
          scans.delete(id)
          return send(res, 200, { ok: true })
        }
        if (!sub && req.method === 'GET') {
          if (!session) return send(res, 200, { valid: false })
          return send(res, 200, {
            valid: true,
            label: session.label,
            shop: db.values.settings?.name || 'Altech POS',
            expiresAt: new Date(session.expiresAt).toISOString(),
          })
        }
        if (sub && req.method === 'POST') {
          if (!session) return send(res, 200, { ok: false, found: false, reason: 'SESSION_EXPIRED' })
          const body = await readBody(req)
          const barcode = String(body.barcode ?? '').trim().slice(0, 64)
          if (!barcode) return send(res, 200, { ok: false, found: false, reason: 'EMPTY_BARCODE' })
          session.seq += 1
          session.events.push({ id: session.seq, barcode })
          if (session.events.length > 500) session.events.splice(0, session.events.length - 500)
          const product = Object.values(db.tables.products ?? {}).find(
            (prod) => sameBarcode(prod.barcode, barcode) || sameBarcode(prod.retailBarcode, barcode),
          )
          return send(res, 200, {
            ok: true,
            found: !!product,
            product: product
              ? { id: product.id, name: product.name, quantity: product.quantity ?? 0 }
              : null,
          })
        }
        if (sub && req.method === 'GET') {
          if (!session) return send(res, 200, [])
          const after = Number(url.searchParams.get('after') ?? 0)
          return send(res, 200, session.events.filter((e) => e.id > after))
        }
        return send(res, 405, { error: 'METHOD_NOT_ALLOWED' })
      }

      // -- database (this PC only, unless shared on purpose) -------------------
      if (p.startsWith('/api/db')) {
        if (!lanDatabase && !isLoopback(req)) return send(res, 403, { error: 'LOCAL_ONLY' })

        if (p === '/api/db' && req.method === 'GET') return send(res, 200, db.toJSON())
        if (p === '/api/db/rev' && req.method === 'GET') return send(res, 200, { rev: db.rev })
        if (p === '/api/db/ops' && req.method === 'POST') {
          const body = await readBody(req)
          return send(res, 200, db.write(body.ops))
        }
        if (p === '/api/db/replace' && req.method === 'POST') {
          const body = await readBody(req)
          if (!body || typeof body !== 'object' || typeof body.tables !== 'object')
            return send(res, 400, { error: 'INVALID_BACKUP' })
          return send(res, 200, db.replace(body))
        }
      }

      return send(res, 404, { error: 'NOT_FOUND' })
    } catch (e) {
      console.error('[api]', p, e)
      return send(res, e.status ?? 500, { error: e.message ?? 'SERVER_ERROR' })
    }
  }

  return { handle, db }
}
