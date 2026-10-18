/**
 * Adaptador de habitaclia. Es un portal como pisos.com y, como él, reúne
 * sobre todo agencias españolas de comprador local.
 *
 * No hace falta leer el HTML: cada listado lleva sus resultados en un JSON
 * (`window.__INITIAL_PROPS__ = JSON.parse("...")`) con el identificador, el
 * precio, el municipio, las habitaciones, los metros y las fotos de cada
 * anuncio. El techo de precio va en `?maxPrice=` y la paginación en la ruta
 * (`/s/2`); su robots.txt permite las dos cosas, y también las fichas.
 *
 * Una trampa: si habitaclia no reconoce el nombre de un municipio, no da un
 * 404, sino la provincia entera (casi 40.000 anuncios). Por eso cada listado
 * comprueba que la geografía que ha servido es de verdad un municipio.
 */

import { detectMunicipality } from '../municipalities.mjs'
import { detectType } from '../parse.mjs'

const ORIGIN = 'https://www.habitaclia.com'

/**
 * El nombre de cada municipio en habitaclia. Calpe es `calpe-calp`, Jávea
 * `javea-xabia` y Benitachell lleva sus dos nombres; con `calp` o
 * `benitachell` a secas el portal sirve la provincia entera.
 */
export const ZONAS = [
  'denia',
  'javea-xabia',
  'calpe-calp',
  'teulada',
  'moraira',
  'benitachell-el-poble-nou-de-benitatxell',
  'benissa',
  'els-poblets',
  'el-verger',
  'pedreguer',
  'ondara',
  'gata-de-gorgos',
  'beniarbeig',
  'xalo',
  'lliber',
  'alcalali',
  'orba',
  'benidoleig',
  'sanet-y-negrals',
]

/**
 * El subtipo del JSON, en palabras que entiende `detectType`. Hace falta para
 * las rutas que no dicen el tipo ("planta-intermedia", "planta-baja").
 */
const SUBTIPOS = {
  flat: 'piso',
  groundFloor: 'piso',
  apartment: 'apartamento',
  studio: 'estudio',
  penthouse: 'ático',
  duplex: 'dúplex',
  chalet: 'chalet',
  terracedHouse: 'adosado',
  house: 'casa',
}

/** Tope de seguridad por municipio: 60 páginas de 29 son 1.740 anuncios. */
const MAX_PAGES = 60

/** Saca el JSON de `window.__INITIAL_PROPS__`, o null si la página no lo trae. */
export function readInitialProps(html) {
  const literal = html.match(/window\.__INITIAL_PROPS__\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/)?.[1]
  if (!literal) return null
  try {
    return JSON.parse(JSON.parse(literal))
  } catch {
    return null
  }
}

/** Convierte un anuncio del JSON en el formato común; null si no sirve. */
export function itemFromListing(listing) {
  const path = listing?.urls?.canonical ?? listing?.navigationUrl
  const price = listing?.transaction?.price
  if (!listing?.id || !path || price?.hidden || !(price?.amount > 0)) return null
  if (listing.transaction.type && listing.transaction.type !== 'buy') return null

  const summary = listing.summary ?? {}
  const location = summary.location ?? {}
  const municipio = location.layers?.find((layer) => layer.type === 'municipality')?.value ?? location.municipality
  const property = listing.property ?? {}
  const subtipo = SUBTIPOS[property.propertySubtype ?? property.propertyType]
  // Hay anuncios sin título: se compone uno con el tipo y el sitio.
  const title =
    (summary.title ?? '').replace(/\s+/g, ' ').trim() ||
    [subtipo ? subtipo[0].toUpperCase() + subtipo.slice(1) : 'Vivienda', municipio].filter(Boolean).join(' en ')
  // La ruta empieza por el tipo: /comprar/planta-intermedia/..., /comprar/chalet/...
  // "casa-adosada" es un adosado, no una casa.
  const tipoEnLaRuta = path.split('/')[2]?.replace('casa-adosada', 'adosado').replace(/-/g, ' ')

  return {
    sourceRef: listing.id,
    url: new URL(path, ORIGIN).toString(),
    title,
    price: price.amount,
    beds: property.rooms ?? null,
    baths: property.bathrooms ?? null,
    builtM2: property.builtSurface ?? null,
    plotM2: property.landArea ?? null,
    type: detectType(tipoEnLaRuta, title, subtipo),
    image: summary.multimedia?.images?.[0]?.url ?? null,
    municipality: municipio ? detectMunicipality(municipio) : null,
    locationHint: [location.displayZoneLine, title].filter(Boolean).join(' | '),
  }
}

