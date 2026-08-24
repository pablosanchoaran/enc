/**
 * Adaptador para las agencias cuya web es WordPress y deja abierta su API
 * pública (`/wp-json/wp/v2/<tipo>`).
 *
 * Es con diferencia la mejor manera de leer una de estas webs cuando existe:
 * devuelve el precio, la localidad y las medidas ya como datos, cien fichas por
 * petición, sin abrir una sola página. Grupo García entra por aquí porque
 * rasparla era inviable: su maquetador reparte el precio propio y los de las
 * casas relacionadas en divs idénticos, separados solo por una clase aleatoria
 * (`brxe-nkufuc`) que cambia cada vez que reeditan la página, y su
 * `RealEstateListing` es anotación de SEO, sin precio.
 */

import { detectType, parseArea, parseCount, parsePrice } from '../parse.mjs'

/** Tope de seguridad: cien fichas por página. */
const PAGE_SIZE = 100
const MAX_PAGES = 40

/** Los campos de WordPress llegan como listas de un elemento. */
function meta(record, ...names) {
  for (const name of names) {
    const raw = record.meta?.[name]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value)
  }
  return null
}

/** "212.00" son metros, no un precio con decimales: el punto es decimal. */
function decimalArea(value) {
  if (value == null) return null
  const number = Number.parseFloat(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

function toListing(record) {
  const price = parsePrice(meta(record, 'property_price'))
  const title = record.title?.rendered?.trim() || null
  if (!price || !title || !record.link) return null

  const city = meta(record, 'property_city')
  const type = meta(record, 'property_type')

  return {
    sourceRef: meta(record, 'property_ref') ?? String(record.id),
    url: record.link,
    title,
    price,
    // `bedrooms` viene a cero en todo el catálogo; las habitaciones de verdad
    // están en `habitaciones_totales`.
    beds: parseCount(meta(record, 'habitaciones_totales', 'bedrooms', 'habitaciones-dobles')),
    baths: parseCount(meta(record, 'banos', 'aseos')),
    builtM2: decimalArea(meta(record, 'metros-construidos', 'metros-utiles')),
    plotM2: decimalArea(meta(record, 'metros-parcela')),
    type: detectType(type ?? '', title),
    image: null,
    saleStatus: 'available',
    lastmod: record.modified ?? null,
    // La ciudad va primero: es el campo que la agencia rellena a mano para
    // cada ficha, y manda sobre lo que diga el título.
    locationHint: [city, title].filter(Boolean).join(' | '),
  }
}

/** La portada, que la API deja solo como identificador. */
async function readImage(fetcher, origin, record) {
  if (!record.featured_media) return null
  const raw = await fetcher.get(
    `${origin}/wp-json/wp/v2/media/${record.featured_media}?_fields=source_url`,
    { accept: 'application/json' },
  )
  if (!raw) return null
  try {
    return JSON.parse(raw).source_url ?? null
  } catch {
    return null
  }
}

export async function collect({ fetcher, source, log, limit = Infinity, maxPrice = Infinity }) {
  const postType = source.postType ?? 'properties'
  const fields = 'id,link,modified,title,meta,featured_media'

  const records = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${source.origin}/wp-json/wp/v2/${postType}?per_page=${PAGE_SIZE}&page=${page}&_fields=${fields}`
    const raw = await fetcher.get(url, { accept: 'application/json' })
    if (!raw) break

    let batch
    try {
      batch = JSON.parse(raw)
    } catch {
      log('  ⚠ la API no ha devuelto JSON; se deja la fuente sin tocar')
      return []
    }
    // Pasada la última página la API devuelve un error, no una lista.
    if (!Array.isArray(batch) || batch.length === 0) break
    records.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  log(`  fichas en la API: ${records.length}`)

  // El precio ya viene en la lista, así que lo caro se descarta sin gastar ni
  // una petición más: de aquí sale casi todo el ahorro.
  const found = []
  for (const record of records.slice(0, limit)) {
    const item = toListing(record)
    if (!item) continue
    if (item.price > maxPrice) {
      found.push(item)
      continue
    }
    found.push({ ...item, image: await readImage(fetcher, source.origin, record) })
  }
  return found
}
