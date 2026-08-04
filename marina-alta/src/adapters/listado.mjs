/**
 * Adaptador para las agencias que no publican sus fichas en el sitemap: se
 * parte de las URLs de listado que se declaren en `sources/agencies.json` y se
 * recogen los enlaces a fichas que haya en el HTML servido.
 *
 * La paginación se deja en manos de robots.txt: donde está prohibida (Llobell,
 * Denialara, Calablanca prohíben `/*​/*​/*​/pagina/*`) el fetcher la descarta
 * sola y nos quedamos con la primera página de cada listado.
 */

import * as cheerio from 'cheerio'
import {
  detectSaleStatus,
  detectType,
  metaContent,
  parseArea,
  parseCount,
  parsePrice,
} from '../parse.mjs'

/** Enlaces a ficha dentro de una página de listado. */
function extractPropertyLinks(html, origin, propertyPath) {
  const links = new Set()
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1]
    if (!href.includes(propertyPath)) continue
    try {
      const url = new URL(href, origin)
      if (url.origin !== new URL(origin).origin) continue
      // `/propiedad/` a secas es la plantilla vacía, no una ficha.
      const tail = url.pathname.split(propertyPath)[1]
      if (!tail || tail.replace(/\//g, '').length < 3) continue
      url.hash = ''
      url.search = ''
      links.add(url.toString())
    } catch {
      // href relativo mal formado: se ignora.
    }
  }
  return [...links]
}

/** Valor de una característica escrita como "Dormitorios 3" o "Baños: 2". */
function readLabelled(text, ...labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[^\\d]{0,25}(\\d[\\d.,]*)`, 'i'))
    if (match) return match[1]
  }
  return null
}

function parsePropertyPage(html, url) {
  const $ = cheerio.load(html)

  const title = $('h1').first().text().trim() || metaContent(html, 'og:title') || null

  // El precio solo se acepta desde el elemento donde la ficha lo muestra. Un
  // `[class*="precio"]` a secas también casa con `selectPrecios`, el
  // desplegable de "precio hasta" del buscador, y acaba dando por precio del
  // anuncio un importe del filtro — justo lo que pasa en las fichas que ponen
  // "CONSULTAR".
  const PRICE_SELECTORS = ['.iconprecio', '.precio', '[class*="__price"]', '.price']
  const isFilterWidget = (className) => /select|filtr|search|buscad|form|slider|range/i.test(className)

  let price = null
  for (const selector of PRICE_SELECTORS) {
    const candidates = $(selector).filter((_, element) => {
      const node = $(element)
      return !isFilterWidget(node.attr('class') ?? '') && node.find('select, option, input, li').length === 0
    })
    if (candidates.length === 0) continue

    candidates.each((_, element) => {
      if (price == null) price = parsePrice($(element).text().trim())
    })
    // El selector más fiable de la página manda: si está y dice "CONSULTAR",
    // el anuncio no tiene precio público y no se busca en ningún otro sitio.
    break
  }

  if (!title || !price) return null

  const reference =
    $('[class*="ref"]').first().text().replace(/ref\.?/i, '').trim().split(/\s/)[0] || null
  const body = $('body').text().replace(/\s+/g, ' ')
  const slug = new URL(url).pathname

  return {
    sourceRef: reference || slug.split('/').filter(Boolean).pop(),
    url,
    title,
    price,
    beds: parseCount(readLabelled(body, 'dormitorios', 'habitaciones', 'bedrooms')),
    baths: parseCount(readLabelled(body, 'baños', 'banos', 'bathrooms')),
    builtM2: parseArea(readLabelled(body, 'superficie construida', 'construidos', 'superficie')),
    plotM2: parseArea(readLabelled(body, 'parcela', 'terreno', 'solar')),
    type: detectType(title, slug.replace(/-/g, ' ')),
    image: metaContent(html, 'og:image'),
    saleStatus: detectSaleStatus($),
    locationHint: [title, slug.replace(/-/g, ' ')].filter(Boolean).join(' | '),
  }
}

export async function collect({ fetcher, source, known, log, limit = Infinity, refreshBudget = 40 }) {
  const propertyPath = source.propertyPath ?? '/propiedad/'
  const listingUrls = source.listingUrls ?? []
  if (listingUrls.length === 0) {
    log('  ⚠ esta fuente no declara listingUrls en sources/agencies.json')
    return []
  }

  const urls = new Set()
  for (const listingUrl of listingUrls) {
    const html = await fetcher.get(listingUrl)
    if (!html) continue
    for (const link of extractPropertyLinks(html, source.origin, propertyPath)) urls.add(link)
  }
  log(`  fichas encontradas en los listados: ${urls.size}`)

  // Sin lastmod que consultar, se refresca lo que no se conoce y una tanda
  // rotatoria de lo ya visto, para ir enterándose de los cambios de precio.
  const fresh = []
  const stale = []
  for (const url of urls) {
    const previous = known.byUrl.get(url)
    if (previous) stale.push({ url, previous })
    else fresh.push(url)
  }
  stale.sort((a, b) => (a.previous.lastSeen ?? '').localeCompare(b.previous.lastSeen ?? ''))

  const queue = [...fresh, ...stale.slice(0, refreshBudget).map((item) => item.url)].slice(0, limit)
  log(`  a descargar: ${queue.length} (${fresh.length} sin conocer)`)

  const found = []
  for (const url of queue) {
    const html = await fetcher.get(url)
    if (!html) continue
    const item = parsePropertyPage(html, url)
    if (item) found.push(item)
  }
  return found
}
