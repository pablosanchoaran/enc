/** Utilidades de parseo compartidas por los adaptadores. */

/** Extrae las etiquetas <loc> (y su <lastmod>) de un sitemap. */
export function parseSitemap(xml) {
  if (!xml) return []
  const entries = []
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>|<sitemap>([\s\S]*?)<\/sitemap>/g)) {
    const block = match[1] ?? match[2]
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1]
    if (!loc) continue
    entries.push({
      loc: decodeEntities(loc),
      lastmod: block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ?? null,
      isIndex: match[2] !== undefined,
    })
  }
  // Sitemaps que no envuelven cada entrada en <url> (poco frecuente pero existe).
  if (entries.length === 0) {
    for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
      entries.push({ loc: decodeEntities(match[1]), lastmod: null, isIndex: false })
    }
  }
  return entries
}

export function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * Interpreta un importe europeo: "1.300.000 €", "695.000", "1,300,000".
 * Devuelve null si no parece un precio de vivienda creíble.
 */
export function parsePrice(text) {
  if (text == null) return null
  const raw = String(text)
  const match = raw.match(/(\d[\d.,\s]{2,})/)
  if (!match) return null

  let digits = match[1].replace(/\s/g, '')
  const lastDot = digits.lastIndexOf('.')
  const lastComma = digits.lastIndexOf(',')
  const decimalSep = lastDot > lastComma ? '.' : lastComma > lastDot ? ',' : null

  if (decimalSep) {
    const tail = digits.slice(digits.lastIndexOf(decimalSep) + 1)
    // Un separador con 3 dígitos detrás es de millares, no decimal.
    if (tail.length === 3) digits = digits.replace(/[.,]/g, '')
    else digits = digits.replace(decimalSep === '.' ? /,/g : /\./g, '').replace(',', '.')
  }

  const value = Number.parseFloat(digits)
  if (!Number.isFinite(value) || value < 10_000 || value > 100_000_000) return null
  return Math.round(value)
}

/** Interpreta una superficie: "1.072 m2", "180 m²", "592". */
export function parseArea(text) {
  if (text == null) return null
  const match = String(text).match(/(\d[\d.,]*)\s*(?:m²|m2|m\b)?/)
  if (!match) return null
  const value = Number.parseFloat(match[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null
  return Math.round(value)
}

export function parseCount(text) {
  const match = String(text ?? '').match(/\d+/)
  if (!match) return null
  const value = Number.parseInt(match[0], 10)
  return value >= 0 && value <= 50 ? value : null
}

// `\b` no sirve aquí: para JavaScript "á" no es carácter de palabra, así que
// `\bático` no casa con "Ático con garaje". Los límites van con propiedades
// Unicode.
const WORD_START = '(?<![\\p{L}\\p{N}])'
const WORD_END = '(?![\\p{L}\\p{N}])'
const word = (alternatives) => new RegExp(`${WORD_START}(?:${alternatives})`, 'iu')

const TYPE_PATTERNS = [
  [word('parcelas?|solar(?:es)?|terrenos?|plots?|land|building plot|grundst'), 'plot'],
  [word('villas?|chalets?|chalé|casa de campo|fincas?|country house|detached'), 'villa'],
  [word('adosad|paread|townhouses?|terraced|bungalows?|d[úu]plex'), 'townhouse'],
  [word('[áa]ticos?|penthouses?'), 'penthouse'],
  [word('pisos?|apartamentos?|apartments?|flats?|estudios?|studios?'), 'apartment'],
  [
    new RegExp(
      `${WORD_START}(?:local(?:es)?|oficinas?|naves?|negocios?|traspasos?|almac[eé]n(?:es)?|commercial|business|shops?|offices?|bar|restaurantes?|hotel|hostal|garajes?|garages?|parking)${WORD_END}`,
      'iu',
    ),
    'commercial',
  ],
  [word('casas?|houses?|home'), 'house'],
]

/**
 * Clasifica el inmueble por el término que aparece antes en el texto. En
 * castellano el sustantivo principal abre el anuncio: "Ático con garaje" es un
 * ático, "Casa con parcela" es una casa y "Locales comerciales" un local.
 */
export function detectType(...texts) {
  const haystack = texts.filter(Boolean).join(' ')
  if (!haystack) return 'other'

  let best = null
  for (const [index, [pattern, type]] of TYPE_PATTERNS.entries()) {
    const match = haystack.match(pattern)
    if (!match) continue
    if (!best || match.index < best.position || (match.index === best.position && index < best.index)) {
      best = { type, position: match.index, index }
    }
  }
  return best?.type ?? 'other'
}

/** Tipos que no son vivienda ni suelo residencial: se descartan del informe. */
export const NON_RESIDENTIAL = new Set(['commercial'])

/**
 * Estado comercial del anuncio. Las agencias dejan publicado lo vendido y lo
 * reservado durante meses, así que sin esto el informe enseña casas que ya no
 * están a la venta.
 */
const STATUS_WORDS = [
  [/^(vendido|vendida|vendu|verkauft|verkocht|sold|sold out)$/i, 'sold'],
  [
    /^(reservado|reservada|reserved|under offer|bajo oferta|réservé|reserviert|gereserveerd)$/i,
    'reserved',
  ],
]

/**
 * Busca una etiqueta de estado entre los elementos de la página. Solo cuenta
 * cuando el texto del elemento es exactamente la palabra: "Todos los derechos
 * reservados" del pie no puede marcar una casa como reservada.
 */
export function detectSaleStatus($) {
  let status = null
  $('span, div, p, li, strong, em, b, h2, h3, h4').each((_, element) => {
    if (status === 'sold') return
    const node = $(element)
    if (node.children().length > 0) return

    const text = node.text().trim()
    if (!text || text.length > 20) return
    for (const [pattern, value] of STATUS_WORDS) {
      if (!pattern.test(text)) continue
      // "vendido" gana a "reservado" si aparecieran los dos.
      if (value === 'sold' || status === null) status = value
    }
  })
  return status ?? 'available'
}

/** Extrae todos los bloques JSON-LD de una página, ya parseados. */
export function extractJsonLd(html) {
  const blocks = []
  for (const match of html.matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1].trim())
      blocks.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch {
      // Un JSON-LD malformado no debe tumbar la extracción de la página.
    }
  }
  return blocks
}

