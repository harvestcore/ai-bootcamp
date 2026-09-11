import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DB_PATH, getDb } from './db.ts'
import { ensureCatalogImported, getCatalogStatus, getColorsForPart, getPalette, lookupPart, searchParts } from './catalog.ts'
import { isInventoryEmpty, readSnapshotDto } from './repository.ts'
import * as actions from './actions.ts'

/**
 * The local HTTP API. It is deliberately tiny: reads for the catalog, one
 * endpoint per write, and every write answers with the entire new inventory so
 * the browser never has to reconstruct state by hand.
 *
 * The same handler is mounted by the Vite dev server (see vite.config.ts) and
 * by the standalone production server, so there is only ever one API.
 */

type ActionFn = (input: never) => actions.ActionResponse<unknown>

const ACTIONS: Record<string, ActionFn> = {
  createUnit: actions.createUnit as ActionFn,
  renameUnit: actions.renameUnit as ActionFn,
  updateUnitDimensions: actions.updateUnitDimensions as ActionFn,
  deleteUnit: actions.deleteUnit as ActionFn,
  setPartitionCount: actions.setPartitionCount as ActionFn,
  setPartitionFull: actions.setPartitionFull as ActionFn,
  createPiece: actions.createPiece as ActionFn,
  addToExistingPiece: actions.addToExistingPiece as ActionFn,
  extractPiece: actions.extractPiece as ActionFn,
  updatePiece: actions.updatePiece as ActionFn,
  movePiece: actions.movePiece as ActionFn,
  deletePiece: actions.deletePiece as ActionFn,
  importLegacy: actions.importLegacy as ActionFn,
  restoreBackup: actions.restoreBackup as ActionFn,
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('error', reject)
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
  })
}

export type ApiHandler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void

export function createApiHandler(): ApiHandler {
  getDb()
  ensureCatalogImported()

  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      if (next) return next()
      sendJson(res, 404, { error: 'Not found' })
      return
    }

    handle(req, res, url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[api]', message)
      sendJson(res, 500, { error: message })
    })
  }
}

/**
 * Streams a consistent copy of the database file. `VACUUM INTO` is SQLite's own
 * way to take one — copying the file by hand while the server is running would
 * miss whatever is still in the write-ahead log.
 */
async function sendDatabaseCopy(res: ServerResponse): Promise<void> {
  const target = join(tmpdir(), `lego-inventory-${randomUUID()}.sqlite`)
  getDb().prepare('VACUUM INTO ?').run(target)
  const filename = `lego-inventory-${new Date().toISOString().slice(0, 10)}.sqlite`

  res.writeHead(200, {
    'content-type': 'application/vnd.sqlite3',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  })
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(target)
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.pipe(res)
  })
  await unlink(target).catch(() => {})
}

async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const route = url.pathname.slice('/api'.length)

  if (req.method === 'GET') {
    switch (route) {
      case '/status': {
        const status = getCatalogStatus()
        return sendJson(res, 200, { ...status, inventoryEmpty: isInventoryEmpty(), dbPath: DB_PATH })
      }
      case '/inventory':
        return sendJson(res, 200, readSnapshotDto())
      case '/export/database':
        return sendDatabaseCopy(res)
      case '/catalog/part':
        return sendJson(res, 200, { part: lookupPart(url.searchParams.get('number') ?? '') })
      case '/catalog/colors': {
        const part = url.searchParams.get('part') ?? ''
        return sendJson(res, 200, { colors: part.trim() ? getColorsForPart(part) : getPalette() })
      }
      case '/catalog/search': {
        const limit = Number(url.searchParams.get('limit')) || 20
        return sendJson(res, 200, { parts: searchParts(url.searchParams.get('q') ?? '', limit) })
      }
    }
  }

  if (req.method === 'POST' && route.startsWith('/actions/')) {
    const name = route.slice('/actions/'.length)
    const action = ACTIONS[name]
    if (!action) return sendJson(res, 404, { error: `Unknown action "${name}"` })
    const input = (await readBody(req)) as never
    return sendJson(res, 200, action(input))
  }

  sendJson(res, 404, { error: `No route for ${req.method} ${url.pathname}` })
}
