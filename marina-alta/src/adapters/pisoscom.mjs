/**
 * Adaptador de pisos.com. Es un portal: reúne a muchas agencias españolas de
 * comprador local, justo el público que ThinkSpain —pensado para el comprador
 * extranjero— cubre peor.
 *
 * Funciona como el barrido de zonas de ThinkSpain: cada municipio tiene su
 * listado, cada tarjeta trae ya el precio, la zona, las habitaciones, los
 * metros y la foto, y no hace falta abrir ninguna ficha. El techo de precio va
 * en la propia ruta (`/venta/pisos-denia/hasta-350000/`), así que el portal
 * filtra antes de servir y se piden muchas menos páginas.
 *
 * Su robots.txt permite los listados, su paginación por ruta y las fichas; no
 * hay muro anti-bot y no hace falta hacerse pasar por un navegador.
 */

import * as cheerio from 'cheerio'
import { detectMunicipality } from '../municipalities.mjs'
import { detectType, parseArea, parseCount, parsePrice } from '../parse.mjs'

const ORIGIN = 'https://www.pisos.com'

/**
 * El nombre que pisos.com da a cada uno de nuestros municipios. No se puede
 * deducir del nuestro: Jávea es `xabia_javea`, Calpe es `calp` y Teulada y
 * Moraira van por separado.
 *
 * Ojo con `jalon`: es Jalón, en Cangas del Narcea (Asturias). El de la Marina
 * Alta es `jalon_xalo`. Es el tercer homónimo de otra provincia que nos sale,
 * tras Jalón de Cameros y el Cabo de Gata.
 */
export const ZONAS = [
  'denia',
  'xabia_javea',
  'calp',
  'teulada',
  'moraira',
  'benitachell',
  'benissa',
  'els_poblets',
  'el_verger',
  'pedreguer',
  'ondara',
  'gata_de_gorgos',
  'beniarbeig',
  'jalon_xalo',
  'lliber',
  'alcalali',
  'orba',
  'benidoleig',
  'sanet_y_negrals',
]

/** Tarjetas por página en un listado completo. */
const PAGE_SIZE = 30
/** Tope de seguridad por municipio: 60 páginas son 1.800 anuncios. */
const MAX_PAGES = 60

/** "El Montgó (Dénia)": la zona y, entre paréntesis, el municipio. */
function municipioDeLaZona(texto) {
  const entreParentesis = texto.match(/\(([^)]+)\)\s*$/)?.[1]
  return (entreParentesis ? detectMunicipality(entreParentesis) : null) ?? detectMunicipality(texto)
}

/** Lee las tarjetas de una página de listado. */
export function parseCards(html) {
  const $ = cheerio.load(html)
  const items = []

  $('.ad-preview').each((_, element) => {
    const card = $(element)
    const href = card.attr('data-lnk-href')
    const price = parsePrice(card.find('.ad-preview__price').first().text())
    if (!href || !price) return

    // El identificador del anuncio va en el `id` de la tarjeta
    // ("65065180008.108900"); lo que va detrás del punto es la agencia.
    const sourceRef = (card.attr('id') ?? '').split('.')[0] || href
    const title = card.find('.ad-preview__title').first().text().replace(/\s+/g, ' ').trim()
    const zona = card.find('.ad-preview__info .p-sm').first().text().replace(/\s+/g, ' ').trim()

    const facts = { beds: null, baths: null, builtM2: null }
    card.find('.ad-preview__char').each((__, char) => {
      const texto = $(char).text().trim()
      if (/hab/i.test(texto)) facts.beds = parseCount(texto)
      else if (/baño/i.test(texto)) facts.baths = parseCount(texto)
      else if (/m²|m2/i.test(texto)) facts.builtM2 = parseArea(texto)
    })

    const url = new URL(href, ORIGIN).toString()
    items.push({
      sourceRef,
      url,
      title,
      price,
      ...facts,
      plotM2: null,
      type: detectType(title, href.replace(/[-_/]/g, ' ')),
      image: card.find('img').first().attr('src') ?? null,
      municipality: municipioDeLaZona(zona),
      locationHint: [zona, title].filter(Boolean).join(' | '),
    })
  })
  return items
}

/**
 * Recorre el listado entero de un municipio. Como en ThinkSpain, pasada la
 * última página el portal no devuelve una lista vacía, así que el corte
 * necesita dos frenos: una página incompleta, o una que no trae nada nuevo.
 */
export async function* paginas(fetcher, zona, maxPrice) {
  const techo = Number.isFinite(maxPrice) ? `hasta-${maxPrice}/` : ''
  const vistos = new Set()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${ORIGIN}/venta/pisos-${zona}/${techo}${page > 1 ? `${page}/` : ''}`
    const html = await fetcher.get(url)
    if (!html) return

    const cards = parseCards(html)
    const nuevas = cards.filter((card) => !vistos.has(card.sourceRef))
    if (nuevas.length === 0) return

    nuevas.forEach((card) => vistos.add(card.sourceRef))
    yield nuevas
    if (cards.length < PAGE_SIZE) return
  }
}

/**
 * La ficha de un anuncio, para la verificación de bajas. Solo se fía del
 * precio del propio anuncio (`.price__value`): la ficha lleva al pie tarjetas
 * de otros anuncios con su precio, y esas no cuentan.
 */
export function parsePropertyPage(html, url) {
  const $ = cheerio.load(html)
  const title = $('h1').first().text().replace(/\s+/g, ' ').trim()
  if (!title) return null
  const texto = $('.price__value').first().text()
  const price = parsePrice(texto)
  if (!price) return /consultar/i.test(texto) ? { url, title, priceOnRequest: true } : null
  return { url, title, price }
}

export async function collect({ fetcher, log, limit = Infinity, maxPrice = Infinity }) {
  const found = []
  const seen = new Set()
  let pages = 0

  for (const zona of ZONAS.slice(0, limit)) {
    for await (const cards of paginas(fetcher, zona, maxPrice)) {
      pages += 1
      for (const card of cards) {
        // Un mismo anuncio puede salir en Teulada y en Moraira.
        if (seen.has(card.sourceRef)) continue
        seen.add(card.sourceRef)
        found.push(card)
      }
    }
  }
  log(`  barrido de ${ZONAS.length} municipios: ${found.length} anuncios en ${pages} páginas`)

  // Si hay municipios pero ninguno da una sola tarjeta, el maquetado ha
  // cambiado: se falla en voz alta para que la fuente cuente como rota y su
  // inventario se conserve, en vez de darlo todo por retirado.
  if (found.length === 0) {
    throw new Error('el barrido no ha sacado ni un anuncio: la web habrá cambiado')
  }
  return found
}

export const origin = ORIGIN
export const agency = 'pisos.com (portal)'
