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

const TYPE_PATTERNS = [
  [/\b(parcela|solar|terreno|plot|land|building plot|grundst)/i, 'plot'],
  [/\b(villa|chalet|chalé|casa de campo|finca|country house|detached)/i, 'villa'],
  [/\b(adosad|paread|townhouse|terraced|bungalow|duplex|dúplex)/i, 'townhouse'],
  [/\b(ático|atico|penthouse)/i, 'penthouse'],
  [/\b(piso|apartamento|apartment|flat|estudio|studio)/i, 'apartment'],
  [
    /\b(local|oficina|nave|negocio|traspaso|commercial|business|shop|office|bar|restaurant|hotel|hostal|garaje|garage|parking)\b/i,
    'commercial',
  ],
  [/\b(casa|house|home)/i, 'house'],
]

/** Clasifica el tipo de inmueble a partir del texto del anuncio. */
export function detectType(...texts) {
  const haystack = texts.filter(Boolean).join(' ')
  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(haystack)) return type
  }
  return 'other'
}

/** Tipos que no son vivienda ni suelo residencial: se descartan del informe. */
export const NON_RESIDENTIAL = new Set(['commercial'])

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
