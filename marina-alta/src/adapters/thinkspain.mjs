/**
 * Adaptador de ThinkSpain. Combina dos vías:
 *
 *  1. Barrido de zonas: los sitemaps de búsqueda listan las URLs de listado por
 *     zona (municipio y barrio). Cada listado sirve sus fichas ya con precio,
 *     dormitorios, superficie y tipo dentro del propio HTML, así que una sola
 *     petición rinde hasta 16 anuncios.
 *  2. Feed de últimas altas (`latest-properties.xml`): recoge lo publicado hoy
 *     en toda España; solo se abre la ficha de lo que aún no conocemos, y el
 *     filtro por municipio descarta lo que cae fuera de la comarca.
 */

import { detectMunicipality, detectMunicipalityFromSlug } from '../municipalities.mjs'
import {
  decodeEntities,
  detectType,
  extractJsonLd,
  parseArea,
  parsePrice,
  parseSitemap,
} from '../parse.mjs'

const ORIGIN = 'https://www.thinkspain.com'
const SEARCH_SITEMAPS = [
  `${ORIGIN}/sitemaps/for-sale/es/search-1.xml`,
  `${ORIGIN}/sitemaps/for-sale/es/search-2.xml`,
]
const LATEST_SITEMAP = `${ORIGIN}/latest-properties.xml`
const LISTING_PREFIX = `${ORIGIN}/es/venta-viviendas/`
const EXCLUDED_SEGMENTS = /garajes|locales|oficinas|negocios|edificios|hoteles|traspasos|naves/i

/** Zonas de la comarca extraídas de los sitemaps de búsqueda. */
async function discoverZoneListings(fetcher, log) {
  const zones = new Map()

  for (const sitemapUrl of SEARCH_SITEMAPS) {
    const xml = await fetcher.get(sitemapUrl, { accept: 'application/xml' })
    if (!xml) continue

    for (const { loc } of parseSitemap(xml)) {
      if (!loc.startsWith(LISTING_PREFIX) || loc.includes('?')) continue
      const slug = loc.slice(LISTING_PREFIX.length)
      // Solo la URL de la zona, sin subtipo: ya incluye todos los inmuebles.
      if (slug.includes('/') || !slug || EXCLUDED_SEGMENTS.test(slug)) continue
      if (!detectMunicipalityFromSlug(slug, { anchored: true })) continue
      zones.set(slug, loc)
    }
  }

  log(`  zonas de la comarca en los sitemaps de búsqueda: ${zones.size}`)
  return [...zones.values()]
}

/** Tarjetas que sirve cada página del listado. */
const PAGE_SIZE = 16
/** Tope de seguridad por zona: 80 páginas son 1.280 anuncios. */
const MAX_PAGES = 80

/**
 * Recorre un listado de zona entero. La web solo pinta 16 tarjetas y el resto
 * las carga el botón "Mostrar más", que pide la misma URL con `numpag`; sin
 * esto se veían 16 de los 2.627 anuncios que Dénia tiene publicados.
 *
 * El corte necesita dos frenos, porque pasada la última página el servidor no
 * devuelve una lista vacía: vuelve a servir la primera. Se para cuando llega
 * una página incompleta (la última) o cuando lo que llega ya se conocía.
 */
export async function* zonePages(fetcher, zoneUrl, maxPrice) {
  const url = new URL(zoneUrl)
  // El filtro de precio es del servidor: recorta el listado antes de pedirlo y
  // ahorra la mayoría de las páginas, porque casi todo pasa del techo.
  if (Number.isFinite(maxPrice)) url.searchParams.set('maxprice', String(maxPrice))

  const vistos = new Set()
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) url.searchParams.set('numpag', String(page))
    const html = await fetcher.get(url.toString())
    if (!html) return

    const cards = parseListingCards(html, zoneUrl.slice(LISTING_PREFIX.length))
    const nuevas = cards.filter((card) => !vistos.has(card.sourceRef))
    if (nuevas.length === 0) return

    nuevas.forEach((card) => vistos.add(card.sourceRef))
    yield nuevas
    if (cards.length < PAGE_SIZE) return
  }
}

/**
 * Lee las tarjetas de un listado: cada una trae ya todos los datos. El bloque
 * de cada tarjeta va desde su `data-property-id` hasta el de la siguiente.
 */
function parseListingCards(html, zoneSlug) {
  const results = []
  const blocks = html.split(/data-property-id="(?=\d)/).slice(1)

  for (const block of blocks) {
    const propertyId = block.match(/^(\d+)"/)?.[1]
    if (!propertyId) continue

    const rawFacts = block.match(/data-base-twc-analytic-event-parameters='(\{"propertyID[^']*\})'/)
    let facts = {}
    if (rawFacts) {
      try {
        facts = JSON.parse(decodeEntities(rawFacts[1]))
      } catch {
        facts = {}
      }
    }
    if (facts.offer && facts.offer !== 'for-sale') continue
    if (!facts.price) continue

    const title = block.match(/<img[^>]+alt="([^"]{10,})"/)?.[1]
    const image = block.match(/src="(https:\/\/cdn\.thinkwebcontent\.com\/property\/[^"]+)"/)?.[1]
    const locationId = block.match(/location_id\\?&quot;:\\?&quot;([a-z0-9-]+)/)?.[1]

    results.push({
      sourceRef: String(propertyId),
      url: `${ORIGIN}/es/venta-viviendas/${propertyId}`,
      title: title ? decodeEntities(title) : null,
      price: facts.price,
      beds: facts.beds || null,
      builtM2: facts.buildSqm || null,
      plotM2: null,
      type: facts.type ? normalizeType(facts.type) : detectType(title ?? ''),
      image: image ?? null,
      // El slug de zona es la ubicación fiable, y solo cuando cierra el slug.
      municipality:
        detectMunicipalityFromSlug(locationId ?? '', { anchored: true }) ??
        detectMunicipalityFromSlug(zoneSlug, { anchored: true }),
      locationHint: [locationId?.replace(/-/g, ' '), title].filter(Boolean).join(' | '),
    })
  }
  return results
}

