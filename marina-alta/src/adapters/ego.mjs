/**
 * Adaptador para las webs sobre eGO Real Estate (LYT Properties). Publican un
 * sitemap por idioma y cada ficha lleva un JSON-LD `RealEstateListing` con
 * precio, imagen y unas migas de pan que dan el municipio, así que no hace
 * falta rascar el maquetado.
 */

import * as cheerio from 'cheerio'
import {
  detectSaleStatus,
  detectType,
  extractJsonLd,
  parseArea,
  parseCount,
  parseSitemap,
  parsePrice,
} from '../parse.mjs'

const PROPERTY_PATH = '/detalles-del-inmueble/'

/** Sitemap raíz → sub-sitemap en castellano (o el primero que haya). */
async function collectPropertyUrls(fetcher, origin) {
  const root = await fetcher.get(`${origin}/sitemap.xml`, { accept: 'application/xml' })
  if (!root) return []

  const children = parseSitemap(root).map((entry) => entry.loc)
  const spanish = children.find((loc) => /-es-es\.xml$/.test(loc)) ?? children[0]
  if (!spanish) return []

  const child = await fetcher.get(spanish, { accept: 'application/xml' })
  return parseSitemap(child ?? '').filter((entry) => entry.loc.includes(PROPERTY_PATH))
}

function parsePropertyPage(html, url) {
  const nodes = extractJsonLd(html)
  const listing = nodes.find((node) => node['@type'] === 'RealEstateListing')
  if (!listing) return null

  const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList')
  const crumbs = (breadcrumb?.itemListElement ?? []).map((item) => item.name).filter(Boolean)
  // Migas: Tipo > Operación > Municipio > Zona. Solo interesa la venta.
  if (crumbs.some((name) => /alquiler|arrendamiento|rent/i.test(name))) return null

  const price = parsePrice(listing.offers?.price)
  if (!price) return null

  const $ = cheerio.load(html)
  const text = $('.specsText, .PropertyBasicDetail').text()
  const description = listing.description ?? ''

  return {
    sourceRef: url.split('/').filter(Boolean).pop(),
    url,
    title: listing.name ?? null,
    price,
    beds: parseCount(text.match(/(\d+)\s*(habitacion|dormitor|bedroom)/i)?.[1]),
    baths: parseCount(text.match(/(\d+)\s*(baño|bano|bathroom)/i)?.[1]),
    builtM2: parseArea(description.match(/([\d.,]+)\s*m\s*[²2]?\s*(?:construid|de construcc)/i)?.[1]),
    plotM2: parseArea(description.match(/parcela[^.]{0,20}?([\d.,]+)\s*m/i)?.[1]),
    // Solo el título y las migas: en la descripción, "con terreno de 800 m²"
    // convertiría un chalet en una parcela.
    type: detectType(listing.name ?? '', ...crumbs),
    image: typeof listing.image === 'string' ? listing.image : null,
    saleStatus: detectSaleStatus($),
    locationHint: [...crumbs, listing.name].filter(Boolean).join(' | '),
  }
}

export async function collect({ fetcher, source, known, log, limit = Infinity, refreshBudget = 40 }) {
  const entries = await collectPropertyUrls(fetcher, source.origin)
  log(`  fichas en el sitemap: ${entries.length}`)

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
