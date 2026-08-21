/**
 * Convierte lo que devuelve cada adaptador al esquema común del inventario y
 * descarta lo que no es una vivienda de la Marina Alta.
 */

import { createHash } from 'node:crypto'
import { detectMunicipality } from './municipalities.mjs'
import { NON_RESIDENTIAL } from './parse.mjs'

export function listingId(sourceId, sourceRef) {
  return `${sourceId}:${createHash('sha1').update(String(sourceRef)).digest('hex').slice(0, 10)}`
}

/**
 * @returns {{ listing: object|null, reason: string|null }} `reason` explica por
 * qué se ha descartado, para poder mostrarlo en el resumen de la ejecución.
 * `maxPrice` es el techo de precio del extractor (ver config en
 * sources/agencies.json).
 */
export function normalize(raw, source, today, { maxPrice = Infinity } = {}) {
  if (!raw?.url) return { listing: null, reason: 'sin url' }
  if (!raw.price) return { listing: null, reason: 'sin precio' }
  // Por encima del techo no se guarda, pero sí se anota el precio: así una
  // bajada que lo cruce hacia abajo se detecta en la siguiente pasada.
  if (raw.price > maxPrice) return { listing: null, reason: 'por encima del techo' }

  // Los adaptadores que conocen la zona con certeza la traen ya resuelta.
  const municipality =
    raw.municipality ?? detectMunicipality(raw.locationHint, raw.title, raw.url)
  if (!municipality) return { listing: null, reason: 'fuera de la comarca' }
  if (NON_RESIDENTIAL.has(raw.type)) return { listing: null, reason: 'no residencial' }

  // Una parcela no tiene dormitorios ni superficie construida: si un adaptador
  // los trae, son de otra parte de la página.
  const isPlot = raw.type === 'plot'
  const beds = isPlot ? null : (raw.beds ?? null)
  const baths = isPlot ? null : (raw.baths ?? null)
  const builtM2 = isPlot ? null : (raw.builtM2 ?? null)

  const pricePerM2 = builtM2 ? Math.round(raw.price / builtM2) : null

  return {
    listing: {
      id: listingId(source.id, raw.sourceRef ?? raw.url),
      source: source.id,
      agency: source.agency,
      url: raw.url,
      title: raw.title?.slice(0, 240) ?? null,
      price: raw.price,
      priceHistory: [{ date: today, price: raw.price }],
      municipality,
      type: raw.type ?? 'other',
      beds,
      baths,
      builtM2,
      plotM2: raw.plotM2 ?? null,
      pricePerM2,
      image: raw.image ?? null,
      // Disponible, reservado o vendido: las agencias dejan publicado lo que ya
      // no está en el mercado, y conviene distinguirlo.
      saleStatus: raw.saleStatus ?? 'available',
      // Si la fuente garantiza que esto es una publicación reciente y no un
      // hallazgo del barrido. Ver `sweepOnly` en sources/agencies.json.
      fromFeed: raw.fromFeed ?? false,
      lastmod: raw.lastmod ?? null,
      firstSeen: today,
      lastSeen: today,
      missingRuns: 0,
      status: 'active',
    },
    reason: null,
  }
}
