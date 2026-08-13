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
  readPrice,
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
 * Los datos numéricos van en una lista de iconos sin etiqueta textual: el
 * nombre del SVG (bedroom-soo, house-soo, plot-soo...) es lo que dice qué
 * significa cada número.
 */
function readIconFeatures($, target) {
  $('[class*="__list"] li, [class*="__icons"] li, [class*="features"] li').each((_, element) => {
    const li = $(element)
    const icon = li.find('img').attr('src') ?? ''
    const text = li.text().trim()
    if (!text) return

    if (/bed|dormi|habitac|schlaf|slaap/i.test(icon)) target.beds ??= parseCount(text)
    else if (/bath|bano|baño|wc|badkamer/i.test(icon)) target.baths ??= parseCount(text)
    else if (/plot|parcela|terreno|land|big-area/i.test(icon)) target.plotM2 ??= parseArea(text)
    else if (/house|built|home|area|surface|construi/i.test(icon)) target.builtM2 ??= parseArea(text)
  })
}

function parsePropertyPage(html, url) {
  const $ = cheerio.load(html)

  const title =
    $('h1').first().text().trim() || metaContent(html, 'og:title') || null

  const price = readPrice($)

  const reference =
    $('[class*="__ref"] span, [class*="__reference"] span').first().text().trim() ||
    $('[class*="__ref"], [class*="__reference"]').first().text().replace(/ref\.?/i, '').trim() ||
    null

  const city = $('[class*="__city"]').first().text().trim() || null
  const description = metaContent(html, 'og:description') ?? ''
  const image = metaContent(html, 'og:image')

  const facts = { beds: null, baths: null, builtM2: null, plotM2: null }
  readIconFeatures($, facts)

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
    image: image ?? null,
    locationHint: [city, title, description, slug.replace(/-/g, ' ')].filter(Boolean).join(' | '),
  }
}

/**
 * Las webs multiidioma publican la misma ficha una vez por idioma
 * (`/es/property/x`, `/en/property/x`, `/de/property/x`…). Sin esto se
 * descargaría cuatro veces lo mismo y el inventario tendría cuatro anuncios
 * por casa, porque la referencia sale del slug.
 */
function preferOneLanguage(entries) {
  const languageOf = (loc) => {
    const segments = new URL(loc).pathname.split('/').filter(Boolean)
    return segments.length > 2 && LANGUAGE_PREFIX.test(segments[0])
      ? segments[0].toLowerCase()
      : null
  }

  const languages = new Set(entries.map((entry) => languageOf(entry.loc)).filter(Boolean))
  if (languages.size < 2) return entries

  // No se puede agrupar por la ruta porque el slug también va traducido
  // (`/es/propiedad/villa-en-javea` frente a `/en/property/villa-in-javea`),
  // así que se elige un idioma y se descarta el resto.
  const preferred = ['es', 'en'].find((code) => languages.has(code)) ?? [...languages][0]
  return entries.filter((entry) => {
    const language = languageOf(entry.loc)
    return language === null || language === preferred
  })
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
  const fresh = []
  const stale = []
  for (const entry of entries) {
    const previous = known.byUrl.get(entry.loc)
    if (!previous) fresh.push(entry)
    else if (!entry.lastmod || entry.lastmod !== previous.lastmod) fresh.push(entry)
    else stale.push({ entry, previous })
  }

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
