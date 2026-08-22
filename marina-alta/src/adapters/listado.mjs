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
import { detectMunicipality } from '../municipalities.mjs'
import {
  detectSaleStatus,
  detectType,
  metaContent,
  parseArea,
  parseCount,
  readPrice,
} from '../parse.mjs'

/**
 * Enlaces a ficha dentro de una página de listado. La fuente declara o bien un
 * `propertyPath` (`/propiedad/`), o bien un `propertyPattern` para las webs
 * cuyas fichas no viven bajo un prefijo común — Renvida las publica como
 * `/1506702/7-bedroom-villa-in-denia`.
 */
function extractPropertyLinks(html, origin, { propertyPath, propertyPattern }) {
  const pattern = propertyPattern ? new RegExp(propertyPattern) : null
  const links = new Set()

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1]
    if (!pattern && !href.includes(propertyPath)) continue
    try {
      const url = new URL(href, origin)
      if (url.origin !== new URL(origin).origin) continue

      if (pattern) {
        if (!pattern.test(url.pathname)) continue
      } else {
        // `/propiedad/` a secas es la plantilla vacía, no una ficha.
        const tail = url.pathname.split(propertyPath)[1]
        if (!tail || tail.replace(/\//g, '').length < 3) continue
      }

      url.hash = ''
      url.search = ''
      links.add(url.toString())
    } catch {
      // href relativo mal formado: se ignora.
    }
  }
  return [...links]
}

/**
 * Valor de una característica de la ficha, escrita como "Dormitorios: 3". Los
 * dos puntos son obligatorios por el mismo motivo que en la localidad: el
 * formulario de búsqueda de estas webs lista "Dormitorios 1+ 2+ 3+" y "Baños 1
 * 2 3", y sin exigirlos toda parcela acababa con "1 habitación y 50 m²".
 */
function readLabelled(text, ...labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*:\\s*(\\d[\\d.,]*)`, 'iu'))
    if (match) return match[1]
  }
  return null
}

/**
 * Municipio declarado en la ficha ("Localidad: Teulada"). Se exigen los dos
 * puntos a propósito: el formulario de búsqueda de estas webs lleva un
 * desplegable "Localidad" con todos los pueblos de la comarca, y sin esa
 * exigencia el primero de la lista se colaría como ubicación del anuncio.
 */
function readLocality(text) {
  const match = text.match(LOCALITY)
  return match?.[1]?.trim() ?? null
}

/**
 * El valor termina donde empieza la siguiente etiqueta, que estas fichas pegan
 * sin espacio: "Localidad: CalpeZona: Residencial". Por eso el corte busca una
 * palabra Capitalizada seguida de dos puntos.
 *
 * Sin bandera `i` a propósito: con ella, `\p{Lu}` pasa a casar también
 * minúsculas y el patrón cortaba en la tercera letra — "Calpe" se leía "Cal",
 * que no es ningún municipio, y la ficha acababa ubicada por el texto libre.
 * Las etiquetas llevan las dos grafías escritas a mano.
 */
const LOCALITY =
  /(?:[Ll]ocalidad|[Pp]oblaci[óo]n|[Mm]unicipio|[Cc]iudad|LOCALIDAD|MUNICIPIO)\s*:\s*([^:|]{3,40}?)\s*(?:[\p{Lu}][\p{Ll}]+\s*:|$)/u

/**
 * Algunas webs concatenan su propia ruta con la URL del CDN y dejan un
 * `og:image` como `/objetos/temp/source/lemon/https://cdn.../foto.jpg`. La
 * dirección buena es la que empieza en el último `https://`.
 */
function cleanImageUrl(raw) {
  if (!raw) return null
  const embedded = raw.lastIndexOf('https://')
  return embedded > 0 ? raw.slice(embedded) : raw
}

export function parsePropertyPage(html, url) {
  const $ = cheerio.load(html)

  const title = $('h1').first().text().trim() || metaContent(html, 'og:title') || null

  const price = readPrice($)

  if (!title || !price) return null

  const reference =
    $('[class*="ref"]').first().text().replace(/ref\.?/i, '').trim().split(/\s/)[0] || null
  const body = $('body').text().replace(/\s+/g, ' ')
  const slug = new URL(url).pathname
  const description = metaContent(html, 'og:description') ?? ''
  const locality = readLocality(body)

  return {
    sourceRef: reference || slug.split('/').filter(Boolean).pop(),
    url,
    title,
    price,
    beds: parseCount(readLabelled(body, 'dormitorios', 'habitaciones', 'bedrooms')),
    baths: parseCount(readLabelled(body, 'baños', 'banos', 'bathrooms')),
    // "Construido en: 1920" es el año, no la superficie: por eso no vale
    // cualquier etiqueta que empiece por "construido".
    builtM2: parseArea(
      readLabelled(body, 'superficie construida', 'm2 construidos', 'construidos', 'edificado'),
    ),
    plotM2: parseArea(readLabelled(body, 'parcela', 'terreno', 'solar')),
    type: detectType(title, slug.replace(/-/g, ' ')),
    image: cleanImageUrl(metaContent(html, 'og:image')),
    saleStatus: detectSaleStatus($),
    // Cuando la ficha declara su localidad, esa manda y no se mezcla con nada
    // más: una descripción que diga "a diez minutos de Dénia" no debe mover la
    // casa de pueblo a Dénia.
    municipality: locality ? detectMunicipality(locality) : null,
    locationHint: [locality, title, slug.replace(/-/g, ' '), description]
      .filter(Boolean)
      .join(' | '),
  }
}

export async function collect({ fetcher, source, known, log, limit = Infinity, refreshBudget = 40 }) {
  const { propertyPattern } = source
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
    for (const link of extractPropertyLinks(html, source.origin, { propertyPath, propertyPattern })) {
      urls.add(link)
    }
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
