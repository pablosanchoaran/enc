/**
 * Adaptador para las webs construidas sobre Sooprema, el CMS que usan buena
 * parte de las inmobiliarias de la comarca (Ferrando, MLS Dénia, Denialara,
 * InmoXara, Daniamed, Benimo Villas, Calablanca).
 *
 * Todas exponen el inventario en su sitemap con `<lastmod>`, y la ficha sigue
 * la misma familia de plantillas (`features-N__price`, `location-1__city`...),
 * así que los selectores van por prefijo de clase en vez de por plantilla.
 */

import * as cheerio from 'cheerio'
import {
  detectSaleStatus,
  detectType,
  metaContent,
  parseArea,
  parseCount,
  parseSitemap,
  readLabelled,
  readPrice,
  readStructured,
} from '../parse.mjs'

/** Segmentos de URL que Sooprema usa para las fichas, según el idioma del sitio. */
const PROPERTY_SEGMENTS = [
  'for-sale',
  'en-venta',
  'venta',
  'propiedad',
  'property',
  'properties',
  'inmueble',
  'te-koop',
  'zu-verkaufen',
  'a-vendre',
  'in-vendita',
  'listing',
]

/** Prefijo de idioma que algunas webs anteponen: `/es/propiedad/...`. */
const LANGUAGE_PREFIX = /^[a-z]{2}(-[a-z]{2})?$/i

function isPropertyUrl(url) {
  try {
    let segments = new URL(url).pathname.split('/').filter(Boolean)
    if (segments.length > 2 && LANGUAGE_PREFIX.test(segments[0])) segments = segments.slice(1)
    // Una ficha es `/<segmento>/<slug-ref>/`; `/for-sale/` a secas es el listado.
    return segments.length >= 2 && PROPERTY_SEGMENTS.includes(segments[0])
  } catch {
    return false
  }
}

/** Recorre el sitemap, siguiendo un nivel de índice si lo hubiera. */
async function collectSitemapEntries(fetcher, origin) {
  const entries = []
  const root = await fetcher.get(`${origin}/sitemap.xml`, { accept: 'application/xml' })
  if (!root) return entries

  for (const entry of parseSitemap(root)) {
    if (entry.isIndex || entry.loc.endsWith('.xml')) {
      const child = await fetcher.get(entry.loc, { accept: 'application/xml' })
      if (child) entries.push(...parseSitemap(child))
    } else {
      entries.push(entry)
    }
  }
  return entries
}

/**
 * Los datos numéricos van en una lista de iconos sin etiqueta textual, así que
 * hay que deducir qué es cada número. El nombre del SVG solo no basta: Benimo
 * llama `area.svg` al icono de la parcela, y por ahí se colaban parcelas de
 * 14.000 m² como si fueran superficie construida. El `alt` y el `title` de la
 * imagen sí lo dicen en palabras ("Tamaño de parcela"), y mandan sobre el
 * nombre del fichero.
 */
export function readIconFeatures($, target) {
  $('[class*="__list"] li, [class*="__icons"] li, [class*="features"] li').each((_, element) => {
    const li = $(element)
    const img = li.find('img')
    const described = `${img.attr('alt') ?? ''} ${img.attr('title') ?? ''}`.trim()
    const hint = described || (img.attr('src') ?? '')
    const text = li.text().trim()
    if (!text) return

    if (/bed|dormi|habitac|schlaf|slaap/i.test(hint)) target.beds ??= parseCount(text)
    else if (/bath|bano|baño|wc|badkamer/i.test(hint)) target.baths ??= parseCount(text)
    else if (/plot|parcela|terreno|land|big-area/i.test(hint)) target.plotM2 ??= parseArea(text)
    else if (/house|built|home|area|surface|construi/i.test(hint)) target.builtM2 ??= parseArea(text)
  })
}

/**
 * Lo que los iconos no hayan dado, escrito con su etiqueta en el cuerpo de la
 * ficha: "Habitaciones: 3●Baños: 2●Superficie construida: 131 m²". Vista
 * Marina Home no usa iconos y sin esto sus anuncios salían sin dormitorios ni
 * metros, que además es lo que necesita el agrupador de repetidos.
 *
 * Los dos puntos son obligatorios, como en el otro adaptador: el formulario de
 * búsqueda de estas webs lista "Dormitorios 1+ 2+ 3+" y sin exigirlos toda
 * parcela acababa con tres habitaciones.
 */
function readLabelledFeatures($, target) {
  const body = $('body').text().replace(/\s+/g, ' ')
  target.beds ??= parseCount(readLabelled(body, 'dormitorios', 'habitaciones', 'bedrooms'))
  target.baths ??= parseCount(readLabelled(body, 'baños', 'banos', 'bathrooms'))
  // "Construido en: 1920" es el año, no la superficie.
  target.builtM2 ??= parseArea(
    readLabelled(body, 'superficie construida', 'm2 construidos', 'construidos', 'edificado'),
  )
  target.plotM2 ??= parseArea(readLabelled(body, 'parcela', 'terreno', 'solar'))
}