/**
 * Lee una página de listado: la geografía que ha servido el portal, la
 * paginación y los anuncios. Null si la página no trae los datos.
 */
export function parseListPage(html) {
  const context = readInitialProps(html)?.initialSearchResultsPage?.initialSearchContext
  if (!context?.results) return null
  return {
    geography: context.geography ?? null,
    totalPages: context.results.pagination?.totalPages ?? 1,
    items: (context.results.items ?? []).map(itemFromListing).filter(Boolean),
  }
}

/** Recorre el listado entero de un municipio, página a página. */
export async function* paginas(fetcher, zona, maxPrice, log = () => {}) {
  const techo = Number.isFinite(maxPrice) ? `?maxPrice=${maxPrice}` : ''
  const vistos = new Set()
  let total = 1

  for (let page = 1; page <= Math.min(total, MAX_PAGES); page += 1) {
    const url = `${ORIGIN}/comprar/viviendas/alicante-provincia/${zona}/s${page > 1 ? `/${page}` : ''}${techo}`
    const html = await fetcher.get(url)
    if (!html) return
    const parsed = parseListPage(html)
    if (!parsed) return

    if (page === 1) {
      if (parsed.geography?.layer !== 'municipality') {
        log(`  ${zona}: habitaclia no lo reconoce como municipio (sirve «${parsed.geography?.name ?? '?'}»); se salta`)
        return
      }
      total = parsed.totalPages
    }

    const nuevas = parsed.items.filter((item) => !vistos.has(item.sourceRef))
    if (nuevas.length === 0) return
    nuevas.forEach((item) => vistos.add(item.sourceRef))
    yield nuevas
  }
}

/** La ficha de un anuncio, para la verificación de bajas. */
export function parsePropertyPage(html, url) {
  const listing = readInitialProps(html)?.listing
  if (!listing) return null
  const title = (listing.summary?.title ?? '').replace(/\s+/g, ' ').trim()
  if (listing.transaction?.type && listing.transaction.type !== 'buy') return { url, title, forRent: true }
  const price = listing.transaction?.price
  if (price?.hidden) return { url, title, priceOnRequest: true }
  if (!(price?.amount > 0)) return null
  return { url, title, price: price.amount }
}

export async function collect({ fetcher, log, limit = Infinity, maxPrice = Infinity }) {
  const found = []
  const seen = new Set()
  let pages = 0

  for (const zona of ZONAS.slice(0, limit)) {
    for await (const items of paginas(fetcher, zona, maxPrice, log)) {
      pages += 1
      for (const item of items) {
        if (seen.has(item.sourceRef)) continue
        seen.add(item.sourceRef)
        found.push(item)
      }
    }
  }
  log(`  barrido de ${ZONAS.length} municipios: ${found.length} anuncios en ${pages} páginas`)

  // Ni un anuncio en ningún municipio: el JSON habrá cambiado de forma. Se
  // falla en voz alta para conservar el inventario en vez de darlo por retirado.
  if (found.length === 0) {
    throw new Error('el barrido no ha sacado ni un anuncio: la web habrá cambiado')
  }
  return found
}

export const origin = ORIGIN
export const agency = 'habitaclia (portal)'