export function metaContent(html, property) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i',
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i',
  )
  const match = html.match(pattern) ?? html.match(alt)
  return match ? decodeEntities(match[1]) : null
}

/**
 * Lee el precio de una ficha. Solo vale el importe que esté en un elemento de
 * precio del anuncio: los desplegables de "precio hasta" del buscador llevan
 * importes redondos que, si se aceptan, acaban publicándose como si fueran el
 * precio de la casa — sobre todo en las fichas que ponen "consultar".
 *
 * Los selectores van del más específico al más genérico y **manda el primero
 * que exista en la página**: si la ficha muestra su precio ahí y dice
 * "CONSULTAR", el anuncio no tiene precio público y no se busca en otro sitio.
 *
 * "El primero" es el primero con texto. Benimo abre su bloque de precio con un
 * `features-1__price-img`, que es el icono y no dice nada; quedarse con él a
 * secas dejaba la web entera sin precios y, por tanto, sin un solo anuncio.
 */
const PRICE_SELECTORS = [
  '.iconprecio',
  '[class*="__price"]',
  '[class*="property-price"]',
  '[class*="property1-price"]',
  '.precio',
  '[class*="price"]',
]
const FILTER_WIDGET = /select|filtr|search|buscad|\bform\b|slider|range|min|max/i

export function readPrice($) {
  for (const selector of PRICE_SELECTORS) {
    const candidates = $(selector).filter((_, element) => {
      const node = $(element)
      return (
        !FILTER_WIDGET.test(node.attr('class') ?? '') &&
        node.find('select, option, input, li').length === 0
      )
    })
    // Solo el primero con texto: ese mismo selector casa también con las
    // tarjetas de "propiedades similares" del pie, así que recorrerlos todos
    // hasta dar con un número acaba publicando el precio de otra casa en las
    // fichas que ponen "Consultar" — que suelen ser justo las ya vendidas.
    const texts = candidates
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean)
    if (texts.length === 0) continue

    return parsePrice(texts[0])
  }
  return null
}
