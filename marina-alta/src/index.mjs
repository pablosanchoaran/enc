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
import { updateArchive } from './archive.mjs'
import { capturePhotos, copyPhotosToSite, loadThumbnails } from './photos.mjs'
import { normalize } from './normalize.mjs'
import { renderReport } from './report.mjs'
import * as ego from './adapters/ego.mjs'
import * as listado from './adapters/listado.mjs'
import * as sooprema from './adapters/sooprema.mjs'
import * as thinkspain from './adapters/thinkspain.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const INVENTORY_FILE = join(DATA_DIR, 'listings.json')
const ARCHIVE_FILE = join(DATA_DIR, 'archive.json')
/** Lo que supera el techo de precio: solo url, precio y lastmod. */
const OVER_BUDGET_FILE = join(DATA_DIR, 'over-budget.json')
const PHOTOS_DIR = join(DATA_DIR, 'photos')
const REPORT_FILE = join(ROOT, 'report', 'index.html')
/** Salida como sitio web: la página y sus fotos como ficheros aparte. */
const SITE_DIR = join(ROOT, 'site')
/**
 * Tope del informe. El artefacto publicado rechaza lo que pase de 16 MB; se
 * deja margen porque el inventario crece a diario y quien regenera no siempre
 * está mirando el tamaño.
 */
const REPORT_MAX_BYTES = 13 * 1024 * 1024

const ADAPTERS = { thinkspain, sooprema, ego, listado }

function parseArgs(argv) {
  const args = {
    dryRun: false,
    source: null,
    limit: Infinity,
    feedLimit: 250,
    refreshBudget: 40,
    reportOnly: false,
    // Fotos por ejecución. El diario va sobrado con esto; se sube a mano
    // cuando hay que ponerse al día con un inventario recién ampliado.
    photoBudget: 120,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--report-only') args.reportOnly = true
    else if (arg === '--source') args.source = argv[++i]
    // Vuelve a descargar todas las fichas conocidas, sin fiarse del lastmod.
    else if (arg === '--refresh') args.refreshBudget = Infinity
    else if (arg === '--limit') {
      const value = Number.parseInt(argv[++i], 10)
      args.limit = Number.isFinite(value) ? value : Infinity
    } else if (arg === '--feed-limit') {
      const value = Number.parseInt(argv[++i], 10)
      args.feedLimit = Number.isFinite(value) ? value : 250
    } else if (arg === '--photo-budget') {
      const value = Number.parseInt(argv[++i], 10)
      args.photoBudget = Number.isFinite(value) ? value : 120
    }
  }
  return args
}

/**
 * Escribe el sitio web: la misma página, pero con las fotos como ficheros
 * aparte que el navegador pide sobre la marcha. Sin el tope de 16 MB del
 * artefacto caben todas las portadas y, al pulsarlas, la copia de 640 px.
 */
async function writeSite({ daily, listings, maxPrice, log }) {
  await mkdir(SITE_DIR, { recursive: true })
  const photos = await copyPhotosToSite(listings, PHOTOS_DIR, SITE_DIR)
  const html = renderReport({ daily, listings, thumbnails: photos, maxPrice })
  await writeFile(join(SITE_DIR, 'index.html'), html)
  log(
    `Sitio en ${SITE_DIR}` +
      ` (página de ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB, ${photos.size} fotos aparte)`,
  )
}

/**
 * Escribe el informe repartiendo el espacio disponible.
 *
 * El artefacto publicado no puede pasar de 16 MB y las fotos van empotradas en
 * base64, así que no vale un presupuesto fijo: lo que ocupa el texto de la
 * página depende del tamaño del inventario, que crece cada día. Se mide primero
 * la página sin ninguna foto y ese hueco es lo que se les da.
 */
