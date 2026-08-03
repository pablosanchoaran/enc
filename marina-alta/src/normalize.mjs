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
 */
export function normalize(raw, source, today) {
  if (!raw?.url) return { listing: null, reason: 'sin url' }
  if (!raw.price) return { listing: null, reason: 'sin precio' }

  // Los adaptadores que conocen la zona con certeza la traen ya resuelta.
  const municipality =
    raw.municipality ?? detectMunicipality(raw.locationHint, raw.title, raw.url)
  if (!municipality) return { listing: null, reason: 'fuera de la comarca' }
  if (NON_RESIDENTIAL.has(raw.type)) return { listing: null, reason: 'no residencial' }

  const pricePerM2 = raw.builtM2 ? Math.round(raw.price / raw.builtM2) : null

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
      beds: raw.beds ?? null,
      baths: raw.baths ?? null,
      builtM2: raw.builtM2 ?? null,
      plotM2: raw.plotM2 ?? null,
      pricePerM2,
      image: raw.image ?? null,
      lastmod: raw.lastmod ?? null,
      firstSeen: today,
      lastSeen: today,
      missingRuns: 0,
      status: 'active',
    },
    reason: null,
  }
}