export function parsePropertyPage(html, url) {
  const $ = cheerio.load(html)

  const structured = readStructured(html)

  const title =
    $('h1').first().text().trim() || structured?.title || metaContent(html, 'og:title') || null

  // Manda el precio del maquetado, que es el que está probado contra veinte
  // agencias y sabe que un "Consultar" significa que no hay precio público. El
  // dato estructurado entra cuando ahí no hay nada que leer.
  const price = readPrice($) ?? structured?.price ?? null

  const reference =
    $('[class*="__ref"] span, [class*="__reference"] span').first().text().trim() ||
    $('[class*="__ref"], [class*="__reference"]').first().text().replace(/ref\.?/i, '').trim() ||
    null

  const city = $('[class*="__city"]').first().text().trim() || null
  const description = metaContent(html, 'og:description') ?? ''
  const image = metaContent(html, 'og:image')

  const facts = { beds: null, baths: null, builtM2: null, plotM2: null }
  readIconFeatures($, facts)
  readLabelledFeatures($, facts)

  if (!title || !price) return null

  const slug = new URL(url).pathname
  return {
    sourceRef: reference || slug.split('/').filter(Boolean).pop(),
    url,
    title,
    price,
    ...facts,
    // La descripción queda fuera a propósito: "con terreno de 800 m²"
    // convertiría un chalet en una parcela.
    type: detectType(title, slug.replace(/-/g, ' ')),
    saleStatus: detectSaleStatus($),
    image: image ?? structured?.image ?? null,
    // La localidad del dato estructurado va primero porque es la que la
    // agencia declara, y manda sobre el título: "2 PLOTS OF LAND IN MORAIRA"
    // está en Benitachell según su propia ficha.
    locationHint: [structured?.locality, city, title, description, slug.replace(/-/g, ' ')]
      .filter(Boolean)
      .join(' | '),
  }
}

/** El idioma del sitio que no lleva prefijo en la URL. */
const DEFAULT_LANGUAGE = '\u0000sin-prefijo'

/**
 * Las webs multiidioma publican la misma ficha una vez por idioma
 * (`/es/property/x`, `/en/property/x`, `/de/property/x`…). Sin esto se
 * descargaría cuatro veces lo mismo y el inventario tendría cuatro anuncios
 * por casa, porque la referencia sale del slug.
 */
export function preferOneLanguage(entries) {
  // Sin prefijo no significa "neutro": es el idioma por defecto de la web, uno
  // más. Tratarlo como neutro dejaba pasar las dos versiones — Bindley servía
  // 128 fichas en inglés y 107 en castellano, la misma casa dos veces con la
  // misma referencia (`bpc011092`) y distinto slug.
  const languageOf = (loc) => {
    const segments = new URL(loc).pathname.split('/').filter(Boolean)
    return segments.length > 2 && LANGUAGE_PREFIX.test(segments[0])
      ? segments[0].toLowerCase()
      : DEFAULT_LANGUAGE
  }

  const counts = new Map()
  for (const entry of entries) {
    const language = languageOf(entry.loc)
    counts.set(language, (counts.get(language) ?? 0) + 1)
  }
  if (counts.size < 2) return entries

  // No se puede agrupar por la ruta porque el slug también va traducido
  // (`/es/propiedad/villa-en-javea` frente a `/en/property/villa-in-javea`),
  // así que se elige un idioma y se descarta el resto. Gana el que más fichas
  // trae, que es el catálogo más completo; a igualdad, el castellano.
  const preferred = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || Number(b[0] === 'es') - Number(a[0] === 'es'),
  )[0][0]
  return entries.filter((entry) => languageOf(entry.loc) === preferred)
}

export async function collect({ fetcher, source, known, log, limit = Infinity, refreshBudget = 40 }) {
  const all = (await collectSitemapEntries(fetcher, source.origin)).filter((entry) =>
    isPropertyUrl(entry.loc),
  )
  const entries = preferOneLanguage(all)
  const duplicates = all.length - entries.length
  log(
    `  fichas en el sitemap: ${entries.length}` +
      (duplicates > 0 ? ` (${duplicates} son la misma ficha en otro idioma)` : ''),
  )

  // Las fichas ya vistas solo se vuelven a abrir si su lastmod cambió; se
  // reserva un presupuesto para refrescar las más antiguas por rotación, que
  // es la red de seguridad para las webs que no actualizan bien el lastmod.
  // Lo que ya se sabe por encima del techo de precio no se vuelve a abrir
  // mientras la web no toque su lastmod: es de donde sale casi todo el ahorro,
  // porque tres de cada cuatro anuncios de la comarca pasan de ese techo.
  const fresh = []
  const stale = []
  let skippedByPrice = 0

  for (const entry of entries) {
    const expensive = known.overBudget?.get(entry.loc)
    if (expensive && entry.lastmod && expensive.lastmod === entry.lastmod) {
      skippedByPrice += 1
      continue
    }

    const previous = known.byUrl.get(entry.loc)
    if (!previous || !entry.lastmod || entry.lastmod !== previous.lastmod) fresh.push(entry)
    else stale.push({ entry, previous })
  }
  if (skippedByPrice > 0) log(`  ${skippedByPrice} fichas ya conocidas por encima del techo: no se abren`)

  stale.sort((a, b) => (a.previous.lastSeen ?? '').localeCompare(b.previous.lastSeen ?? ''))
  const queue = [...fresh, ...stale.slice(0, refreshBudget).map((item) => item.entry)].slice(0, limit)
  log(`  a descargar: ${queue.length} (${fresh.length} nuevas o modificadas)`)

  const found = []
  for (const entry of queue) {
    const html = await fetcher.get(entry.loc)
    if (!html) continue
    const item = parsePropertyPage(html, entry.loc)
    if (item) found.push({ ...item, lastmod: entry.lastmod })
  }
  return found
}