async function writeReport({ daily, listings, maxPrice, log }) {
  await mkdir(dirname(REPORT_FILE), { recursive: true })

  const sinFotos = renderReport({ daily, listings, thumbnails: new Map(), maxPrice })
  const hueco = Math.max(0, REPORT_MAX_BYTES - Buffer.byteLength(sinFotos))

  // Por precio ascendente: si las fotos no caben todas, las que se quedan sin
  // portada son las más caras, que es donde menos se mira.
  const byPrice = [...listings].sort((a, b) => a.price - b.price)
  const thumbnails = await loadThumbnails(byPrice, PHOTOS_DIR, { maxBytes: hueco })

  const html = renderReport({ daily, listings, thumbnails, maxPrice })
  await writeFile(REPORT_FILE, html)

  const conFoto = listings.filter((item) => item.photo?.thumb).length
  const sinSitio = conFoto - thumbnails.size
  log(
    `Informe en ${REPORT_FILE}` +
      ` (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB, ${thumbnails.size} portadas` +
      (sinSitio > 0 ? `; ${sinSitio} no caben y salen sin foto` : '') +
      ')',
  )
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
    const catalog = await readJson(join(ROOT, 'sources', 'agencies.json'), { sources: [] })
    const techo = catalog.config?.maxPrice
    await writeReport({ daily, listings: previousListings, maxPrice: techo, log })
    await writeSite({ daily, listings: previousListings, maxPrice: techo, log })
    return
  }

  const catalog = await readJson(join(ROOT, 'sources', 'agencies.json'), { sources: [] })
  const maxPrice = catalog.config?.maxPrice ?? Infinity
  const sources = catalog.sources.filter((source) => {
    if (!source.enabled) return false
    if (!args.source) return true
    return source.id === args.source || source.adapter === args.source
  })

  // Lo que ya se sabe que está por encima del techo no hace falta volver a
  // descargarlo mientras la web no toque su lastmod.
  const overBudgetFile = await readJson(OVER_BUDGET_FILE, { updatedAt: null, entries: [] })
  const overBudget = new Map((overBudgetFile.entries ?? []).map((item) => [item.url, item]))

  // Lo que el archivo da por retirado se vuelve a comprobar: si la ficha
  // responde, la baja fue nuestra y el anuncio sigue publicado.
  const archiveFile = await readJson(ARCHIVE_FILE, { entries: [] })
  const removedUrls = (archiveFile.entries ?? [])
    .filter((item) => item.reason === 'retirado')
    .map((item) => item.url)

  const known = {
    ids: new Set(previousListings.map((item) => item.id)),
    byUrl: new Map(previousListings.map((item) => [item.url, item])),
    removed: removedUrls,
    overBudget,
  }

  const collected = []
  const sourceReports = []
  /** Fichas abiertas esta pasada por las fuentes de catálogo incompleto. */
  const checkedUrls = new Set()
  const sourcesReportingChecked = new Set()

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
      const salida = await adapter.collect({
        fetcher,
        source,
        known,
        log,
        limit: args.limit,
        feedLimit: args.feedLimit,
        refreshBudget: args.refreshBudget,
        maxPrice,
      })
      // Un adaptador puede devolver solo los anuncios, o además el conjunto de
      // fichas que ha llegado a mirar. Lo segundo lo hacen las fuentes cuyo
      // listado no es completo, para que lo no comprobado no cuente como
      // desaparecido.
      raws = Array.isArray(salida) ? salida : salida.items
      if (!Array.isArray(salida) && salida.checked) {
        for (const url of salida.checked) checkedUrls.add(url)
        sourcesReportingChecked.add(source.id)
      }
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
      const { listing, reason } = normalize(raw, source, today, { maxPrice })
      if (!listing) {
        rejected.set(reason, (rejected.get(reason) ?? 0) + 1)
        if (reason === 'por encima del techo') {
          overBudget.set(raw.url, {
            url: raw.url,
            source: source.id,
            price: raw.price,
            lastmod: raw.lastmod ?? null,
            seenOn: today,
          })
        }
        continue
      }
      // Si estaba anotado como caro y ahora entra, ha bajado de precio.
      overBudget.delete(raw.url)
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

  // Las fuentes que informan de lo que han mirado solo pueden dar de baja lo
  // que hayan mirado; las que dan un catálogo completo (un sitemap, un barrido
  // exhaustivo) siguen tratando la ausencia como señal.
  const catalogoCompleto = (item) => !sourcesReportingChecked.has(item.source)
  const checked = sourcesReportingChecked.size === 0 ? null : new Set(checkedUrls)
  if (checked) for (const item of comparable) if (catalogoCompleto(item)) checked.add(item.url)

  const result = diffInventory(comparable, deduped, today, { checkedUrls: checked })
  const listings = [...result.inventory, ...untouched]

  // La primera vez que se rastrea una fuente, su catálogo entero aparecería
  // como "altas de hoy". Eso no es novedad, es la carga inicial.
  const bootstrapped = new Set(
    sources
      .filter((source) => !previousListings.some((item) => item.source === source.id))
      .map((source) => source.id),
  )
  // El barrido de ThinkSpain solo ve los primeros resultados de cada zona y
  // esa selección rota entre peticiones, así que "no estaba ayer" no significa
  // "se ha publicado hoy". En esas fuentes las altas salen solo de su feed de
  // novedades, que sí va por fecha.
  const sweepOnly = new Set(
    sources.filter((source) => source.sweepOnly).map((source) => source.id),
  )
  const initialLoad = result.additions.filter((item) => bootstrapped.has(item.source))
  const swept = result.additions.filter(
    (item) => !bootstrapped.has(item.source) && sweepOnly.has(item.source) && !item.fromFeed,
  )
  const additions = result.additions.filter(
    (item) => !initialLoad.includes(item) && !swept.includes(item),
  )

  if (initialLoad.length > 0) {
    log(`  (carga inicial de ${[...bootstrapped].join(', ')}: ${initialLoad.length} anuncios)`)
  }
  if (swept.length > 0) {
    log(`  (${swept.length} hallazgos del barrido, no publicaciones de hoy)`)
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

  // Fotos de los anuncios que se publican: cuando se vendan, la agencia
  // retirará el anuncio y la imagen dejará de existir, así que hay que tenerla
  // copiada. El criterio es el mismo techo con el que se extrae, para que no
  // haya tarjeta publicada sin portada.
  if (!args.dryRun) {
    const candidates = listings.filter((item) => item.price <= maxPrice)
    await capturePhotos(candidates, { photosDir: PHOTOS_DIR, budget: args.photoBudget, log })
  }

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

  // Lo vendido y lo retirado pasa al archivo histórico, con su marca temporal
  // y su foto: el inventario vivo es el mercado de hoy, el archivo es la memoria.
  const previousArchive = await readJson(ARCHIVE_FILE, { updatedAt: null, entries: [] })
  const archive = updateArchive(previousArchive.entries ?? [], {
    removals: result.removals,
    listings,
    runAt: daily.generatedAt,
  })
  log(
    `   archivo histórico: ${archive.entries.length} anuncios` +
      ` (${archive.added} nuevos, ${archive.updated} actualizados)`,
  )

  await writeJson(INVENTORY_FILE, { updatedAt: daily.generatedAt, listings })
  await writeJson(OVER_BUDGET_FILE, {
    updatedAt: daily.generatedAt,
    maxPrice,
    entries: [...overBudget.values()],
  })
  await writeJson(ARCHIVE_FILE, { updatedAt: daily.generatedAt, entries: archive.entries })
  await writeJson(dailyFile, daily)
  log(`\nDatos en ${INVENTORY_FILE}`)
  await writeReport({ daily, listings, maxPrice, log })
  await writeSite({ daily, listings, maxPrice, log })
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