const TYPE_MAP = {
  villa: 'villa',
  house: 'house',
  'country-house': 'villa',
  finca: 'villa',
  apartment: 'apartment',
  flat: 'apartment',
  penthouse: 'penthouse',
  studio: 'apartment',
  bungalow: 'townhouse',
  townhouse: 'townhouse',
  duplex: 'townhouse',
  plot: 'plot',
  land: 'plot',
  commercial: 'commercial',
  garage: 'commercial',
  office: 'commercial',
}

function normalizeType(raw) {
  return TYPE_MAP[String(raw).toLowerCase()] ?? detectType(String(raw))
}

/** Ficha individual: se usa solo para las altas del feed diario. */
function parsePropertyPage(html, url) {
  const product = extractJsonLd(html).find((node) => node['@type'] === 'Product')
  const breadcrumb = extractJsonLd(html).find((node) => node['@type'] === 'BreadcrumbList')
  const crumbNames = (breadcrumb?.itemListElement ?? [])
    .map((item) => item.item?.name)
    .filter(Boolean)

  const facts = html.match(/data-base-twc-analytic-event-parameters='(\{"propertyID[^']*\})'/)
  let analytics = {}
  if (facts) {
    try {
      analytics = JSON.parse(decodeEntities(facts[1]))
    } catch {
      analytics = {}
    }
  }

  const title = product?.name ?? null
  if (!title && !analytics.propertyID) return null

  return {
    sourceRef: String(analytics.propertyID ?? product?.productID ?? url.split('/').pop()),
    url,
    title: title ? decodeEntities(title) : null,
    price: analytics.price ?? parsePrice(product?.offers?.price ?? ''),
    beds: analytics.beds || null,
    builtM2: analytics.buildSqm || parseArea(title ?? '') || null,
    plotM2: null,
    type: analytics.type ? normalizeType(analytics.type) : detectType(title ?? ''),
    image: product?.image ?? null,
    locationHint: [...crumbNames, title].filter(Boolean).join(' | '),
  }
}

export async function collect({
  fetcher,
  known,
  log,
  limit = Infinity,
  feedLimit = 250,
  maxPrice = Infinity,
}) {
  const found = []
  const seen = new Set()

  const push = (item) => {
    if (!item || seen.has(item.sourceRef)) return
    seen.add(item.sourceRef)
    found.push(item)
  }

  // 1) Barrido por zonas de la comarca, listado completo página a página.
  const zoneUrls = await discoverZoneListings(fetcher, log)
  let pages = 0
  for (const zoneUrl of zoneUrls.slice(0, limit)) {
    for await (const cards of zonePages(fetcher, zoneUrl, maxPrice)) {
      pages += 1
      // El precio viene en la propia tarjeta, así que lo que se cuele por
      // encima del techo se descarta sin gastar una petición más.
      cards.filter((item) => item.price <= maxPrice).forEach(push)
    }
  }
  log(`  barrido por zonas: ${found.length} anuncios en ${pages} páginas`)

  // 2) Altas del día en toda España: solo abrimos las fichas desconocidas.
  const beforeLatest = found.length
  const index = await fetcher.get(LATEST_SITEMAP, { accept: 'application/xml' })
  const spanishFeed = parseSitemap(index ?? '').find((entry) => entry.loc.includes('/es/'))
  if (!spanishFeed) log('  ⚠ no se ha podido leer el feed de últimas altas')

  if (spanishFeed) {
    const feed = await fetcher.get(spanishFeed.loc, { accept: 'application/xml' })
    const candidates = parseSitemap(feed ?? '')
      .map((entry) => entry.loc)
      .filter((loc) => {
        const ref = loc.split('/').pop()
        if (seen.has(ref) || known.ids.has(`thinkspain:${ref}`)) return false
        // Las del feed que ya se sabe que son caras tampoco se reabren.
        return !known.overBudget?.has(loc)
      })

    // `limit` acota el barrido de zonas; el feed tiene su propio tope.
    const queue = candidates.slice(0, feedLimit)
    log(`  feed de altas: ${candidates.length} sin conocer, se abren ${queue.length} fichas`)

    for (const propertyUrl of queue) {
      const html = await fetcher.get(propertyUrl)
      if (!html) continue
      const item = parsePropertyPage(html, propertyUrl)
      // El feed es nacional: la mayoría de fichas caen fuera de la comarca.
      if (item && detectMunicipality(item.locationHint)) push({ ...item, fromFeed: true })
    }
  }
  log(`  altas del feed nacional dentro de la comarca: ${found.length - beforeLatest}`)

  return found
}

export const origin = ORIGIN
export const agency = 'ThinkSpain'
