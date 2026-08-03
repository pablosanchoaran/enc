#!/usr/bin/env node
/**
 * Orquestador: recorre las fuentes activas, normaliza lo recogido, lo compara
 * con el inventario del día anterior y escribe datos e informe.
 *
 *   node src/index.mjs                     ejecución completa
 *   node src/index.mjs --dry-run           no escribe nada
 *   node src/index.mjs --source sooprema   solo un adaptador o una fuente
 *   node src/index.mjs --limit 20          acota las peticiones (pruebas)
 *   node src/index.mjs --report-only       regenera el informe con lo guardado
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Fetcher } from './fetcher.mjs'
import { diffInventory } from './diff.mjs'
import { normalize } from './normalize.mjs'
import { renderReport } from './report.mjs'
import * as sooprema from './adapters/sooprema.mjs'
import * as thinkspain from './adapters/thinkspain.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const INVENTORY_FILE = join(DATA_DIR, 'listings.json')
const REPORT_FILE = join(ROOT, 'report', 'index.html')

const ADAPTERS = { thinkspain, sooprema }

function parseArgs(argv) {
  const args = { dryRun: false, source: null, limit: Infinity, feedLimit: 250, reportOnly: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--report-only') args.reportOnly = true
    else if (arg === '--source') args.source = argv[++i]
    else if (arg === '--limit') {
      const value = Number.parseInt(argv[++i], 10)
      args.limit = Number.isFinite(value) ? value : Infinity
    } else if (arg === '--feed-limit') {
      const value = Number.parseInt(argv[++i], 10)
      args.feedLimit = Number.isFinite(value) ? value : 250
    }
  }
  return args
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const today = new Date().toISOString().slice(0, 10)
  const log = (message) => console.log(message)

  const inventory = await readJson(INVENTORY_FILE, { updatedAt: null, listings: [] })
  const previousListings = inventory.listings ?? []

  if (args.reportOnly) {
    const daily = await readJson(join(DATA_DIR, 'daily', `${today}.json`), {
      date: today,
      additions: [],
      priceDrops: [],
      priceRises: [],
      removals: [],
      sources: [],
    })
    await writeFile(REPORT_FILE, renderReport({ daily, listings: previousListings }))
    log(`Informe regenerado en ${REPORT_FILE}`)
    return
  }

  const catalog = await readJson(join(ROOT, 'sources', 'agencies.json'), { sources: [] })
  const sources = catalog.sources.filter((source) => {
    if (!source.enabled) return false
    if (!args.source) return true
    return source.id === args.source || source.adapter === args.source
  })

  const known = {
    ids: new Set(previousListings.map((item) => item.id)),
    byUrl: new Map(previousListings.map((item) => [item.url, item])),
  }

  const collected = []
  const sourceReports = []

  for (const source of sources) {
    const adapter = ADAPTERS[source.adapter]
    if (!adapter) {
      log(`⚠ fuente ${source.id}: adaptador "${source.adapter}" desconocido`)
      continue
    }

    log(`\n▸ ${source.agency} (${source.id})`)
    const fetcher = new Fetcher({ origin: source.origin })
    await fetcher.init()

    if (fetcher.disallowedEntirely) {
      log('  robots.txt no permite el rastreo: se omite')
      sourceReports.push({ id: source.id, agency: source.agency, listings: 0, status: 'robots' })
      continue
    }

    let raws = []
    try {
      raws = await adapter.collect({
        fetcher,
        source,
        known,
        log,
        limit: args.limit,
        feedLimit: args.feedLimit,
      })
    } catch (error) {
      log(`  ✖ error del adaptador: ${error.message}`)
      sourceReports.push({
        id: source.id,
        agency: source.agency,
        listings: 0,
        status: 'error',
        error: error.message,
      })
      continue
    }

    const rejected = new Map()
    let accepted = 0
    for (const raw of raws) {
      const { listing, reason } = normalize(raw, source, today)
      if (!listing) {
        rejected.set(reason, (rejected.get(reason) ?? 0) + 1)
        continue
      }
      collected.push(listing)
      accepted += 1
    }

    const descartes = [...rejected].map(([reason, count]) => `${reason}: ${count}`).join(', ')
    log(`  ✓ ${accepted} anuncios de la comarca${descartes ? ` (descartados — ${descartes})` : ''}`)
    sourceReports.push({
      id: source.id,
      agency: source.agency,
      listings: accepted,
      status: accepted === 0 ? 'vacío' : 'ok',
      requests: fetcher.stats.requests,
      blocked: fetcher.stats.blocked,
      errors: fetcher.stats.errors,
    })
  }

  // Un mismo anuncio puede llegar por dos vías dentro de la misma fuente.
  const deduped = [...new Map(collected.map((item) => [item.id, item])).values()]

  // Una ejecución parcial (--source) no puede dar por retiradas las fuentes que
  // no se han visitado: se conserva su inventario intacto. Lo mismo vale para
  // una fuente que hoy no ha devuelto nada teniendo inventario previo — eso es
  // una web que ha cambiado, no doscientas casas vendidas en un día.
  const touchedSources = new Set()
  for (const source of sources) {
    const report = sourceReports.find((item) => item.id === source.id)
    const hadInventory = previousListings.some((item) => item.source === source.id)
    if (report?.listings > 0 || !hadInventory) {
      touchedSources.add(source.id)
    } else {
      log(`⚠ ${source.agency}: 0 anuncios teniendo inventario previo; se conserva sin tocar`)
    }
  }

  const untouched = previousListings.filter((item) => !touchedSources.has(item.source))
  const comparable = previousListings.filter((item) => touchedSources.has(item.source))

  const result = diffInventory(comparable, deduped, today)
  const listings = [...result.inventory, ...untouched]

  // La primera vez que se rastrea una fuente, su catálogo entero aparecería
  // como "altas de hoy". Eso no es novedad, es la carga inicial.
  const bootstrapped = new Set(
    sources
      .filter((source) => !previousListings.some((item) => item.source === source.id))
      .map((source) => source.id),
  )
  const additions = result.additions.filter((item) => !bootstrapped.has(item.source))
  if (bootstrapped.size > 0) {
    const loaded = result.additions.length - additions.length
    log(`  (carga inicial de ${[...bootstrapped].join(', ')}: ${loaded} anuncios, no son altas)`)
  }

  // Varias ejecuciones parciales el mismo día se suman en el informe del día
  // en vez de pisarse.
  const dailyFile = join(DATA_DIR, 'daily', `${today}.json`)
  const previousDaily = await readJson(dailyFile, null)
  const merge = (before = [], after = []) => [
    ...new Map([...before, ...after].map((item) => [item.id, item])).values(),
  ]

  const daily = {
    date: today,
    generatedAt: new Date().toISOString(),
    totals: {},
    additions: merge(previousDaily?.additions, additions),
    priceDrops: merge(previousDaily?.priceDrops, result.priceDrops),
    priceRises: merge(previousDaily?.priceRises, result.priceRises),
    removals: merge(previousDaily?.removals, result.removals),
    sources: [
      ...new Map(
        [...(previousDaily?.sources ?? []), ...sourceReports].map((item) => [item.id, item]),
      ).values(),
    ],
    bootstrap: Boolean(previousDaily?.bootstrap) || bootstrapped.size > 0,
  }
  daily.totals = {
    inventory: listings.length,
    additions: daily.additions.length,
    priceDrops: daily.priceDrops.length,
    priceRises: daily.priceRises.length,
    removals: daily.removals.length,
  }

  log(
    `\n── ${today}: ${daily.totals.additions} altas · ${daily.totals.priceDrops} bajadas de precio` +
      ` · ${daily.totals.priceRises} subidas · ${daily.totals.removals} retiradas` +
      ` · ${daily.totals.inventory} en inventario`,
  )

  if (args.dryRun) {
    log('\n(--dry-run: no se ha escrito nada)')
    for (const item of deduped.slice(0, 20)) {
      log(
        `  ${item.municipality.padEnd(28)} ${String(item.price).padStart(9)} €  ` +
          `${item.type.padEnd(10)} ${item.title?.slice(0, 60) ?? ''}`,
      )
    }
    return
  }

  await writeJson(INVENTORY_FILE, { updatedAt: daily.generatedAt, listings })
  await writeJson(dailyFile, daily)
  await mkdir(dirname(REPORT_FILE), { recursive: true })
  await writeFile(REPORT_FILE, renderReport({ daily, listings }))
  log(`\nDatos en ${INVENTORY_FILE}\nInforme en ${REPORT_FILE}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
